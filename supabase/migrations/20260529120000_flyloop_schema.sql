create extension if not exists "pgcrypto";

create type public.user_role as enum ('athlete', 'coach', 'admin');
create type public.opportunity_type as enum ('camp', 'huck_jam');
create type public.opportunity_status as enum ('draft', 'published', 'full', 'cancelled');
create type public.interest_status as enum ('pending', 'accepted', 'declined', 'waitlist');
create type public.follow_target_type as enum ('coach', 'tunnel');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'athlete',
  full_name text not null,
  country text,
  phone text,
  whatsapp_number text,
  instagram_handle text,
  disciplines text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coach_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  bio text,
  profile_image_url text,
  disciplines text[] not null default '{}',
  languages text[] not null default '{}',
  achievements text[] not null default '{}',
  instagram_handle text,
  coaching_tunnels uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tunnel_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  city text not null,
  address text,
  website text,
  description text,
  wind_quality_notes text,
  size text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  type public.opportunity_type not null,
  title text not null,
  coach_id uuid references public.coach_profiles(id) on delete set null,
  tunnel_id uuid not null references public.tunnel_profiles(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  registration_deadline date not null,
  price numeric(10, 2) not null default 0,
  currency text not null default 'EUR',
  total_capacity integer not null check (total_capacity >= 0),
  available_spots integer not null check (available_spots >= 0),
  min_minutes_or_hours text,
  description text,
  languages text[] not null default '{}',
  disciplines text[] not null default '{}',
  skill_level text,
  status public.opportunity_status not null default 'draft',
  contact_method text not null default 'whatsapp',
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunity_capacity_check check (available_spots <= total_capacity),
  constraint camp_requires_coach check (type <> 'camp' or coach_id is not null),
  constraint opportunity_date_order check (end_date >= start_date)
);

create table public.opportunity_interests (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  status public.interest_status not null default 'pending',
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, athlete_id)
);

create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  target_type public.follow_target_type not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (follower_id, target_type, target_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role);
create index coach_profiles_user_id_idx on public.coach_profiles(user_id);
create index tunnel_profiles_location_idx on public.tunnel_profiles(country, city);
create index opportunities_status_start_idx on public.opportunities(status, start_date);
create index opportunities_coach_id_idx on public.opportunities(coach_id);
create index opportunities_tunnel_id_idx on public.opportunities(tunnel_id);
create index opportunities_created_by_idx on public.opportunities(created_by);
create index opportunity_interests_opportunity_id_idx on public.opportunity_interests(opportunity_id);
create index opportunity_interests_athlete_id_idx on public.opportunity_interests(athlete_id);
create index follows_follower_idx on public.follows(follower_id);
create index notifications_user_read_idx on public.notifications(user_id, read, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger coach_profiles_set_updated_at
before update on public.coach_profiles
for each row execute function public.set_updated_at();

create trigger tunnel_profiles_set_updated_at
before update on public.tunnel_profiles
for each row execute function public.set_updated_at();

create trigger opportunities_set_updated_at
before update on public.opportunities
for each row execute function public.set_updated_at();

create trigger opportunity_interests_set_updated_at
before update on public.opportunity_interests
for each row execute function public.set_updated_at();

create or replace function public.is_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = user_id and role = 'admin'
  );
$$;

create or replace function public.is_last_minute_opportunity(
  start_date date,
  registration_deadline date,
  available_spots integer,
  status public.opportunity_status,
  starts_within_days integer default 10,
  deadline_window_days integer default 3
)
returns boolean
language sql
stable
as $$
  select
    status = 'published'
    and available_spots > 0
    and start_date >= current_date
    and start_date <= current_date + starts_within_days
    and registration_deadline >= current_date - 1
    and registration_deadline <= current_date + deadline_window_days;
$$;

create or replace view public.published_opportunities_with_context as
select
  o.*,
  public.is_last_minute_opportunity(
    o.start_date,
    o.registration_deadline,
    o.available_spots,
    o.status
  ) as is_last_minute,
  t.name as tunnel_name,
  t.country as tunnel_country,
  t.city as tunnel_city,
  cp.user_id as coach_user_id,
  p.full_name as coach_name
from public.opportunities o
join public.tunnel_profiles t on t.id = o.tunnel_id
left join public.coach_profiles cp on cp.id = o.coach_id
left join public.profiles p on p.id = cp.user_id
where o.status = 'published';

