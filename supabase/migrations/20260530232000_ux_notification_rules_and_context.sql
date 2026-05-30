create or replace function public.notify_organizer_of_new_interest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  organizer_id uuid;
  opportunity_title text;
  opportunity_type public.opportunity_type;
  opportunity_start date;
  tunnel_name text;
  athlete_name text;
  date_text text;
begin
  select o.created_by, o.title, o.type, o.start_date, t.name
  into organizer_id, opportunity_title, opportunity_type, opportunity_start, tunnel_name
  from public.opportunities o
  join public.tunnel_profiles t on t.id = o.tunnel_id
  where o.id = new.opportunity_id;

  if organizer_id is null or organizer_id = new.athlete_id then
    return new;
  end if;

  select p.full_name
  into athlete_name
  from public.profiles p
  where p.id = new.athlete_id;

  date_text := case
    when opportunity_start is null then ''
    else ' on ' || to_char(opportunity_start, 'Mon FMDD')
  end;

  insert into public.notifications (user_id, title, body, type, opportunity_id)
  values (
    organizer_id,
    'New application for ' || coalesce(opportunity_title, 'your opportunity'),
    coalesce(athlete_name, 'An athlete') || ' applied to ' ||
      coalesce(opportunity_title, 'your opportunity') ||
      ' at ' || coalesce(tunnel_name, 'the tunnel') || date_text || '.',
    'new_interest',
    new.opportunity_id
  );

  return new;
end;
$$;

create or replace function public.notify_opportunity_audience()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  organizer_profile public.profiles%rowtype;
  tunnel_record public.tunnel_profiles%rowtype;
  coach_target_id uuid;
  notification_title text;
  notification_body text;
begin
  if new.status <> 'published' then
    return new;
  end if;

  select *
  into tunnel_record
  from public.tunnel_profiles
  where id = new.tunnel_id;

  select p.*
  into organizer_profile
  from public.profiles p
  where p.id = new.created_by;

  select coalesce(cp.user_id, new.created_by)
  into coach_target_id
  from public.coach_profiles cp
  where cp.id = new.coach_id;

  coach_target_id := coalesce(coach_target_id, new.created_by);

  if new.type = 'huck_jam' then
    notification_title := 'New Huck Jam: ' || new.title;
    notification_body := new.title || ' at ' || coalesce(tunnel_record.name, 'the tunnel') || '.';
  else
    notification_title := 'New camp from ' || coalesce(organizer_profile.full_name, 'an organizer');
    notification_body := new.title || ' at ' || coalesce(tunnel_record.name, 'the tunnel') || '.';
  end if;

  insert into public.notifications (user_id, title, body, type, opportunity_id)
  select distinct p.id, notification_title, notification_body, 'new_opportunity', new.id
  from public.profiles p
  where p.wants_to_join_opportunities = true
    and p.id <> new.created_by
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
          and f.target_type = 'coach'
          and f.target_id = coach_target_id
      )
      or exists (
        select 1 from public.follows f
        where f.follower_id = p.id
          and f.target_type = 'tunnel'
          and f.target_id = new.tunnel_id
      )
      or (
        p.use_location_recommendations = true
        and p.latitude is not null
        and p.longitude is not null
        and tunnel_record.latitude is not null
        and tunnel_record.longitude is not null
        and (
          6371 * acos(
            least(
              1,
              greatest(
                -1,
                cos(radians(p.latitude)) * cos(radians(tunnel_record.latitude)) *
                cos(radians(tunnel_record.longitude) - radians(p.longitude)) +
                sin(radians(p.latitude)) * sin(radians(tunnel_record.latitude))
              )
            )
          )
        ) <= coalesce(p.preferred_radius_km, 1000)
      )
    );

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
    o.title || ' still has open spots.',
    o.available_spots || ' spots remain at ' || coalesce(t.name, 'the tunnel') || '.',
    'last_minute',
    o.id
  from public.opportunities o
  join public.tunnel_profiles t on t.id = o.tunnel_id
  left join public.coach_profiles cp on cp.id = o.coach_id
  cross join public.profiles p
  where p.wants_to_join_opportunities = true
    and p.id <> o.created_by
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
    )
    and (
      exists (
        select 1 from public.follows f
        where f.follower_id = p.id
          and f.target_type = 'coach'
          and f.target_id = coalesce(cp.user_id, o.created_by)
      )
      or exists (
        select 1 from public.follows f
        where f.follower_id = p.id
          and f.target_type = 'tunnel'
          and f.target_id = o.tunnel_id
      )
      or (
        p.use_location_recommendations = true
        and p.latitude is not null
        and p.longitude is not null
        and t.latitude is not null
        and t.longitude is not null
        and (
          6371 * acos(
            least(
              1,
              greatest(
                -1,
                cos(radians(p.latitude)) * cos(radians(t.latitude)) *
                cos(radians(t.longitude) - radians(p.longitude)) +
                sin(radians(p.latitude)) * sin(radians(t.latitude))
              )
            )
          )
        ) <= coalesce(p.preferred_radius_km, 1000)
      )
    );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;
