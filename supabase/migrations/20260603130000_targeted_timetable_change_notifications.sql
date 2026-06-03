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

  insert into public.notifications (user_id, title, body, type, opportunity_id)
  select distinct
    affected_user_id,
    'Your booked time for ' || opportunity_record.title || ' changed.',
    'Please review your times.',
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
  current_booking_count integer;
  inserted_count integer := 0;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Please log in again'
      using errcode = '42501';
  end if;

  if coalesce(array_length(target_slot_ids, 1), 0) = 0 then
    raise exception 'Select at least one slot';
  end if;

  if not exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = target_opportunity_id
      and oi.athlete_id = current_user_id
      and oi.status = 'accepted'
  ) then
    raise exception 'Only accepted participants can book slots'
      using errcode = '42501';
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
  end loop;

  return inserted_count;
end;
$$;

revoke execute on function public.book_opportunity_slots(uuid, uuid[]) from public;
revoke execute on function public.book_opportunity_slots(uuid, uuid[]) from anon;
grant execute on function public.book_opportunity_slots(uuid, uuid[]) to authenticated;
