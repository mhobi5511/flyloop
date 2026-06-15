create or replace function public.publish_opportunity_timetable_state(target_opportunity_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  opportunity_record public.opportunities%rowtype;
  publish_timestamp timestamptz := now();
begin
  if auth.uid() is null then
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

  if opportunity_record.created_by <> auth.uid() then
    raise exception 'Not authorized to publish this timetable'
      using errcode = '42501';
  end if;

  if opportunity_record.type = 'huck_jam' then
    raise exception 'Huck Jams do not use timetables';
  end if;

  update public.opportunity_time_slots
  set
    is_published = true,
    published_at = coalesce(published_at, publish_timestamp)
  where opportunity_id = target_opportunity_id;

  update public.opportunity_slot_bookings osb
  set
    is_final = true,
    finalized_at = coalesce(osb.finalized_at, publish_timestamp)
  where osb.opportunity_id = target_opportunity_id
    and osb.is_final = false;
end;
$$;

revoke execute on function public.publish_opportunity_timetable_state(uuid) from public;
revoke execute on function public.publish_opportunity_timetable_state(uuid) from anon;
grant execute on function public.publish_opportunity_timetable_state(uuid) to authenticated;

create or replace function public.get_published_opportunity_slots(target_opportunity_id uuid)
returns table (
  id uuid,
  slot_date date,
  start_time time,
  duration_minutes integer,
  capacity integer,
  booked_count integer,
  remaining_capacity integer,
  user_has_booking boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ots.id,
    ots.slot_date,
    ots.start_time,
    ots.duration_minutes,
    ots.capacity,
    count(*) filter (where osb.is_final)::integer as booked_count,
    greatest(ots.capacity - count(*) filter (where osb.is_final)::integer, 0) as remaining_capacity,
    exists (
      select 1
      from public.opportunity_slot_bookings own_booking
      where own_booking.slot_id = ots.id
        and own_booking.user_id = auth.uid()
        and own_booking.is_final = true
    ) as user_has_booking
  from public.opportunity_time_slots ots
  left join public.opportunity_slot_bookings osb on osb.slot_id = ots.id
  where ots.opportunity_id = target_opportunity_id
    and ots.is_published = true
    and exists (
      select 1
      from public.opportunity_interests oi
      where oi.opportunity_id = target_opportunity_id
        and oi.athlete_id = auth.uid()
        and oi.status = 'accepted'
    )
  group by ots.id, ots.slot_date, ots.start_time, ots.duration_minutes, ots.capacity
  order by ots.slot_date asc, ots.start_time asc;
$$;

revoke execute on function public.get_published_opportunity_slots(uuid) from public;
revoke execute on function public.get_published_opportunity_slots(uuid) from anon;
grant execute on function public.get_published_opportunity_slots(uuid) to authenticated;

drop policy if exists "Organizers update own opportunity slot bookings" on public.opportunity_slot_bookings;

create policy "Organizers update own opportunity slot bookings"
on public.opportunity_slot_bookings for update
using (
  exists (
    select 1
    from public.opportunities o
    where o.id = opportunity_slot_bookings.opportunity_id
      and o.created_by = auth.uid()
  )
  or exists (
    select 1
    from public.opportunity_time_slots ots
    join public.opportunities o on o.id = ots.opportunity_id
    where ots.id = opportunity_slot_bookings.slot_id
      and o.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.opportunities o
    where o.id = opportunity_slot_bookings.opportunity_id
      and o.created_by = auth.uid()
  )
  or exists (
    select 1
    from public.opportunity_time_slots ots
    join public.opportunities o on o.id = ots.opportunity_id
    where ots.id = opportunity_slot_bookings.slot_id
      and o.created_by = auth.uid()
  )
);
