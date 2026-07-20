create table if not exists public.opportunity_dummy_participants (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  coach_note text,
  phone text,
  email text,
  label text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists opportunity_dummy_participants_opportunity_idx
on public.opportunity_dummy_participants(opportunity_id, display_name);

drop trigger if exists opportunity_dummy_participants_set_updated_at on public.opportunity_dummy_participants;

create trigger opportunity_dummy_participants_set_updated_at
before update on public.opportunity_dummy_participants
for each row execute function public.set_updated_at();

alter table public.opportunity_slot_bookings
  add column if not exists dummy_participant_id uuid
    references public.opportunity_dummy_participants(id) on delete cascade;

alter table public.camp_day_preferences
  add column if not exists dummy_participant_id uuid
    references public.opportunity_dummy_participants(id) on delete cascade;

alter table public.opportunity_slot_booking_events
  add column if not exists dummy_participant_id uuid
    references public.opportunity_dummy_participants(id) on delete cascade,
  alter column user_id drop not null;

create unique index if not exists opportunity_slot_bookings_slot_dummy_uidx
on public.opportunity_slot_bookings(slot_id, dummy_participant_id)
where dummy_participant_id is not null;

create index if not exists opportunity_slot_bookings_opportunity_dummy_idx
on public.opportunity_slot_bookings(opportunity_id, dummy_participant_id)
where dummy_participant_id is not null;

create index if not exists opportunity_slot_booking_events_opportunity_dummy_idx
on public.opportunity_slot_booking_events(opportunity_id, dummy_participant_id, created_at)
where dummy_participant_id is not null;

create unique index if not exists camp_day_preferences_dummy_day_uidx
on public.camp_day_preferences(opportunity_id, dummy_participant_id, day_id)
where dummy_participant_id is not null;

create index if not exists camp_day_preferences_dummy_idx
on public.camp_day_preferences(dummy_participant_id)
where dummy_participant_id is not null;

alter table public.opportunity_slot_bookings
  drop constraint if exists opportunity_slot_bookings_profile_xor_dummy_check;

alter table public.opportunity_slot_bookings
  add constraint opportunity_slot_bookings_profile_xor_dummy_check
  check (
    (participant_profile_id is not null and dummy_participant_id is null)
    or (participant_profile_id is null and dummy_participant_id is not null)
  ) not valid;

alter table public.camp_day_preferences
  drop constraint if exists camp_day_preferences_profile_xor_dummy_check;

alter table public.camp_day_preferences
  add constraint camp_day_preferences_profile_xor_dummy_check
  check (
    dummy_participant_id is null
    or participant_profile_id is null
  ) not valid;

alter table public.opportunity_slot_booking_events
  drop constraint if exists opportunity_slot_booking_events_user_xor_dummy_check;

alter table public.opportunity_slot_booking_events
  add constraint opportunity_slot_booking_events_user_xor_dummy_check
  check (
    (user_id is not null and dummy_participant_id is null)
    or (user_id is null and dummy_participant_id is not null)
  ) not valid;

alter table public.opportunity_dummy_participants enable row level security;

drop policy if exists "Opportunity managers manage dummy participants" on public.opportunity_dummy_participants;

create policy "Opportunity managers manage dummy participants"
on public.opportunity_dummy_participants for all
using (public.can_manage_opportunity(opportunity_id))
with check (
  public.can_manage_opportunity(opportunity_id)
  and created_by = auth.uid()
);

grant select, insert, update, delete on public.opportunity_dummy_participants to authenticated;

revoke execute on function public.search_participant_profiles(uuid, text, integer) from public;
revoke execute on function public.search_participant_profiles(uuid, text, integer) from anon;
revoke execute on function public.search_participant_profiles(uuid, text, integer) from authenticated;

revoke execute on function public.add_participant_profile_to_opportunity(uuid, uuid, public.interest_status, text) from public;
revoke execute on function public.add_participant_profile_to_opportunity(uuid, uuid, public.interest_status, text) from anon;
revoke execute on function public.add_participant_profile_to_opportunity(uuid, uuid, public.interest_status, text) from authenticated;

revoke execute on function public.create_guest_participant_for_opportunity(uuid, text, text, text, text, text) from public;
revoke execute on function public.create_guest_participant_for_opportunity(uuid, text, text, text, text, text) from anon;
revoke execute on function public.create_guest_participant_for_opportunity(uuid, text, text, text, text, text) from authenticated;

revoke execute on function public.generate_participant_claim_token(uuid, uuid, text, text, interval) from public;
revoke execute on function public.generate_participant_claim_token(uuid, uuid, text, text, interval) from anon;
revoke execute on function public.generate_participant_claim_token(uuid, uuid, text, text, interval) from authenticated;

revoke execute on function public.claim_participant_profile(text) from public;
revoke execute on function public.claim_participant_profile(text) from anon;
revoke execute on function public.claim_participant_profile(text) from authenticated;

create or replace function public.create_opportunity_dummy_participant(
  target_opportunity_id uuid,
  display_name_value text,
  phone_value text default null,
  email_value text default null,
  coach_note_value text default null,
  label_value text default null
)
returns table (
  dummy_participant_id uuid,
  display_name text,
  phone text,
  email text,
  coach_note text,
  label text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  opportunity_record public.opportunities%rowtype;
  dummy_record public.opportunity_dummy_participants%rowtype;
  safe_display_name text := trim(coalesce(display_name_value, ''));
begin
  if auth.uid() is null then
    raise exception 'Please log in again'
      using errcode = '42501';
  end if;

  if safe_display_name = '' then
    raise exception 'Name is required';
  end if;

  select *
  into opportunity_record
  from public.opportunities
  where id = target_opportunity_id
  for share;

  if not found or opportunity_record.created_by <> auth.uid() then
    raise exception 'Opportunity not found'
      using errcode = '42501';
  end if;

  insert into public.opportunity_dummy_participants (
    opportunity_id,
    display_name,
    phone,
    email,
    coach_note,
    label,
    created_by
  ) values (
    target_opportunity_id,
    safe_display_name,
    nullif(trim(coalesce(phone_value, '')), ''),
    nullif(trim(coalesce(email_value, '')), ''),
    nullif(trim(coalesce(coach_note_value, '')), ''),
    nullif(trim(coalesce(label_value, '')), ''),
    auth.uid()
  )
  returning * into dummy_record;

  return query
  select
    dummy_record.id,
    dummy_record.display_name,
    dummy_record.phone,
    dummy_record.email,
    dummy_record.coach_note,
    dummy_record.label,
    dummy_record.created_at;
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
  current_booking_count integer;
begin
  if new.dummy_participant_id is not null and new.participant_profile_id is not null then
    raise exception 'Booking must reference exactly one participant type';
  end if;

  if new.dummy_participant_id is null and new.participant_profile_id is null then
    raise exception 'Booking must reference a participant';
  end if;

  select *
  into slot_record
  from public.opportunity_time_slots
  where id = new.slot_id
  for update;

  if not found then
    raise exception 'Slot does not exist';
  end if;

  if slot_record.opportunity_id <> new.opportunity_id then
    raise exception 'Booking opportunity must match slot opportunity';
  end if;

  if public.can_manage_opportunity(new.opportunity_id) then
    if new.dummy_participant_id is not null and not exists (
      select 1
      from public.opportunity_dummy_participants odp
      where odp.id = new.dummy_participant_id
        and odp.opportunity_id = new.opportunity_id
    ) then
      raise exception 'Choose a valid dummy participant';
    end if;
  elsif auth.uid() is null or new.user_id <> auth.uid() then
    raise exception 'Not authorized to book this slot'
      using errcode = '42501';
  end if;

  if new.participant_profile_id is not null and not exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = new.opportunity_id
      and oi.participant_profile_id = new.participant_profile_id
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

create or replace function public.log_opportunity_slot_booking_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  slot_record public.opportunity_time_slots%rowtype;
  booking_record public.opportunity_slot_bookings%rowtype;
begin
  if tg_op = 'INSERT' then
    booking_record := new;
  elsif tg_op = 'DELETE' then
    booking_record := old;
  else
    return null;
  end if;

  select *
  into slot_record
  from public.opportunity_time_slots
  where id = booking_record.slot_id;

  if not found then
    return null;
  end if;

  insert into public.opportunity_slot_booking_events (
    opportunity_id,
    user_id,
    dummy_participant_id,
    slot_id,
    event_type,
    slot_date,
    start_time,
    minutes,
    new_rotation_minutes
  ) values (
    booking_record.opportunity_id,
    booking_record.user_id,
    booking_record.dummy_participant_id,
    booking_record.slot_id,
    case when tg_op = 'INSERT' then 'booked' else 'removed' end,
    slot_record.slot_date,
    slot_record.start_time,
    booking_record.minutes,
    case when tg_op = 'INSERT' then booking_record.rotation_minutes else null end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.log_opportunity_slot_rotation_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  slot_record public.opportunity_time_slots%rowtype;
begin
  if old.rotation_minutes is not distinct from new.rotation_minutes then
    return new;
  end if;

  select *
  into slot_record
  from public.opportunity_time_slots
  where id = new.slot_id;

  if not found then
    return new;
  end if;

  insert into public.opportunity_slot_booking_events (
    opportunity_id,
    user_id,
    dummy_participant_id,
    slot_id,
    event_type,
    slot_date,
    start_time,
    minutes,
    previous_rotation_minutes,
    new_rotation_minutes
  ) values (
    new.opportunity_id,
    new.user_id,
    new.dummy_participant_id,
    new.slot_id,
    'rotation_changed',
    slot_record.slot_date,
    slot_record.start_time,
    new.minutes,
    old.rotation_minutes,
    new.rotation_minutes
  );

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
  participant_record public.participant_profiles%rowtype;
  dummy_record public.opportunity_dummy_participants%rowtype;
  current_booking_count integer;
  inserted_booking_id uuid;
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

  if not found or opportunity_record.created_by <> current_user_id then
    raise exception 'Opportunity not found'
      using errcode = '42501';
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

  select *
  into dummy_record
  from public.opportunity_dummy_participants
  where id = target_user_id
    and opportunity_id = target_opportunity_id
  for share;

  if found then
    if exists (
      select 1 from public.opportunity_slot_bookings osb
      where osb.slot_id = target_slot_id
        and osb.dummy_participant_id = target_user_id
    ) then
      raise exception 'This participant is already assigned to that slot';
    end if;

    select count(*) into current_booking_count
    from public.opportunity_slot_bookings osb
    where osb.slot_id = target_slot_id;

    if current_booking_count >= slot_record.capacity then
      raise exception 'Slot is full';
    end if;

    insert into public.opportunity_slot_bookings (
      slot_id,
      opportunity_id,
      user_id,
      participant_profile_id,
      dummy_participant_id,
      minutes,
      is_final
    ) values (
      target_slot_id,
      target_opportunity_id,
      null,
      null,
      dummy_record.id,
      slot_record.duration_minutes,
      false
    )
    returning id into inserted_booking_id;

    return inserted_booking_id;
  end if;

  select *
  into participant_record
  from public.participant_profiles
  where id = target_user_id
    and archived_at is null
  for share;

  if not found or participant_record.user_id = opportunity_record.created_by then
    raise exception 'Choose a valid participant';
  end if;

  if not exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = target_opportunity_id
      and oi.participant_profile_id = target_user_id
      and oi.status = 'accepted'
      and oi.interest_type <> 'timetable_reminder'
  ) then
    raise exception 'Only accepted participants can be assigned';
  end if;

  if exists (
    select 1 from public.opportunity_slot_bookings osb
    where osb.slot_id = target_slot_id
      and osb.participant_profile_id = target_user_id
  ) then
    raise exception 'This participant is already assigned to that slot';
  end if;

  select count(*) into current_booking_count
  from public.opportunity_slot_bookings osb
  where osb.slot_id = target_slot_id;

  if current_booking_count >= slot_record.capacity then
    raise exception 'Slot is full';
  end if;

  insert into public.opportunity_slot_bookings (
    slot_id,
    opportunity_id,
    user_id,
    participant_profile_id,
    dummy_participant_id,
    minutes,
    is_final
  ) values (
    target_slot_id,
    target_opportunity_id,
    participant_record.user_id,
    participant_record.id,
    null,
    slot_record.duration_minutes,
    false
  )
  returning id into inserted_booking_id;

  return inserted_booking_id;
end;
$$;

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
  participant_record public.participant_profiles%rowtype;
  dummy_record public.opportunity_dummy_participants%rowtype;
  normalized_slot_ids uuid[];
  slot_record record;
  selected_slot_count integer;
  current_booking_count integer;
  removed_count integer := 0;
  inserted_count integer := 0;
  is_dummy boolean := false;
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

  if not found or opportunity_record.created_by <> current_user_id then
    raise exception 'Opportunity not found'
      using errcode = '42501';
  end if;

  select *
  into dummy_record
  from public.opportunity_dummy_participants
  where id = target_user_id
    and opportunity_id = target_opportunity_id
  for share;

  if found then
    is_dummy := true;
  else
    select *
    into participant_record
    from public.participant_profiles
    where id = target_user_id
      and archived_at is null
    for share;

    if not found or participant_record.user_id = opportunity_record.created_by then
      raise exception 'Choose a valid participant';
    end if;

    if not exists (
      select 1
      from public.opportunity_interests oi
      where oi.opportunity_id = target_opportunity_id
        and oi.participant_profile_id = target_user_id
        and oi.status = 'accepted'
        and oi.interest_type <> 'timetable_reminder'
    ) then
      raise exception 'Only accepted participants can be assigned'
        using errcode = '42501';
    end if;
  end if;

  if coalesce(cardinality(target_slot_ids), 0) > 500 then
    raise exception 'Choose no more than 500 slots at once';
  end if;

  select coalesce(array_agg(slot_id order by slot_id), '{}'::uuid[])
  into normalized_slot_ids
  from (
    select distinct requested_slot_id as slot_id
    from unnest(coalesce(target_slot_ids, '{}'::uuid[]))
      as requested_slots(requested_slot_id)
    where requested_slot_id is not null
  ) requested_slots;

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

  for slot_record in
    select ots.id, ots.capacity, ots.duration_minutes
    from public.opportunity_time_slots ots
    where ots.opportunity_id = target_opportunity_id
      and ots.id = any(normalized_slot_ids)
      and not exists (
        select 1
        from public.opportunity_slot_bookings existing_booking
        where existing_booking.slot_id = ots.id
          and (
            (is_dummy and existing_booking.dummy_participant_id = target_user_id)
            or (not is_dummy and existing_booking.participant_profile_id = target_user_id)
          )
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

  if is_dummy then
    delete from public.opportunity_slot_bookings osb
    where osb.opportunity_id = target_opportunity_id
      and osb.dummy_participant_id = target_user_id
      and not (osb.slot_id = any(normalized_slot_ids));

    get diagnostics removed_count = row_count;

    insert into public.opportunity_slot_bookings (
      slot_id,
      opportunity_id,
      user_id,
      participant_profile_id,
      dummy_participant_id,
      minutes,
      is_final,
      finalized_at,
      release_requested_at,
      release_requested_by
    )
    select
      ots.id,
      target_opportunity_id,
      null,
      null,
      dummy_record.id,
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
          and existing_booking.dummy_participant_id = target_user_id
      )
    order by ots.id;
  else
    delete from public.opportunity_slot_bookings osb
    where osb.opportunity_id = target_opportunity_id
      and osb.participant_profile_id = target_user_id
      and not (osb.slot_id = any(normalized_slot_ids));

    get diagnostics removed_count = row_count;

    insert into public.opportunity_slot_bookings (
      slot_id,
      opportunity_id,
      user_id,
      participant_profile_id,
      dummy_participant_id,
      minutes,
      is_final,
      finalized_at,
      release_requested_at,
      release_requested_by
    )
    select
      ots.id,
      target_opportunity_id,
      participant_record.user_id,
      participant_record.id,
      null,
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
          and existing_booking.participant_profile_id = target_user_id
      )
    order by ots.id;
  end if;

  get diagnostics inserted_count = row_count;

  return jsonb_build_object(
    'inserted_count', inserted_count,
    'removed_count', removed_count,
    'notification_created', false
  );
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
  current_user_id uuid := auth.uid();
  opportunity_record public.opportunities%rowtype;
  released_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'Please log in again'
      using errcode = '42501';
  end if;

  select *
  into opportunity_record
  from public.opportunities
  where id = target_opportunity_id;

  if not found or opportunity_record.created_by <> current_user_id then
    raise exception 'Opportunity not found'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.opportunity_dummy_participants odp
    where odp.id = target_user_id
      and odp.opportunity_id = target_opportunity_id
  ) then
    delete from public.opportunity_slot_bookings osb
    where osb.opportunity_id = target_opportunity_id
      and osb.dummy_participant_id = target_user_id;
  else
    delete from public.opportunity_slot_bookings osb
    where osb.opportunity_id = target_opportunity_id
      and osb.participant_profile_id = target_user_id;
  end if;

  get diagnostics released_count = row_count;
  return released_count;
end;
$$;

revoke execute on function public.create_opportunity_dummy_participant(uuid, text, text, text, text, text) from public;
revoke execute on function public.create_opportunity_dummy_participant(uuid, text, text, text, text, text) from anon;
grant execute on function public.create_opportunity_dummy_participant(uuid, text, text, text, text, text) to authenticated;

grant execute on function public.assign_opportunity_slot_booking(uuid, uuid, uuid) to authenticated;
grant execute on function public.sync_participant_slot_booking_draft(uuid, uuid, uuid[]) to authenticated;
grant execute on function public.release_participant_slot_bookings(uuid, uuid) to authenticated;