create or replace function public.get_home_feed(user_id uuid default auth.uid())
returns table (
  id uuid,
  type public.opportunity_type,
  title text,
  coach_id uuid,
  tunnel_id uuid,
  start_date date,
  end_date date,
  registration_deadline date,
  price numeric,
  currency text,
  total_capacity integer,
  available_spots integer,
  min_minutes_or_hours text,
  description text,
  languages text[],
  disciplines text[],
  skill_level text,
  status public.opportunity_status,
  contact_method text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  is_last_minute boolean,
  feed_priority integer,
  tunnel_name text,
  tunnel_country text,
  tunnel_city text,
  coach_name text
)
language sql
stable
security invoker
as $$
  with viewer as (
    select country from public.profiles where id = user_id
  )
  select
    p.id,
    p.type,
    p.title,
    p.coach_id,
    p.tunnel_id,
    p.start_date,
    p.end_date,
    p.registration_deadline,
    p.price,
    p.currency,
    p.total_capacity,
    p.available_spots,
    p.min_minutes_or_hours,
    p.description,
    p.languages,
    p.disciplines,
    p.skill_level,
    p.status,
    p.contact_method,
    p.created_by,
    p.created_at,
    p.updated_at,
    p.is_last_minute,
    case
      when p.is_last_minute then 1
      when exists (
        select 1 from viewer v
        where v.country is not null and v.country = p.tunnel_country
      ) then 2
      when exists (
        select 1
        from public.follows f
        where f.follower_id = user_id
          and f.target_type = 'coach'
          and f.target_id = p.coach_id
      ) then 3
      when exists (
        select 1
        from public.follows f
        where f.follower_id = user_id
          and f.target_type = 'tunnel'
          and f.target_id = p.tunnel_id
      ) then 4
      else 5
    end as feed_priority,
    p.tunnel_name,
    p.tunnel_country,
    p.tunnel_city,
    p.coach_name
  from public.published_opportunities_with_context p
  order by feed_priority asc, p.start_date asc, p.created_at desc;
$$;

create or replace function public.notify_opportunity_audience()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  coach_profile public.profiles%rowtype;
  tunnel_name text;
  tunnel_city text;
  notification_title text;
begin
  if new.status <> 'published' then
    return new;
  end if;

  select t.name, t.city
  into tunnel_name, tunnel_city
  from public.tunnel_profiles t
  where t.id = new.tunnel_id;

  select p.*
  into coach_profile
  from public.coach_profiles cp
  join public.profiles p on p.id = cp.user_id
  where cp.id = new.coach_id;

  if new.type = 'huck_jam' then
    notification_title := 'New Huck Jam posted in ' || coalesce(tunnel_city, 'your area') || '.';
  else
    notification_title := coalesce(coach_profile.full_name, 'A coach') || ' posted a new camp in ' || coalesce(tunnel_city, 'your area') || '.';
  end if;

  insert into public.notifications (user_id, title, body, type, opportunity_id)
  select distinct p.id, notification_title, new.title, 'new_opportunity', new.id
  from public.profiles p
  where p.role = 'athlete'
    and not exists (
      select 1
      from public.notifications n
      where n.user_id = p.id
        and n.opportunity_id = new.id
        and n.type = 'new_opportunity'
    )
    and (
      exists (
        select 1 from public.follows f
        where f.follower_id = p.id
          and f.target_type = 'tunnel'
          and f.target_id = new.tunnel_id
      )
      or exists (
        select 1 from public.follows f
        where f.follower_id = p.id
          and f.target_type = 'coach'
          and f.target_id = new.coach_id
      )
    );

  if public.is_last_minute_opportunity(
    new.start_date,
    new.registration_deadline,
    new.available_spots,
    new.status
  ) then
    insert into public.notifications (user_id, title, body, type, opportunity_id)
    select distinct p.id,
      new.title || ' still has open spots this weekend.',
      new.available_spots || ' spots remain open at ' || coalesce(tunnel_name, 'the tunnel') || '.',
      'last_minute',
      new.id
    from public.profiles p
    where p.role = 'athlete'
      and not exists (
        select 1
        from public.notifications n
        where n.user_id = p.id
          and n.opportunity_id = new.id
          and n.type = 'last_minute'
      );
  end if;

  return new;
end;
$$;

create trigger opportunities_notify_audience
after insert or update of status, start_date, registration_deadline, available_spots
on public.opportunities
for each row execute function public.notify_opportunity_audience();

