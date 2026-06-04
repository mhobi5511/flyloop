create or replace function public.flyloop_notification_copy(
  notification_type text,
  opportunity_title text default null,
  actor_name text default null,
  total_minutes integer default null,
  tunnel_name text default null,
  coach_name text default null,
  status_value text default null,
  has_timetable boolean default false
)
returns table(title text, body text)
language sql
stable
as $$
  select
    case
      when notification_type = 'application_status' and status_value = 'accepted' then '🎉 You''re in!'
      when notification_type = 'application_status' and status_value = 'declined' then 'Application update'
      when notification_type = 'application_status' and status_value = 'waitlist' then 'You''re on the waitlist'
      when notification_type = 'application_status' then 'Application update'
      when notification_type = 'timetable_published' then '⏰ Times are live'
      when notification_type = 'timetable_booking_reminder' then 'Don''t forget your slots'
      when notification_type = 'timetable_booking_changed' then '⚠️ Your schedule changed'
      when notification_type in (
        'slot_bookings_released',
        'slot_bookings_released_by_organizer',
        'slot_booking_released_by_organizer'
      ) then '⚠️ Your schedule changed'
      when notification_type = 'new_time_booking' then '🛫 New flyer booked time'
      when notification_type = 'timetable_reminder_interest' then 'Someone is waiting for your timetable'
      when notification_type = 'new_interest' then 'New flyer wants in'
      when notification_type = 'new_opportunity_tunnel' then 'New session at ' || coalesce(nullif(tunnel_name, ''), 'your tunnel')
      when notification_type = 'new_opportunity' then 'New camp from ' || coalesce(nullif(coach_name, ''), 'a coach')
      when notification_type = 'last_minute' then 'Still time to join'
      else coalesce(nullif(opportunity_title, ''), 'Flyloop update')
    end as title,
    case
      when notification_type = 'application_status' and status_value = 'accepted' and has_timetable then
        'Your spot is confirmed. Book your flying times now.'
      when notification_type = 'application_status' and status_value = 'accepted' then
        'Your spot for ' || coalesce(nullif(opportunity_title, ''), 'this opportunity') || ' is confirmed.'
      when notification_type = 'application_status' and status_value = 'declined' then
        'Unfortunately, there wasn''t a spot available for ' || coalesce(nullif(opportunity_title, ''), 'this opportunity') || '.'
      when notification_type = 'application_status' and status_value = 'waitlist' then
        'A spot may still open up for ' || coalesce(nullif(opportunity_title, ''), 'this opportunity') || '.'
      when notification_type = 'application_status' then
        'There is an update for ' || coalesce(nullif(opportunity_title, ''), 'this opportunity') || '.'
      when notification_type = 'timetable_published' then
        'Select your flying slots for ' || coalesce(nullif(opportunity_title, ''), 'this opportunity') || '.'
      when notification_type = 'timetable_booking_reminder' then
        'Please select your flying times for ' || coalesce(nullif(opportunity_title, ''), 'this opportunity') || '.'
      when notification_type = 'timetable_booking_changed' then
        'One or more of your booked times for ' || coalesce(nullif(opportunity_title, ''), 'this opportunity') || ' were removed.'
      when notification_type in (
        'slot_bookings_released',
        'slot_bookings_released_by_organizer',
        'slot_booking_released_by_organizer'
      ) then
        'One or more of your booked times for ' || coalesce(nullif(opportunity_title, ''), 'this opportunity') || ' were removed.'
      when notification_type = 'new_time_booking' then
        coalesce(nullif(actor_name, ''), 'A flyer') || ' booked ' || coalesce(total_minutes, 0) || ' min for ' ||
          coalesce(nullif(opportunity_title, ''), 'this opportunity') || '.'
      when notification_type = 'timetable_reminder_interest' then
        coalesce(nullif(actor_name, ''), 'Someone') || ' wants to book times for ' ||
          coalesce(nullif(opportunity_title, ''), 'this opportunity') || '.'
      when notification_type = 'new_interest' then
        coalesce(nullif(actor_name, ''), 'A flyer') || ' applied for ' ||
          coalesce(nullif(opportunity_title, ''), 'your opportunity') || '.'
      when notification_type in ('new_opportunity', 'new_opportunity_tunnel') then
        coalesce(nullif(opportunity_title, ''), 'A new opportunity') || ' is now open.'
      when notification_type = 'last_minute' then
        coalesce(nullif(opportunity_title, ''), 'An opportunity') || ' still has open spots at ' ||
          coalesce(nullif(tunnel_name, ''), 'the tunnel') || '.'
      else
        coalesce(nullif(opportunity_title, ''), 'Open Flyloop to see what changed.')
    end as body;
