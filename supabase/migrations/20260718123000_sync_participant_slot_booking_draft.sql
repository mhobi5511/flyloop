-- Synchronize an accepted camp participant's coach-managed draft assignments in
-- one transaction. This replaces the Mass Booking UI's per-slot action loop.
create or replace function public.sync_participant_slot_booking_draft(
  target_opportunity_id uuid,
  target_user_id uuid,
  target_slot_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  opportunity_record public.opportunities%rowtype;
  normalized_slot_ids uuid[];
  slot_record record;
  selected_slot_count integer;
  current_booking_count integer;
  removed_count integer := 0;
  inserted_count integer := 0;
  notification_count integer := 0;
  notification_copy record;
begin
  if current_user_id is null then
    raise exception 'Please log in again'
      using errcode = '42501';
  end if;

  select *
  into opportunity_record
  from public.opportunities
  where id = target_opportunity_id
  for share;

  if not found then
    raise exception 'Opportunity not found';
  end if;

  if opportunity_record.type <> 'camp' then
    raise exception 'Mass Booking is only available for Camps';
  end if;

  if opportunity_record.created_by <> current_user_id then
    raise exception 'Only the coach can assign slots'
      using errcode = '42501';
  end if;

  if target_user_id is null or target_user_id = opportunity_record.created_by then
    raise exception 'Choose a valid participant';
  end if;

  if coalesce(cardinality(target_slot_ids), 0) > 500 then
    raise exception 'Choose no more than 500 slots at once';
  end if;

  perform oi.id
  from public.opportunity_interests oi
  where oi.opportunity_id = target_opportunity_id
    and oi.athlete_id = target_user_id
    and oi.status = 'accepted'
    and oi.interest_type <> 'timetable_reminder'
  for update;

  if not found then
    raise exception 'Only accepted participants can be assigned'
      using errcode = '42501';
  end if;

  select coalesce(array_agg(slot_id order by slot_id), '{}'::uuid[])
  into normalized_slot_ids
  from (
    select distinct requested_slot_id as slot_id
    from unnest(coalesce(target_slot_ids, '{}'::uuid[]))
      as requested_slots(requested_slot_id)
    where requested_slot_id is not null
  ) requested_slots;

  -- Lock in a deterministic order so concurrent assignments serialize at the
  -- individual slot instead of racing the capacity check.
  perform ots.id
  from public.opportunity_time_slots ots
  where ots.opportunity_id = target_opportunity_id
    and ots.id = any(normalized_slot_ids)
  order by ots.id
  for update;

  select count(*)::integer
  into selected_slot_count
  from public.opportunity_time_slots ots
  where ots.opportunity_id = target_opportunity_id
    and ots.id = any(normalized_slot_ids);

  if selected_slot_count <> cardinality(normalized_slot_ids) then
    raise exception 'One or more selected slots are no longer available';
  end if;

  -- Capacity includes final and draft assignments, matching the existing
  -- organizer assignment RPC and booking guard.
  for slot_record in
    select ots.id, ots.capacity, ots.duration_minutes
    from public.opportunity_time_slots ots
    where ots.opportunity_id = target_opportunity_id
      and ots.id = any(normalized_slot_ids)
      and not exists (
        select 1
        from public.opportunity_slot_bookings existing_booking
        where existing_booking.slot_id = ots.id
          and existing_booking.user_id = target_user_id
      )
    order by ots.id
  loop
    select count(*)::integer
    into current_booking_count
    from public.opportunity_slot_bookings osb
    where osb.slot_id = slot_record.id;

    if current_booking_count >= slot_record.capacity then
      raise exception 'One or more selected slots are full';
    end if;
  end loop;

  delete from public.opportunity_slot_bookings osb
  where osb.opportunity_id = target_opportunity_id
    and osb.user_id = target_user_id
    and not (osb.slot_id = any(normalized_slot_ids));

  get diagnostics removed_count = row_count;

  insert into public.opportunity_slot_bookings (
    slot_id,
    opportunity_id,
    user_id,
    minutes,
    is_final,
    finalized_at,
    release_requested_at,
    release_requested_by
  )
  select
    ots.id,
    target_opportunity_id,
    target_user_id,
    ots.duration_minutes,
    false,
    null,
    null,
    null
  from public.opportunity_time_slots ots
  where ots.opportunity_id = target_opportunity_id
    and ots.id = any(normalized_slot_ids)
    and not exists (
      select 1
      from public.opportunity_slot_bookings existing_booking
      where existing_booking.slot_id = ots.id
        and existing_booking.user_id = target_user_id
    )
  order by ots.id;

  get diagnostics inserted_count = row_count;

  -- The previous per-booking release RPC emitted this notification. Emit it
  -- once per atomic sync; the existing unread-notification trigger still
  -- suppresses duplicate unread notifications for the same camp.
  if removed_count > 0 then
    select *
    into notification_copy
    from public.flyloop_notification_copy(
      notification_type := 'slot_booking_released_by_organizer',
      opportunity_title := opportunity_record.title
    );

    insert into public.notifications (user_id, title, body, type, opportunity_id)
    values (
      target_user_id,
      notification_copy.title,
      notification_copy.body,
      'slot_booking_released_by_organizer',
      target_opportunity_id
    );

    get diagnostics notification_count = row_count;
  end if;

  return jsonb_build_object(
    'inserted_count', inserted_count,
    'removed_count', removed_count,
    'notification_created', notification_count > 0
  );
end;
$$;

comment on function public.sync_participant_slot_booking_draft(uuid, uuid, uuid[])
is 'Atomically synchronizes one accepted camp participant slot selection for the owning coach; new assignments remain draft.';

revoke execute on function public.sync_participant_slot_booking_draft(uuid, uuid, uuid[]) from public;
revoke execute on function public.sync_participant_slot_booking_draft(uuid, uuid, uuid[]) from anon;
grant execute on function public.sync_participant_slot_booking_draft(uuid, uuid, uuid[]) to authenticated;