create or replace function public.create_last_minute_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  insert into public.notifications (user_id, title, body, type, opportunity_id)
  select distinct
    p.id,
    o.title || ' still has open spots this weekend.',
    o.available_spots || ' spots remain open.',
    'last_minute',
    o.id
  from public.opportunities o
  cross join public.profiles p
  where p.role = 'athlete'
    and public.is_last_minute_opportunity(
      o.start_date,
      o.registration_deadline,
      o.available_spots,
      o.status
    )
    and not exists (
      select 1 from public.notifications n
      where n.user_id = p.id
        and n.opportunity_id = o.id
        and n.type = 'last_minute'
    );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

alter table public.profiles enable row level security;
alter table public.coach_profiles enable row level security;
alter table public.tunnel_profiles enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_interests enable row level security;
alter table public.follows enable row level security;
alter table public.notifications enable row level security;

create policy "Admins manage profiles"
on public.profiles for all
using (public.is_admin())
with check (public.is_admin());

create policy "Users read own profile"
on public.profiles for select
using (id = auth.uid() or public.is_admin());

create policy "Coaches read athletes interested in own opportunities"
on public.profiles for select
using (
  public.is_admin()
  or exists (
    select 1
    from public.opportunity_interests oi
    join public.opportunities o on o.id = oi.opportunity_id
    where oi.athlete_id = profiles.id
      and o.created_by = auth.uid()
  )
);

create policy "Users insert own profile"
on public.profiles for insert
with check (id = auth.uid());

create policy "Users update own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "Public read coach profiles"
on public.coach_profiles for select
using (true);

create policy "Coaches manage own coach profile"
on public.coach_profiles for all
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "Public read tunnel profiles"
on public.tunnel_profiles for select
using (true);

create policy "Admins manage tunnel profiles"
on public.tunnel_profiles for all
using (public.is_admin())
with check (public.is_admin());

create policy "Users read published opportunities"
on public.opportunities for select
using (status = 'published' or created_by = auth.uid() or public.is_admin());

create policy "Coaches create own opportunities"
on public.opportunities for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('coach', 'admin')
  )
);

create policy "Coaches update own opportunities"
on public.opportunities for update
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

create policy "Coaches delete own opportunities"
on public.opportunities for delete
using (created_by = auth.uid() or public.is_admin());

create policy "Athletes create interests for published opportunities"
on public.opportunity_interests for insert
with check (
  athlete_id = auth.uid()
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'athlete'
  )
  and exists (
    select 1 from public.opportunities
    where id = opportunity_id
      and status = 'published'
      and available_spots > 0
  )
);

create policy "Athletes read own interests"
on public.opportunity_interests for select
using (athlete_id = auth.uid() or public.is_admin());

create policy "Coaches read interests for own opportunities"
on public.opportunity_interests for select
using (
  public.is_admin()
  or exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id and o.created_by = auth.uid()
  )
);

create policy "Coaches update interests for own opportunities"
on public.opportunity_interests for update
using (
  public.is_admin()
  or exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id and o.created_by = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id and o.created_by = auth.uid()
  )
);

create policy "Admins manage interests"
on public.opportunity_interests for all
using (public.is_admin())
with check (public.is_admin());

create policy "Users manage own follows"
on public.follows for all
using (follower_id = auth.uid() or public.is_admin())
with check (follower_id = auth.uid() or public.is_admin());

create policy "Users read own notifications"
on public.notifications for select
using (user_id = auth.uid() or public.is_admin());

create policy "Users update own notifications"
on public.notifications for update
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "Admins manage notifications"
on public.notifications for all
using (public.is_admin())
with check (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.published_opportunities_with_context to anon, authenticated;
grant execute on function public.is_last_minute_opportunity(date, date, integer, public.opportunity_status, integer, integer) to anon, authenticated;
grant execute on function public.get_home_feed(uuid) to anon, authenticated;
grant execute on function public.create_last_minute_notifications() to authenticated;
grant select on public.coach_profiles to anon, authenticated;
grant select on public.tunnel_profiles to anon, authenticated;
grant select on public.opportunities to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.coach_profiles to authenticated;
grant select, insert, update, delete on public.opportunities to authenticated;
grant select, insert, update on public.opportunity_interests to authenticated;
grant select, insert, update, delete on public.follows to authenticated;
grant select, update on public.notifications to authenticated;
