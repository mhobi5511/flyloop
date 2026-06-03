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

  insert into public.notifications (user_id, title, body, type, opportunity_id)
  values (
    target_user_id,
    'Your timetable is available. Please select your times.',
    'Your timetable is available. Please select your times.',
    'timetable_booking_reminder',
    target_opportunity_id
  );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke execute on function public.notify_timetable_booking_reminder(uuid, uuid) from public;
revoke execute on function public.notify_timetable_booking_reminder(uuid, uuid) from anon;
grant execute on function public.notify_timetable_booking_reminder(uuid, uuid) to authenticated;

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
    insert into public.notifications (user_id, title, body, type, opportunity_id)
    values (
      target_user_id,
      'Your booked times were released.',
      'Your booked times for ' || coalesce(opportunity_record.title, 'this opportunity') || ' were released by the organizer. Please choose new times if needed.',
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
