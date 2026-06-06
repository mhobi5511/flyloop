create or replace function public.is_opportunity_booking_change_open(
  opportunity_record public.opportunities
)
returns boolean
language sql
stable
as $$
  select current_date <= coalesce(
    opportunity_record.registration_deadline,
    opportunity_record.start_date
  );
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

  if opportunity_record.type <> 'camp' then
    raise exception 'Huck Jams do not use slot booking'
      using errcode = '42501';
  end if;

  if not public.is_opportunity_booking_change_open(opportunity_record) then
    raise exception 'Booking changes are no longer available';
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

create or replace function public.release_own_opportunity_slot_booking(
  target_opportunity_id uuid,
  target_slot_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  opportunity_record public.opportunities%rowtype;
  released_count integer;
begin
  if current_user_id is null then
    raise exception 'Please log in again'
      using errcode = '42501';
  end if;

  select *
  into opportunity_record
  from public.opportunities
  where id = target_opportunity_id;

  if not found then
    raise exception 'This opportunity is no longer available';
  end if;

  if opportunity_record.type <> 'camp' then
    raise exception 'Huck Jams do not use slot booking'
      using errcode = '42501';
  end if;

  if not public.is_opportunity_booking_change_open(opportunity_record) then
    raise exception 'Booking changes are no longer available';
  end if;

  delete from public.opportunity_slot_bookings osb
  where osb.opportunity_id = target_opportunity_id
    and osb.slot_id = target_slot_id
    and osb.user_id = current_user_id;

  get diagnostics released_count = row_count;

  return released_count;
end;
$$;

revoke execute on function public.is_opportunity_booking_change_open(public.opportunities) from public;
revoke execute on function public.is_opportunity_booking_change_open(public.opportunities) from anon;
grant execute on function public.is_opportunity_booking_change_open(public.opportunities) to authenticated;

revoke execute on function public.release_own_opportunity_slot_booking(uuid, uuid) from public;
revoke execute on function public.release_own_opportunity_slot_booking(uuid, uuid) from anon;
grant execute on function public.release_own_opportunity_slot_booking(uuid, uuid) to authenticated;
