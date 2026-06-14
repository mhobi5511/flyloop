drop policy if exists "Accepted participants manage own camp preferences" on public.camp_day_preferences;
drop policy if exists "Accepted participants update own camp preferences" on public.camp_day_preferences;
drop policy if exists "Accepted participants delete own camp preferences" on public.camp_day_preferences;

create policy "Pending and accepted participants manage own camp preferences"
on public.camp_day_preferences for insert
with check (
  participant_id = auth.uid()
  and exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = camp_day_preferences.opportunity_id
      and oi.athlete_id = auth.uid()
      and oi.status in ('pending', 'accepted')
  )
);

create policy "Pending and accepted participants update own camp preferences"
on public.camp_day_preferences for update
using (
  participant_id = auth.uid()
  and exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = camp_day_preferences.opportunity_id
      and oi.athlete_id = auth.uid()
      and oi.status in ('pending', 'accepted')
  )
)
with check (
  participant_id = auth.uid()
  and exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = camp_day_preferences.opportunity_id
      and oi.athlete_id = auth.uid()
      and oi.status in ('pending', 'accepted')
  )
);

create policy "Pending and accepted participants delete own camp preferences"
on public.camp_day_preferences for delete
using (
  participant_id = auth.uid()
  and exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = camp_day_preferences.opportunity_id
      and oi.athlete_id = auth.uid()
      and oi.status in ('pending', 'accepted')
  )
);

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

  if not slot_record.is_published and opportunity_owner <> auth.uid() then
    raise exception 'Timetable is not published yet'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = new.opportunity_id
      and oi.athlete_id = new.user_id
      and oi.status = 'accepted'
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
    minutes,
    is_final
  ) values (
    target_slot_id,
    target_opportunity_id,
    target_user_id,
    slot_record.duration_minutes,
    slot_record.is_published
  )
  returning id into inserted_booking_id;

  return inserted_booking_id;
end;
$$;

