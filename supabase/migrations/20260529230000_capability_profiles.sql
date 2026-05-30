alter table public.profiles
  add column if not exists wants_to_join_opportunities boolean not null default true,
  add column if not exists wants_to_create_opportunities boolean not null default false,
  add column if not exists is_admin boolean not null default false;

do $$
begin
  if exists (
    select 1
    from pg_attribute
    where attrelid = 'public.profiles'::regclass
      and attname = 'role'
      and not attisdropped
  ) then
    execute $sql$
      update public.profiles
      set
        is_admin = coalesce(role = 'admin', false),
        wants_to_create_opportunities = coalesce(role in ('coach', 'admin'), false),
        wants_to_join_opportunities = true
    $sql$;
  end if;
end
$$;

drop trigger if exists profiles_guard_admin_fields on public.profiles;

create or replace function public.guard_profile_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    if tg_op = 'INSERT' then
      new.is_admin := false;
    elsif new.is_admin is distinct from old.is_admin then
      new.is_admin := old.is_admin;
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_guard_admin_fields
before insert or update on public.profiles
for each row execute function public.guard_profile_admin_fields();

create or replace function public.is_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = user_id and is_admin = true
  );
$$;

alter table public.opportunities
  drop constraint if exists camp_requires_coach;

drop policy if exists "Admins manage profiles" on public.profiles;
drop policy if exists "Users read own profile" on public.profiles;
drop policy if exists "Coaches read athletes interested in own opportunities" on public.profiles;
drop policy if exists "Organizers read interested user profiles" on public.profiles;
drop policy if exists "Users insert own profile" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
drop policy if exists "Coaches create own opportunities" on public.opportunities;
drop policy if exists "Coaches update own opportunities" on public.opportunities;
drop policy if exists "Coaches delete own opportunities" on public.opportunities;
drop policy if exists "Organizers create own opportunities" on public.opportunities;
drop policy if exists "Organizers update own opportunities" on public.opportunities;
drop policy if exists "Organizers delete own opportunities" on public.opportunities;
drop policy if exists "Athletes create interests for published opportunities" on public.opportunity_interests;
drop policy if exists "Athletes read own interests" on public.opportunity_interests;
drop policy if exists "Coaches read interests for own opportunities" on public.opportunity_interests;
drop policy if exists "Coaches update interests for own opportunities" on public.opportunity_interests;
drop policy if exists "Users create interests for published opportunities" on public.opportunity_interests;
drop policy if exists "Users read own interests" on public.opportunity_interests;
drop policy if exists "Organizers read interests for own opportunities" on public.opportunity_interests;
drop policy if exists "Organizers update interests for own opportunities" on public.opportunity_interests;

create policy "Admins manage profiles"
on public.profiles for all
using (public.is_admin())
with check (public.is_admin());

create policy "Users read own profile"
on public.profiles for select
using (id = auth.uid() or public.is_admin());

create policy "Organizers read interested user profiles"
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
with check (id = auth.uid() and is_admin = false);

create policy "Users update own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid() and is_admin = false);

create policy "Organizers create own opportunities"
on public.opportunities for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles
    where id = auth.uid()
      and wants_to_create_opportunities = true
  )
);

create policy "Organizers update own opportunities"
on public.opportunities for update
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

create policy "Organizers delete own opportunities"
on public.opportunities for delete
using (created_by = auth.uid() or public.is_admin());

create policy "Users create interests for published opportunities"
on public.opportunity_interests for insert
with check (
  athlete_id = auth.uid()
  and exists (
    select 1 from public.profiles
    where id = auth.uid()
      and wants_to_join_opportunities = true
  )
  and exists (
    select 1 from public.opportunities
    where id = opportunity_id
      and status = 'published'
      and available_spots > 0
  )
);

create policy "Users read own interests"
on public.opportunity_interests for select
using (athlete_id = auth.uid() or public.is_admin());

create policy "Organizers read interests for own opportunities"
on public.opportunity_interests for select
using (
  public.is_admin()
  or exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id and o.created_by = auth.uid()
  )
);

create policy "Organizers update interests for own opportunities"
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
  organizer.full_name as coach_name
from public.opportunities o
join public.tunnel_profiles t on t.id = o.tunnel_id
left join public.coach_profiles cp on cp.id = o.coach_id
left join public.profiles coach_profile on coach_profile.id = cp.user_id
left join public.profiles organizer on organizer.id = coalesce(coach_profile.id, o.created_by)
where o.status = 'published';

create or replace function public.notify_opportunity_audience()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  organizer_profile public.profiles%rowtype;
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
  into organizer_profile
  from public.profiles p
  where p.id = new.created_by;

  if new.type = 'huck_jam' then
    notification_title := 'New Huck Jam posted in ' || coalesce(tunnel_city, 'your area') || '.';
  else
    notification_title := coalesce(organizer_profile.full_name, 'An organizer') || ' posted a new camp in ' || coalesce(tunnel_city, 'your area') || '.';
  end if;

  insert into public.notifications (user_id, title, body, type, opportunity_id)
  select distinct p.id, notification_title, new.title, 'new_opportunity', new.id
  from public.profiles p
  where p.wants_to_join_opportunities = true
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
    where p.wants_to_join_opportunities = true
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
  where p.wants_to_join_opportunities = true
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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_name text;
  selected_purpose text;
begin
  selected_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(new.email, '@', 1),
    'Flyloop user'
  );
  selected_purpose := coalesce(nullif(new.raw_user_meta_data->>'flyloop_purpose', ''), 'join');

  insert into public.profiles (
    id,
    full_name,
    country,
    phone,
    whatsapp_number,
    instagram_handle,
    wants_to_join_opportunities,
    wants_to_create_opportunities,
    is_admin
  ) values (
    new.id,
    selected_name,
    nullif(new.raw_user_meta_data->>'country', ''),
    nullif(new.raw_user_meta_data->>'phone', ''),
    nullif(new.raw_user_meta_data->>'whatsapp_number', ''),
    nullif(new.raw_user_meta_data->>'instagram_handle', ''),
    selected_purpose in ('join', 'both'),
    selected_purpose in ('create', 'both'),
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop index if exists profiles_role_idx;

alter table public.profiles
  drop column if exists role,
  drop column if exists disciplines;

drop type if exists public.user_role;
