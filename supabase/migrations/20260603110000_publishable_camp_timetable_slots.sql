alter table public.opportunity_time_slots
  add column if not exists is_published boolean not null default false,
  add column if not exists published_at timestamptz;

create index if not exists opportunity_time_slots_published_idx
on public.opportunity_time_slots(opportunity_id, is_published);

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

  if not slot_record.is_published then
    raise exception 'Timetable is not published yet'
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

drop policy if exists "Accepted participants read own opportunity slots" on public.opportunity_time_slots;

create policy "Accepted participants read own opportunity slots"
on public.opportunity_time_slots for select
using (
  is_published = true
  and exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = opportunity_time_slots.opportunity_id
      and oi.athlete_id = auth.uid()
      and oi.status = 'accepted'
  )
);

create or replace function public.notify_timetable_published(target_opportunity_id uuid)
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
    raise exception 'Not authorized to publish this timetable'
      using errcode = '42501';
  end if;

  insert into public.notifications (user_id, title, body, type, opportunity_id)
  select distinct
    oi.athlete_id,
    'Timetable created. Book your slots now.',
    'Timetable created. Book your slots now.',
    'timetable_published',
    target_opportunity_id
  from public.opportunity_interests oi
  where oi.opportunity_id = target_opportunity_id
    and oi.status = 'accepted'
    and oi.athlete_id <> opportunity_record.created_by;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke execute on function public.notify_timetable_published(uuid) from public;
revoke execute on function public.notify_timetable_published(uuid) from anon;
grant execute on function public.notify_timetable_published(uuid) to authenticated;
