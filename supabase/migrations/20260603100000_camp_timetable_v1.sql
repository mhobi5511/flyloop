create table if not exists public.opportunity_time_slots (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  slot_date date not null,
  start_time time not null,
  duration_minutes integer not null default 15 check (duration_minutes > 0),
  capacity integer not null default 1 check (capacity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunity_slot_bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.opportunity_time_slots(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  minutes integer not null default 15 check (minutes > 0),
  created_at timestamptz not null default now(),
  unique (slot_id, user_id)
);

create index if not exists opportunity_time_slots_opportunity_date_idx
on public.opportunity_time_slots(opportunity_id, slot_date, start_time);

create index if not exists opportunity_slot_bookings_slot_idx
on public.opportunity_slot_bookings(slot_id);

create index if not exists opportunity_slot_bookings_opportunity_user_idx
on public.opportunity_slot_bookings(opportunity_id, user_id);

drop trigger if exists opportunity_time_slots_set_updated_at on public.opportunity_time_slots;

create trigger opportunity_time_slots_set_updated_at
before update on public.opportunity_time_slots
for each row execute function public.set_updated_at();

create or replace function public.guard_opportunity_time_slot_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_booking_count integer;
begin
  select count(*)
  into current_booking_count
  from public.opportunity_slot_bookings osb
  where osb.slot_id = new.id;

  if new.capacity < current_booking_count then
    raise exception 'Slot capacity cannot be lower than existing bookings';
  end if;

  return new;
end;
$$;

drop trigger if exists opportunity_time_slots_guard_capacity on public.opportunity_time_slots;

create trigger opportunity_time_slots_guard_capacity
before update of capacity on public.opportunity_time_slots
for each row execute function public.guard_opportunity_time_slot_capacity();

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
  if auth.uid() is null or new.user_id <> auth.uid() then
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

  if slot_record.opportunity_id <> new.opportunity_id then
    raise exception 'Booking opportunity must match slot opportunity';
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

drop trigger if exists opportunity_slot_bookings_guard on public.opportunity_slot_bookings;

create trigger opportunity_slot_bookings_guard
before insert or update on public.opportunity_slot_bookings
for each row execute function public.guard_opportunity_slot_booking();

alter table public.opportunity_time_slots enable row level security;
alter table public.opportunity_slot_bookings enable row level security;

drop policy if exists "Organizers manage own opportunity slots" on public.opportunity_time_slots;
drop policy if exists "Accepted participants read own opportunity slots" on public.opportunity_time_slots;
drop policy if exists "Organizers read own opportunity slot bookings" on public.opportunity_slot_bookings;
drop policy if exists "Accepted participants read own slot bookings" on public.opportunity_slot_bookings;
drop policy if exists "Accepted participants create own slot bookings" on public.opportunity_slot_bookings;
drop policy if exists "Accepted participants delete own slot bookings" on public.opportunity_slot_bookings;

create policy "Organizers manage own opportunity slots"
on public.opportunity_time_slots for all
using (
  exists (
    select 1
    from public.opportunities o
    where o.id = opportunity_time_slots.opportunity_id
      and o.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.opportunities o
    where o.id = opportunity_time_slots.opportunity_id
      and o.created_by = auth.uid()
  )
);

create policy "Accepted participants read own opportunity slots"
on public.opportunity_time_slots for select
using (
  exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = opportunity_time_slots.opportunity_id
      and oi.athlete_id = auth.uid()
      and oi.status = 'accepted'
  )
);

create policy "Organizers read own opportunity slot bookings"
on public.opportunity_slot_bookings for select
using (
  exists (
    select 1
    from public.opportunities o
    where o.id = opportunity_slot_bookings.opportunity_id
      and o.created_by = auth.uid()
  )
);

create policy "Accepted participants read own slot bookings"
on public.opportunity_slot_bookings for select
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = opportunity_slot_bookings.opportunity_id
      and oi.athlete_id = auth.uid()
      and oi.status = 'accepted'
  )
);

create policy "Accepted participants create own slot bookings"
on public.opportunity_slot_bookings for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.opportunity_time_slots ots
    where ots.id = opportunity_slot_bookings.slot_id
      and ots.opportunity_id = opportunity_slot_bookings.opportunity_id
  )
  and exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = opportunity_slot_bookings.opportunity_id
      and oi.athlete_id = auth.uid()
      and oi.status = 'accepted'
  )
);

create policy "Accepted participants delete own slot bookings"
on public.opportunity_slot_bookings for delete
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = opportunity_slot_bookings.opportunity_id
      and oi.athlete_id = auth.uid()
      and oi.status = 'accepted'
  )
);

grant select, insert, update, delete on public.opportunity_time_slots to authenticated;
grant select, insert, delete on public.opportunity_slot_bookings to authenticated;
