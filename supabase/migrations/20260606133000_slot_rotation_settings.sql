alter table public.opportunity_slot_bookings
add column if not exists rotation_minutes numeric(5,2);

alter table public.opportunity_slot_bookings
drop constraint if exists opportunity_slot_bookings_rotation_minutes_check;

alter table public.opportunity_slot_bookings
add constraint opportunity_slot_bookings_rotation_minutes_check
check (rotation_minutes is null or rotation_minutes > 0);

alter table public.opportunity_slot_booking_events
add column if not exists previous_rotation_minutes numeric(5,2);

alter table public.opportunity_slot_booking_events
add column if not exists new_rotation_minutes numeric(5,2);

alter table public.opportunity_slot_booking_events
drop constraint if exists opportunity_slot_booking_events_event_type_check;

alter table public.opportunity_slot_booking_events
add constraint opportunity_slot_booking_events_event_type_check
check (event_type in ('booked', 'removed', 'rotation_changed'));

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
    slot_id,
    event_type,
    slot_date,
    start_time,
    minutes,
    new_rotation_minutes
  ) values (
    booking_record.opportunity_id,
    booking_record.user_id,
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

drop trigger if exists opportunity_slot_bookings_log_rotation_change on public.opportunity_slot_bookings;

create trigger opportunity_slot_bookings_log_rotation_change
after update of rotation_minutes on public.opportunity_slot_bookings
for each row execute function public.log_opportunity_slot_rotation_change();
