alter table public.opportunity_interests
  add column if not exists self_booking_enabled boolean not null default false;

create index if not exists opportunity_interests_self_booking_enabled_idx
on public.opportunity_interests(opportunity_id, self_booking_enabled);

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
        and coalesce(oi.self_booking_enabled, false)
    )
  group by ots.id, ots.slot_date, ots.start_time, ots.duration_minutes, ots.capacity
  order by ots.slot_date asc, ots.start_time asc;
$$;

revoke execute on function public.get_published_opportunity_slots(uuid) from public;
revoke execute on function public.get_published_opportunity_slots(uuid) from anon;
grant execute on function public.get_published_opportunity_slots(uuid) to authenticated;

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

  if not found or interest_record.status <> 'accepted' then
    raise exception 'Only accepted participants can book slots'
      using errcode = '42501';
  end if;

  if not coalesce(interest_record.self_booking_enabled, false) then
    raise exception 'Self-booking is not enabled for this participant'
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
      minutes,
      is_final,
      finalized_at
    ) values (
      target_slot_id,
      target_opportunity_id,
      current_user_id,
      15,
      true,
      now()
    );

    inserted_count := inserted_count + 1;
  end loop;

  return inserted_count;
end;
$$;

revoke execute on function public.book_opportunity_slots(uuid, uuid[]) from public;
revoke execute on function public.book_opportunity_slots(uuid, uuid[]) from anon;
grant execute on function public.book_opportunity_slots(uuid, uuid[]) to authenticated;

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
  interest_record public.opportunity_interests%rowtype;
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

  select *
  into interest_record
  from public.opportunity_interests oi
  where oi.opportunity_id = target_opportunity_id
    and oi.athlete_id = current_user_id
  for update;

  if not found or interest_record.status <> 'accepted' then
    raise exception 'Only accepted participants can release slots'
      using errcode = '42501';
  end if;

  if not coalesce(interest_record.self_booking_enabled, false) then
    raise exception 'Self-booking is not enabled for this participant'
      using errcode = '42501';
  end if;

  if not interest_record.self_booking_enabled and not public.is_opportunity_booking_change_open(opportunity_record) then
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

revoke execute on function public.release_own_opportunity_slot_booking(uuid, uuid) from public;
revoke execute on function public.release_own_opportunity_slot_booking(uuid, uuid) from anon;
grant execute on function public.release_own_opportunity_slot_booking(uuid, uuid) to authenticated;

create or replace function public.request_own_opportunity_slot_release(
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
  interest_record public.opportunity_interests%rowtype;
  booking_record public.opportunity_slot_bookings%rowtype;
  updated_count integer;
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

  select *
  into interest_record
  from public.opportunity_interests oi
  where oi.opportunity_id = target_opportunity_id
    and oi.athlete_id = current_user_id
  for update;

  if not found or interest_record.status <> 'accepted' then
    raise exception 'Only accepted participants can release slots'
      using errcode = '42501';
  end if;

  if not coalesce(interest_record.self_booking_enabled, false) then
    raise exception 'Self-booking is not enabled for this participant'
      using errcode = '42501';
  end if;

  select *
  into booking_record
  from public.opportunity_slot_bookings osb
  where osb.opportunity_id = target_opportunity_id
    and osb.slot_id = target_slot_id
    and osb.user_id = current_user_id
  for update;

  if not found then
    raise exception 'No booked slot to release';
  end if;

  if booking_record.release_requested_at is not null then
    return 0;
  end if;

  update public.opportunity_slot_bookings osb
  set
    release_requested_at = now(),
    release_requested_by = current_user_id
  where osb.id = booking_record.id
    and osb.user_id = current_user_id
    and osb.release_requested_at is null;

  get diagnostics updated_count = row_count;

  return updated_count;
end;
$$;

revoke execute on function public.request_own_opportunity_slot_release(uuid, uuid) from public;
revoke execute on function public.request_own_opportunity_slot_release(uuid, uuid) from anon;
grant execute on function public.request_own_opportunity_slot_release(uuid, uuid) to authenticated;

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
  interest_record public.opportunity_interests%rowtype;
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

  if not found then
    raise exception 'Opportunity not found';
  end if;

  if new.user_id = auth.uid() then
    select *
    into interest_record
    from public.opportunity_interests oi
    where oi.opportunity_id = new.opportunity_id
      and oi.athlete_id = new.user_id
    for update;

    if slot_record.opportunity_id <> new.opportunity_id then
      raise exception 'Booking opportunity must match slot opportunity';
    end if;

    if not found or interest_record.status <> 'accepted' then
      raise exception 'Only accepted participants can book slots'
        using errcode = '42501';
    end if;

    if not coalesce(interest_record.self_booking_enabled, false) then
      raise exception 'Self-booking is not enabled for this participant'
        using errcode = '42501';
    end if;

    if tg_op = 'UPDATE' and coalesce(interest_record.self_booking_enabled, false) then
      if new.opportunity_id is distinct from old.opportunity_id
        or new.slot_id is distinct from old.slot_id
        or new.user_id is distinct from old.user_id
        or new.minutes is distinct from old.minutes
        or new.is_final is distinct from old.is_final
        or new.finalized_at is distinct from old.finalized_at
      then
        if new.release_requested_at is not null
          and new.release_requested_by = auth.uid()
        then
          return new;
        end if;

        raise exception 'Self-booking participants may only request slot release'
          using errcode = '42501';
      end if;

      if new.release_requested_at is null
        or new.release_requested_by is distinct from auth.uid()
      then
        raise exception 'Self-booking release requests must be submitted by the participant'
          using errcode = '42501';
      end if;

      return new;
    end if;
  elsif opportunity_owner <> auth.uid() then
    raise exception 'Not authorized to book this slot'
      using errcode = '42501';
  end if;

  if slot_record.opportunity_id <> new.opportunity_id then
    raise exception 'Booking opportunity must match slot opportunity';
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

drop policy if exists "Accepted participants request own slot release" on public.opportunity_slot_bookings;

create policy "Accepted participants request own slot release"
on public.opportunity_slot_bookings for update
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = opportunity_slot_bookings.opportunity_id
      and oi.athlete_id = auth.uid()
      and oi.status = 'accepted'
      and coalesce(oi.self_booking_enabled, false)
  )
)
with check (
  user_id = auth.uid()
  and release_requested_at is not null
  and release_requested_by = auth.uid()
  and exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = opportunity_slot_bookings.opportunity_id
      and oi.athlete_id = auth.uid()
      and oi.status = 'accepted'
      and coalesce(oi.self_booking_enabled, false)
  )
);