$$;

create or replace function public.notify_organizer_of_new_interest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  organizer_id uuid;
  opportunity_title text;
  athlete_name text;
  copy record;
begin
  if new.interest_type = 'timetable_reminder' then
    return new;
  end if;

  select o.created_by, o.title
  into organizer_id, opportunity_title
  from public.opportunities o
  where o.id = new.opportunity_id;

  if organizer_id is null or organizer_id = new.athlete_id then
    return new;
  end if;

  select p.full_name
  into athlete_name
  from public.profiles p
  where p.id = new.athlete_id;

  select *
  into copy
  from public.flyloop_notification_copy(
    notification_type := 'new_interest',
    opportunity_title := opportunity_title,
    actor_name := athlete_name
  );

  insert into public.notifications (user_id, title, body, type, opportunity_id)
  values (
    organizer_id,
    copy.title,
    copy.body,
    'new_interest',
    new.opportunity_id
  );

  return new;
end;
$$;

create or replace function public.notify_athlete_of_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  opportunity_title text;
  has_published_timetable boolean;
  copy record;
begin
  if old.interest_type = 'timetable_reminder'
    or new.interest_type = 'timetable_reminder'
  then
    return new;
  end if;

  if old.status is not distinct from new.status then
    return new;
  end if;

  select
    o.title,
    exists (
      select 1
      from public.opportunity_time_slots ots
      where ots.opportunity_id = o.id
        and ots.is_published = true
    )
  into opportunity_title, has_published_timetable
  from public.opportunities o
  where o.id = new.opportunity_id;

  select *
  into copy
  from public.flyloop_notification_copy(
    notification_type := 'application_status',
    opportunity_title := opportunity_title,
    status_value := new.status::text,
    has_timetable := coalesce(has_published_timetable, false)
  );

  insert into public.notifications (user_id, title, body, type, opportunity_id)
  values (
    new.athlete_id,
    copy.title,
    copy.body,
    'application_status',
    new.opportunity_id
  );

  return new;
end;
$$;

