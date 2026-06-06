create or replace function public.notify_organizer_of_new_interest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  organizer_id uuid;
  opportunity_title text;
  opportunity_booking_mode public.opportunity_booking_mode;
  athlete_name text;
  copy record;
begin
  if new.interest_type = 'timetable_reminder' then
    return new;
  end if;

  select o.created_by, o.title, o.booking_mode
  into organizer_id, opportunity_title, opportunity_booking_mode
  from public.opportunities o
  where o.id = new.opportunity_id;

  if opportunity_booking_mode <> 'approval_required' then
    return new;
  end if;

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

create or replace function public.guard_opportunity_slot_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  slot_record public.opportunity_time_slots%rowtype;
  opportunity_owner uuid;
  current_booking_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authorized to book this slot'
      using errcode = '42501';
  end if;

  select *
  into slot_record
  from public.opportunity_time_slots
  where id = new.slot_id
  for update;

  if not found then
    raise exception 'Slot does not exist';
  end if;

  select created_by
  into opportunity_owner
  from public.opportunities
  where id = slot_record.opportunity_id;

  if new.user_id <> auth.uid() and opportunity_owner <> auth.uid() then
    raise exception 'Not authorized to book this slot'
      using errcode = '42501';
  end if;

  if slot_record.opportunity_id <> new.opportunity_id then
    raise exception 'Booking opportunity must match slot opportunity';
  end if;

  if not exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = new.opportunity_id
      and oi.athlete_id = new.user_id
      and oi.status = 'accepted'
      and oi.interest_type <> 'timetable_reminder'
  ) then
    raise exception 'Only accepted participants can book slots'
      using errcode = '42501';
  end if;

  select count(*)
  into current_booking_count
  from public.opportunity_slot_bookings osb
  where osb.slot_id = new.slot_id
    and (tg_op <> 'UPDATE' or osb.id <> new.id);

  if current_booking_count >= slot_record.capacity then
    raise exception 'Slot is full';
  end if;

  return new;
end;
$$;

create or replace function public.assign_opportunity_slot_booking(
  target_opportunity_id uuid,
  target_slot_id uuid,
  target_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  opportunity_record public.opportunities%rowtype;
  slot_record public.opportunity_time_slots%rowtype;
  current_booking_count integer;
  inserted_booking_id uuid;
  coach_name text;
begin
  if current_user_id is null then
    raise exception 'Please log in again'
      using errcode = '42501';
  end if;

  select *
  into opportunity_record
  from public.opportunities
  where id = target_opportunity_id
  for update;

  if not found then
    raise exception 'Opportunity not found';
  end if;

  if opportunity_record.type <> 'camp' then
    raise exception 'Assign Slot is only available for Camps';
  end if;

  if opportunity_record.created_by <> current_user_id then
    raise exception 'Only the coach can assign slots'
      using errcode = '42501';
  end if;

  if target_user_id = opportunity_record.created_by then
    raise exception 'The organizer cannot be assigned as a participant';
  end if;

  select *
  into slot_record
  from public.opportunity_time_slots
  where id = target_slot_id
    and opportunity_id = target_opportunity_id
    and is_published = true
  for update;

  if not found then
    raise exception 'Slot is no longer available';
  end if;

  if not exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = target_opportunity_id
      and oi.athlete_id = target_user_id
      and oi.status = 'accepted'
      and oi.interest_type <> 'timetable_reminder'
  ) then
    raise exception 'Only accepted participants can be assigned';
  end if;

  if exists (
    select 1
    from public.opportunity_slot_bookings osb
    where osb.slot_id = target_slot_id
      and osb.user_id = target_user_id
  ) then
    raise exception 'This participant is already assigned to that slot';
  end if;

  select count(*)
  into current_booking_count
  from public.opportunity_slot_bookings osb
  where osb.slot_id = target_slot_id;

  if current_booking_count >= slot_record.capacity then
    raise exception 'Slot is full';
  end if;

  insert into public.opportunity_slot_bookings (
    slot_id,
    opportunity_id,
    user_id,
    minutes
  ) values (
    target_slot_id,
    target_opportunity_id,
    target_user_id,
    slot_record.duration_minutes
  )
  returning id into inserted_booking_id;

  select coalesce(nullif(trim(full_name), ''), 'Your coach')
  into coach_name
  from public.profiles
  where id = current_user_id;

  insert into public.notifications (user_id, title, body, type, opportunity_id)
  values (
    target_user_id,
    'You were assigned a flying time',
    coach_name || ' assigned you ' || slot_record.duration_minutes || ' min on ' ||
      to_char(slot_record.slot_date, 'Mon FMDD') || ' at ' ||
      to_char(slot_record.start_time, 'HH24:MI') || ' for ' ||
      opportunity_record.title || '.',
    'slot_booking_assigned_by_organizer',
    target_opportunity_id
  );

  return inserted_booking_id;
end;
$$;

revoke execute on function public.assign_opportunity_slot_booking(uuid, uuid, uuid) from public;
revoke execute on function public.assign_opportunity_slot_booking(uuid, uuid, uuid) from anon;
grant execute on function public.assign_opportunity_slot_booking(uuid, uuid, uuid) to authenticated;
