alter table public.profiles
  add column if not exists current_country text,
  add column if not exists current_city text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists region text,
  add column if not exists preferred_radius_km integer not null default 1000;

alter table public.tunnel_profiles
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists region text;

create index if not exists profiles_region_idx on public.profiles(region);
create index if not exists tunnel_profiles_region_idx on public.tunnel_profiles(region);

-- Coach follows use the organizer/profile user id as target_id across the app.
-- Older rows may have used coach_profiles.id, so normalize them before the
-- refreshed opportunity view starts checking follows by profile id.
delete from public.follows old_follow
using public.coach_profiles cp, public.follows existing_follow
where old_follow.target_type = 'coach'
  and old_follow.target_id = cp.id
  and existing_follow.follower_id = old_follow.follower_id
  and existing_follow.target_type = 'coach'
  and existing_follow.target_id = cp.user_id;

update public.follows f
set target_id = cp.user_id
from public.coach_profiles cp
where f.target_type = 'coach'
  and f.target_id = cp.id;

create or replace function public.recalculate_opportunity_availability(target_opportunity_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_count integer;
  capacity integer;
  remaining integer;
begin
  select total_capacity
  into capacity
  from public.opportunities
  where id = target_opportunity_id;

  if capacity is null then
    return;
  end if;

  select count(*)
  into accepted_count
  from public.opportunity_interests
  where opportunity_id = target_opportunity_id
    and status = 'accepted';

  remaining := greatest(capacity - accepted_count, 0);

  update public.opportunities
  set
    available_spots = remaining,
    status = case
      when status = 'cancelled' then status
      when remaining = 0 then 'full'::public.opportunity_status
      when status = 'full' and remaining > 0 then 'published'::public.opportunity_status
      else status
    end
  where id = target_opportunity_id;
end;
$$;

create or replace function public.handle_interest_availability_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_opportunity_availability(old.opportunity_id);
    return old;
  end if;

  perform public.recalculate_opportunity_availability(new.opportunity_id);
  return new;
end;
$$;

drop trigger if exists opportunity_interests_recalculate_availability on public.opportunity_interests;

create trigger opportunity_interests_recalculate_availability
after insert or update of status or delete on public.opportunity_interests
for each row execute function public.handle_interest_availability_change();

create or replace function public.prevent_opportunity_over_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  capacity integer;
  accepted_count integer;
begin
  if new.status <> 'accepted' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'accepted' then
    return new;
  end if;

  select total_capacity
  into capacity
  from public.opportunities
  where id = new.opportunity_id;

  if capacity is null then
    return new;
  end if;

  select count(*)
  into accepted_count
  from public.opportunity_interests
  where opportunity_id = new.opportunity_id
    and status = 'accepted'
    and (new.id is null or id <> new.id);

  if accepted_count >= capacity then
    raise exception 'Opportunity is full. Move the applicant to waitlist instead.';
  end if;

  return new;
end;
$$;

drop trigger if exists opportunity_interests_prevent_over_acceptance on public.opportunity_interests;

create trigger opportunity_interests_prevent_over_acceptance
before insert or update of status on public.opportunity_interests
for each row execute function public.prevent_opportunity_over_acceptance();

do $$
declare
  opportunity_record record;
begin
  for opportunity_record in select id from public.opportunities loop
    perform public.recalculate_opportunity_availability(opportunity_record.id);
  end loop;
end
$$;

drop view if exists public.published_opportunities_with_context;

create view public.published_opportunities_with_context as
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
  t.region as tunnel_region,
  t.latitude as tunnel_latitude,
  t.longitude as tunnel_longitude,
  cp.user_id as coach_user_id,
  coalesce(coach_profile.id, o.created_by) as coach_follow_id,
  organizer.full_name as coach_name,
  exists (
    select 1
    from public.follows f
    where f.follower_id = auth.uid()
      and f.target_type = 'coach'
      and f.target_id = coalesce(coach_profile.id, o.created_by)
  ) as is_followed_coach
from public.opportunities o
join public.tunnel_profiles t on t.id = o.tunnel_id
left join public.coach_profiles cp on cp.id = o.coach_id
left join public.profiles coach_profile on coach_profile.id = cp.user_id
left join public.profiles organizer on organizer.id = coalesce(coach_profile.id, o.created_by)
where o.status in ('published', 'full');

grant select on public.published_opportunities_with_context to anon, authenticated;
