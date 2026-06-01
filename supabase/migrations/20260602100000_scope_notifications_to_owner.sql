drop policy if exists "Users read own notifications" on public.notifications;
drop policy if exists "Users update own notifications" on public.notifications;
drop policy if exists "Admins manage notifications" on public.notifications;

create policy "Users read own notifications"
on public.notifications for select
using (user_id = auth.uid());

create policy "Users update own notifications"
on public.notifications for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

delete from public.notifications n
using public.opportunities o
where n.opportunity_id = o.id
  and n.type in ('new_opportunity', 'last_minute')
  and (
    n.user_id = o.created_by
    or (
      not exists (
        select 1
        from public.follows f
        where f.follower_id = n.user_id
          and f.target_type = 'coach'
          and f.target_id = coalesce(
            (select cp.user_id from public.coach_profiles cp where cp.id = o.coach_id),
            o.created_by
          )
      )
      and not exists (
        select 1
        from public.follows f
        where f.follower_id = n.user_id
          and f.target_type = 'tunnel'
          and f.target_id = o.tunnel_id
      )
    )
  );

delete from public.notifications n
using public.opportunities o
where n.opportunity_id = o.id
  and n.type = 'new_interest'
  and n.user_id <> o.created_by;

delete from public.notifications n
where n.opportunity_id is not null
  and n.type = 'application_status'
  and not exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = n.opportunity_id
      and oi.athlete_id = n.user_id
  );

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
    );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;
