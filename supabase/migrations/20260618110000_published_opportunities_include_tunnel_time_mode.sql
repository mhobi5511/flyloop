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
  organizer.profile_image_url as coach_profile_image_url,
  exists (
    select 1
    from public.follows f
    where f.follower_id = auth.uid()
      and f.target_type = 'coach'
      and f.target_id = coalesce(coach_profile.id, o.created_by)
  ) as is_followed_coach,
  exists (
    select 1
    from public.opportunity_time_slots ots
    where ots.opportunity_id = o.id
      and ots.is_published = true
      and o.type = 'camp'
  ) as has_published_timetable,
  case
    when o.type = 'camp' then greatest(
      coalesce((
        select sum(ots.duration_minutes * ots.capacity)
        from public.opportunity_time_slots ots
        where ots.opportunity_id = o.id
          and ots.is_published = true
      ), 0) -
      coalesce((
        select sum(osb.minutes)
        from public.opportunity_slot_bookings osb
        where osb.opportunity_id = o.id
      ), 0),
      0
    )::integer
    else 0
  end as remaining_timetable_minutes
from public.opportunities o
join public.tunnel_profiles t on t.id = o.tunnel_id
left join public.coach_profiles cp on cp.id = o.coach_id
left join public.profiles coach_profile on coach_profile.id = cp.user_id
left join public.profiles organizer on organizer.id = coalesce(coach_profile.id, o.created_by)
where o.status in ('published', 'full');

grant select on public.published_opportunities_with_context to anon, authenticated;