create or replace function public.notify_timetable_published(target_opportunity_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  opportunity_record public.opportunities%rowtype;
  inserted_count integer;
  copy record;
begin
  select *
  into opportunity_record
  from public.opportunities
  where id = target_opportunity_id;

  if not found then
    return 0;
  end if;

  if auth.uid() is null or opportunity_record.created_by <> auth.uid() then
    raise exception 'Not authorized to publish this timetable'
      using errcode = '42501';
  end if;

  select *
  into copy
  from public.flyloop_notification_copy(
    notification_type := 'timetable_published',
    opportunity_title := opportunity_record.title
  );

  insert into public.notifications (user_id, title, body, type, opportunity_id)
  select distinct
    oi.athlete_id,
    copy.title,
    copy.body,
    'timetable_published',
    target_opportunity_id
  from public.opportunity_interests oi
  where oi.opportunity_id = target_opportunity_id
    and (
      oi.status = 'accepted'
      or oi.interest_type = 'timetable_reminder'
    )
    and oi.athlete_id <> opportunity_record.created_by
    and not exists (
      select 1
      from public.notifications n
      where n.user_id = oi.athlete_id
        and n.opportunity_id = target_opportunity_id
        and n.type = 'timetable_published'
    );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke execute on function public.notify_timetable_published(uuid) from public;
revoke execute on function public.notify_timetable_published(uuid) from anon;
grant execute on function public.notify_timetable_published(uuid) to authenticated;

create or replace function public.notify_timetable_bookings_changed(
  target_opportunity_id uuid,
  affected_user_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  opportunity_record public.opportunities%rowtype;
  inserted_count integer;
  copy record;
begin
  select *
  into opportunity_record
  from public.opportunities
  where id = target_opportunity_id;

  if not found then
    return 0;
  end if;

  if auth.uid() is null or opportunity_record.created_by <> auth.uid() then
    raise exception 'Not authorized to notify timetable changes'
      using errcode = '42501';
  end if;

  select *
  into copy
  from public.flyloop_notification_copy(
    notification_type := 'timetable_booking_changed',
    opportunity_title := opportunity_record.title
  );

  insert into public.notifications (user_id, title, body, type, opportunity_id)
  select distinct
    affected_user_id,
    copy.title,
    copy.body,
    'timetable_booking_changed',
    target_opportunity_id
  from unnest(coalesce(affected_user_ids, '{}'::uuid[])) as affected_user_id
  where affected_user_id <> opportunity_record.created_by
    and exists (
      select 1
      from public.opportunity_interests oi
      where oi.opportunity_id = target_opportunity_id
        and oi.athlete_id = affected_user_id
        and oi.status = 'accepted'
    );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke execute on function public.notify_timetable_bookings_changed(uuid, uuid[]) from public;
revoke execute on function public.notify_timetable_bookings_changed(uuid, uuid[]) from anon;
grant execute on function public.notify_timetable_bookings_changed(uuid, uuid[]) to authenticated;

create or replace function public.notify_timetable_booking_reminder(
  target_opportunity_id uuid,
  target_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  opportunity_record public.opportunities%rowtype;
  inserted_count integer;
  copy record;
begin
  select *
  into opportunity_record
  from public.opportunities
  where id = target_opportunity_id;

  if not found then
    return 0;
  end if;

  if auth.uid() is null or opportunity_record.created_by <> auth.uid() then
    raise exception 'Not authorized to send timetable reminders'
      using errcode = '42501';
  end if;

  if target_user_id = opportunity_record.created_by then
    return 0;
  end if;

  if exists (
    select 1
    from public.notifications n
    where n.user_id = target_user_id
      and n.opportunity_id = target_opportunity_id
      and n.type = 'timetable_booking_reminder'
  ) then
    return 0;
  end if;

  if not exists (
    select 1
    from public.opportunity_time_slots ots
    where ots.opportunity_id = target_opportunity_id
      and ots.is_published = true
  ) then
    return 0;
  end if;

  if not exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = target_opportunity_id
      and oi.athlete_id = target_user_id
      and oi.status = 'accepted'
  ) then
    return 0;
  end if;

  if exists (
    select 1
    from public.opportunity_slot_bookings osb
    where osb.opportunity_id = target_opportunity_id
      and osb.user_id = target_user_id
  ) then
    return 0;
  end if;

  select *
  into copy
  from public.flyloop_notification_copy(
    notification_type := 'timetable_booking_reminder',
    opportunity_title := opportunity_record.title
  );

  insert into public.notifications (user_id, title, body, type, opportunity_id)
  select
    target_user_id,
    copy.title,
    copy.body,
    'timetable_booking_reminder',
    target_opportunity_id
  where not exists (
    select 1
    from public.notifications n
    where n.user_id = target_user_id
      and n.opportunity_id = target_opportunity_id
      and n.type = 'timetable_booking_reminder'
  )
  on conflict do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke execute on function public.notify_timetable_booking_reminder(uuid, uuid) from public;
revoke execute on function public.notify_timetable_booking_reminder(uuid, uuid) from anon;
grant execute on function public.notify_timetable_booking_reminder(uuid, uuid) to authenticated;

create or replace function public.release_slot_bookings_when_not_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  opportunity_title text;
  released_count integer;
  copy record;
begin
  if old.status <> 'accepted' or new.status = 'accepted' then
    return new;
  end if;

  delete from public.opportunity_slot_bookings osb
  where osb.opportunity_id = new.opportunity_id
    and osb.user_id = new.athlete_id;

  get diagnostics released_count = row_count;

  if released_count > 0 then
    select o.title
    into opportunity_title
    from public.opportunities o
    where o.id = new.opportunity_id;

    select *
    into copy
    from public.flyloop_notification_copy(
      notification_type := 'slot_bookings_released',
      opportunity_title := opportunity_title
    );

    insert into public.notifications (user_id, title, body, type, opportunity_id)
    values (
      new.athlete_id,
      copy.title,
      copy.body,
      'slot_bookings_released',
      new.opportunity_id
    );
  end if;

  return new;
end;
$$;

create or replace function public.release_participant_slot_bookings(
  target_opportunity_id uuid,
  target_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  opportunity_record public.opportunities%rowtype;
  released_count integer;
  copy record;
begin
  select *
  into opportunity_record
  from public.opportunities
  where id = target_opportunity_id;

  if not found then
    return 0;
  end if;

  if auth.uid() is null or opportunity_record.created_by <> auth.uid() then
    raise exception 'Not authorized to release timetable bookings'
      using errcode = '42501';
  end if;

  if target_user_id = opportunity_record.created_by then
    return 0;
  end if;

  delete from public.opportunity_slot_bookings osb
  where osb.opportunity_id = target_opportunity_id
    and osb.user_id = target_user_id;

  get diagnostics released_count = row_count;

  if released_count > 0 then
    select *
    into copy
    from public.flyloop_notification_copy(
      notification_type := 'slot_bookings_released_by_organizer',
      opportunity_title := opportunity_record.title
    );

    insert into public.notifications (user_id, title, body, type, opportunity_id)
    values (
      target_user_id,
      copy.title,
      copy.body,
      'slot_bookings_released_by_organizer',
      target_opportunity_id
    );
  end if;

  return released_count;
end;
$$;

revoke execute on function public.release_participant_slot_bookings(uuid, uuid) from public;
revoke execute on function public.release_participant_slot_bookings(uuid, uuid) from anon;
grant execute on function public.release_participant_slot_bookings(uuid, uuid) to authenticated;

create or replace function public.release_opportunity_slot_booking(
  target_opportunity_id uuid,
  target_booking_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  opportunity_record public.opportunities%rowtype;
  booking_record public.opportunity_slot_bookings%rowtype;
  released_count integer;
  copy record;
begin
  select *
  into opportunity_record
  from public.opportunities
  where id = target_opportunity_id;

  if not found then
    return 0;
  end if;

  if auth.uid() is null or opportunity_record.created_by <> auth.uid() then
    raise exception 'Not authorized to release timetable bookings'
      using errcode = '42501';
  end if;

  select *
  into booking_record
  from public.opportunity_slot_bookings
  where id = target_booking_id
    and opportunity_id = target_opportunity_id;

  if not found then
    return 0;
  end if;

  if booking_record.user_id = opportunity_record.created_by then
    return 0;
  end if;

  delete from public.opportunity_slot_bookings osb
  where osb.id = target_booking_id
    and osb.opportunity_id = target_opportunity_id;

  get diagnostics released_count = row_count;

  if released_count > 0 then
    select *
    into copy
    from public.flyloop_notification_copy(
      notification_type := 'slot_booking_released_by_organizer',
      opportunity_title := opportunity_record.title
    );

    insert into public.notifications (user_id, title, body, type, opportunity_id)
    values (
      booking_record.user_id,
      copy.title,
      copy.body,
      'slot_booking_released_by_organizer',
      target_opportunity_id
    );
  end if;

  return released_count;
end;
$$;

revoke execute on function public.release_opportunity_slot_booking(uuid, uuid) from public;
revoke execute on function public.release_opportunity_slot_booking(uuid, uuid) from anon;
grant execute on function public.release_opportunity_slot_booking(uuid, uuid) to authenticated;

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

  insert into public.notifications (user_id, title, body, type, opportunity_id)
  select distinct
    p.id,
    copy.title,
    copy.body,
    'new_opportunity',
    new.id
  from public.profiles p
  cross join lateral public.flyloop_notification_copy(
    notification_type := case
      when exists (
        select 1 from public.follows tunnel_follow
        where tunnel_follow.follower_id = p.id
          and tunnel_follow.target_type = 'tunnel'
          and tunnel_follow.target_id = new.tunnel_id
      ) then 'new_opportunity_tunnel'
      else 'new_opportunity'
    end,
    opportunity_title := new.title,
    tunnel_name := tunnel_record.name,
    coach_name := organizer_profile.full_name
  ) as copy
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
    copy.title,
    copy.body,
    'last_minute',
    o.id
  from public.opportunities o
  join public.tunnel_profiles t on t.id = o.tunnel_id
  left join public.coach_profiles cp on cp.id = o.coach_id
  cross join public.profiles p
  cross join lateral public.flyloop_notification_copy(
    notification_type := 'last_minute',
    opportunity_title := o.title,
    tunnel_name := t.name
  ) as copy
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

revoke execute on function public.create_last_minute_notifications() from public;
revoke execute on function public.create_last_minute_notifications() from anon;
grant execute on function public.create_last_minute_notifications() to authenticated;

create or replace function public.notify_organizer_of_timetable_reminder_interest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  organizer_id uuid;
  opportunity_title text;
  athlete_name text;
  has_published_timetable boolean;
  copy record;
begin
  if new.interest_type <> 'timetable_reminder' then
    return new;
  end if;

  select
    o.created_by,
    o.title,
    exists (
      select 1
      from public.opportunity_time_slots ots
      where ots.opportunity_id = o.id
        and ots.is_published = true
    )
  into organizer_id, opportunity_title, has_published_timetable
  from public.opportunities o
  where o.id = new.opportunity_id
    and o.booking_mode = 'direct_time_booking';

  if organizer_id is null
    or organizer_id = new.athlete_id
    or has_published_timetable
  then
    return new;
  end if;

  select p.full_name
  into athlete_name
  from public.profiles p
  where p.id = new.athlete_id;

  select *
  into copy
  from public.flyloop_notification_copy(
    notification_type := 'timetable_reminder_interest',
    opportunity_title := opportunity_title,
    actor_name := athlete_name
  );

  insert into public.notifications (user_id, title, body, type, opportunity_id)
  values (
    organizer_id,
    copy.title,
    copy.body,
    'timetable_reminder_interest',
    new.opportunity_id
  );

  return new;
end;
$$;

create or replace function public.book_opportunity_slots(
  target_opportunity_id uuid,
  target_slot_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  target_slot_id uuid;
  slot_record public.opportunity_time_slots%rowtype;
  opportunity_record public.opportunities%rowtype;
  interest_record public.opportunity_interests%rowtype;
  current_booking_count integer;
  inserted_count integer := 0;
  booked_minutes integer := 0;
  participant_name text;
  copy record;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Please log in again'
      using errcode = '42501';
  end if;

  if coalesce(array_length(target_slot_ids, 1), 0) = 0 then
    raise exception 'Select at least one slot';
  end if;

  select *
  into opportunity_record
  from public.opportunities
  where id = target_opportunity_id
  for update;

  if not found then
    raise exception 'This opportunity is no longer available';
  end if;

  if opportunity_record.status <> 'published' then
    raise exception 'This opportunity is no longer available';
  end if;

  if opportunity_record.created_by = current_user_id then
    raise exception 'You manage this opportunity from the organizer dashboard'
      using errcode = '42501';
  end if;

  select *
  into interest_record
  from public.opportunity_interests oi
  where oi.opportunity_id = target_opportunity_id
    and oi.athlete_id = current_user_id
  for update;

  if opportunity_record.booking_mode = 'approval_required' then
    if not found or interest_record.status <> 'accepted' then
      raise exception 'Only accepted participants can book slots'
        using errcode = '42501';
    end if;
  else
    if found
      and interest_record.status <> 'accepted'
      and interest_record.interest_type <> 'timetable_reminder'
    then
      raise exception 'This participation cannot book slots'
        using errcode = '42501';
    end if;

    if not found then
      insert into public.opportunity_interests (
        opportunity_id,
        athlete_id,
        status,
        interest_type
      ) values (
        target_opportunity_id,
        current_user_id,
        'accepted',
        'application'
      );
    elsif interest_record.interest_type = 'timetable_reminder' then
      update public.opportunity_interests
      set
        status = 'accepted',
        interest_type = 'application'
      where id = interest_record.id;
    end if;
  end if;

  for target_slot_id in
    select distinct unnest(target_slot_ids)
    order by 1
  loop
    select *
    into slot_record
    from public.opportunity_time_slots ots
    where ots.id = target_slot_id
      and ots.opportunity_id = target_opportunity_id
      and ots.is_published = true
    for update;

    if not found then
      raise exception 'Slot is no longer available';
    end if;

    if exists (
      select 1
      from public.opportunity_slot_bookings osb
      where osb.slot_id = target_slot_id
        and osb.user_id = current_user_id
    ) then
      raise exception 'You already booked one of these slots';
    end if;

    select count(*)
    into current_booking_count
    from public.opportunity_slot_bookings osb
    where osb.slot_id = target_slot_id;

    if current_booking_count >= slot_record.capacity then
      raise exception 'One of these slots is full';
    end if;

    insert into public.opportunity_slot_bookings (
      slot_id,
      opportunity_id,
      user_id,
      minutes
    ) values (
      target_slot_id,
      target_opportunity_id,
      current_user_id,
      slot_record.duration_minutes
    );

    inserted_count := inserted_count + 1;
    booked_minutes := booked_minutes + slot_record.duration_minutes;
  end loop;

  if inserted_count > 0 then
    select coalesce(nullif(trim(full_name), ''), 'A participant')
    into participant_name
    from public.profiles
    where id = current_user_id;

    select *
    into copy
    from public.flyloop_notification_copy(
      notification_type := 'new_time_booking',
      opportunity_title := opportunity_record.title,
      actor_name := participant_name,
      total_minutes := booked_minutes
    );

    insert into public.notifications (user_id, title, body, type, opportunity_id)
    values (
      opportunity_record.created_by,
      copy.title,
      copy.body,
      'new_time_booking',
      target_opportunity_id
    );
  end if;

  return inserted_count;
end;
$$;

revoke execute on function public.book_opportunity_slots(uuid, uuid[]) from public;
revoke execute on function public.book_opportunity_slots(uuid, uuid[]) from anon;
grant execute on function public.book_opportunity_slots(uuid, uuid[]) to authenticated;
