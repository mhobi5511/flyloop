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
  if auth.role() = 'service_role' then
    return new;
  end if;

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
