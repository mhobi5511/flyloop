create or replace view public.public_user_profiles as
select
  p.id,
  p.full_name,
  p.country,
  p.city,
  p.bio,
  p.disciplines,
  p.profile_image_url,
  p.instagram_handle,
  p.home_tunnel_id,
  t.name as home_tunnel_name,
  t.city as home_tunnel_city,
  t.country as home_tunnel_country,
  p.website_url,
  p.youtube_url,
  p.wants_to_create_opportunities,
  p.created_at,
  (
    select count(*)::integer
    from public.opportunity_interests oi
    where oi.athlete_id = p.id
      and oi.status = 'accepted'
  ) as camps_attended,
  (
    select count(*)::integer
    from public.opportunities o
    where o.created_by = p.id
      and o.status <> 'cancelled'
  ) as camps_organized,
  (
    select count(*)::integer
    from public.opportunities o
    where o.created_by = p.id
      and o.type = 'camp'
      and o.status = 'published'
  ) as active_camps,
  (
    select count(*)::integer
    from public.opportunity_interests oi
    join public.opportunities o on o.id = oi.opportunity_id
    where o.created_by = p.id
  ) as total_applicants,
  (
    select count(*)::integer
    from public.opportunities o
    where o.created_by = p.id
      and o.status <> 'cancelled'
  ) as total_opportunities_organized
from public.profiles p
left join public.tunnel_profiles t on t.id = p.home_tunnel_id;

grant select on public.public_user_profiles to authenticated;
