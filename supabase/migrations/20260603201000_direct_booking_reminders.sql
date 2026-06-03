update public.opportunities
set booking_mode = 'approval_required'
where booking_mode is null;

drop view if exists public.published_opportunities_with_context;

create view public.published_opportunities_with_context as
select
  o.*,
  public.is_last_minute_opportunity(
    o.start_date,
    o.registration_deadline,
    o.available_spots,
    o.status
  ) as is_last_minute,
  t.name as tunnel_name,
  t.country as tunnel_country,
  t.city as tunnel_city,
  t.region as tunnel_region,
  t.latitude as tunnel_latitude,
  t.longitude as tunnel_longitude,
  cp.user_id as coach_user_id,
  coalesce(coach_profile.id, o.created_by) as coach_follow_id,
  organizer.full_name as coach_name,
  organizer.profile_image_url as coach_profile_image_url,
  exists (
    select 1
    from public.follows f
    where f.follower_id = auth.uid()
      and f.target_type = 'coach'
      and f.target_id = coalesce(coach_profile.id, o.created_by)
  ) as is_followed_coach,
  exists (
    select 1
    from public.opportunity_time_slots ots
    where ots.opportunity_id = o.id
      and ots.is_published = true
  ) as has_published_timetable,
  greatest(
    coalesce((
      select sum(ots.duration_minutes * ots.capacity)
      from public.opportunity_time_slots ots
      where ots.opportunity_id = o.id
        and ots.is_published = true
    ), 0) -
    coalesce((
      select sum(osb.minutes)
      from public.opportunity_slot_bookings osb
      where osb.opportunity_id = o.id
    ), 0),
    0
  )::integer as remaining_timetable_minutes
from public.opportunities o
join public.tunnel_profiles t on t.id = o.tunnel_id
left join public.coach_profiles cp on cp.id = o.coach_id
left join public.profiles coach_profile on coach_profile.id = cp.user_id
left join public.profiles organizer on organizer.id = coalesce(coach_profile.id, o.created_by)
where o.status in ('published', 'full');

grant select on public.published_opportunities_with_context to anon, authenticated;

drop policy if exists "Users create interests for published opportunities" on public.opportunity_interests;

create policy "Users create interests for published opportunities"
on public.opportunity_interests for insert
with check (
  athlete_id = auth.uid()
  and status in ('pending', 'timetable_reminder')
  and exists (
    select 1 from public.profiles
    where id = auth.uid()
      and wants_to_join_opportunities = true
  )
  and exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id
      and o.status = 'published'
      and o.available_spots > 0
      and (
        (o.booking_mode = 'approval_required' and status = 'pending')
        or (o.booking_mode = 'direct_time_booking' and status = 'timetable_reminder')
      )
  )
);

drop policy if exists "Organizers read interested user profiles" on public.profiles;

create policy "Organizers read interested user profiles"
on public.profiles for select
using (
  public.is_admin()
  or exists (
    select 1
    from public.opportunity_interests oi
    join public.opportunities o on o.id = oi.opportunity_id
    where oi.athlete_id = profiles.id
      and o.created_by = auth.uid()
      and oi.status <> 'timetable_reminder'
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
  opportunity_record public.opportunities%rowtype;
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

  select *
  into opportunity_record
  from public.opportunities
  where id = new.opportunity_id;

  if not found then
    raise exception 'Opportunity does not exist';
  end if;

  if opportunity_record.booking_mode = 'approval_required'
    and not exists (
      select 1
      from public.opportunity_interests oi
      where oi.opportunity_id = new.opportunity_id
        and oi.athlete_id = new.user_id
        and oi.status = 'accepted'
    )
  then
    raise exception 'Only accepted participants can book slots'
      using errcode = '42501';
  end if;

  if opportunity_record.booking_mode = 'direct_time_booking'
    and not exists (
      select 1
      from public.opportunity_interests oi
      where oi.opportunity_id = new.opportunity_id
        and oi.athlete_id = new.user_id
        and oi.status = 'accepted'
    )
  then
    raise exception 'Book through the direct booking flow first'
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

create policy "Accepted or direct participants read opportunity slots"
on public.opportunity_time_slots for select
using (
  is_published = true
  and (
    exists (
      select 1
      from public.opportunity_interests oi
      where oi.opportunity_id = opportunity_time_slots.opportunity_id
        and oi.athlete_id = auth.uid()
        and oi.status = 'accepted'
    )
    or exists (
      select 1
      from public.opportunities o
      where o.id = opportunity_time_slots.opportunity_id
        and o.status = 'published'
        and o.available_spots > 0
        and o.booking_mode = 'direct_time_booking'
        and o.created_by <> auth.uid()
        and not exists (
          select 1
          from public.opportunity_interests blocked
          where blocked.opportunity_id = opportunity_time_slots.opportunity_id
            and blocked.athlete_id = auth.uid()
            and blocked.status not in ('accepted', 'timetable_reminder')
        )
    )
  )
);

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
    count(osb.id)::integer as booked_count,
    greatest(ots.capacity - count(osb.id)::integer, 0) as remaining_capacity,
    exists (
      select 1
      from public.opportunity_slot_bookings own_booking
      where own_booking.slot_id = ots.id
        and own_booking.user_id = auth.uid()
    ) as user_has_booking
  from public.opportunity_time_slots ots
  join public.opportunities o on o.id = ots.opportunity_id
  left join public.opportunity_slot_bookings osb on osb.slot_id = ots.id
  where ots.opportunity_id = target_opportunity_id
    and ots.is_published = true
    and (
      exists (
        select 1
        from public.opportunity_interests oi
        where oi.opportunity_id = target_opportunity_id
          and oi.athlete_id = auth.uid()
          and oi.status = 'accepted'
      )
      or (
        o.booking_mode = 'direct_time_booking'
        and o.status = 'published'
        and o.available_spots > 0
        and o.created_by <> auth.uid()
        and not exists (
          select 1
          from public.opportunity_interests blocked
          where blocked.opportunity_id = target_opportunity_id
            and blocked.athlete_id = auth.uid()
            and blocked.status not in ('accepted', 'timetable_reminder')
        )
      )
    )
  group by ots.id, ots.slot_date, ots.start_time, ots.duration_minutes, ots.capacity
  order by ots.slot_date asc, ots.start_time asc;
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
    if found and interest_record.status not in ('accepted', 'timetable_reminder') then
      raise exception 'This participation cannot book slots'
        using errcode = '42501';
    end if;

    if not found then
      insert into public.opportunity_interests (
        opportunity_id,
        athlete_id,
        status
      ) values (
        target_opportunity_id,
        current_user_id,
        'accepted'
      );
    elsif interest_record.status = 'timetable_reminder' then
      update public.opportunity_interests
      set status = 'accepted'
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
  end loop;

  return inserted_count;
end;
$$;

revoke execute on function public.get_published_opportunity_slots(uuid) from public;
revoke execute on function public.get_published_opportunity_slots(uuid) from anon;
grant execute on function public.get_published_opportunity_slots(uuid) to authenticated;

revoke execute on function public.book_opportunity_slots(uuid, uuid[]) from public;
revoke execute on function public.book_opportunity_slots(uuid, uuid[]) from anon;
grant execute on function public.book_opportunity_slots(uuid, uuid[]) to authenticated;

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
    'Timetable is live for ' || opportunity_record.title || '.',
    'Timetable is live for ' || opportunity_record.title || '. Book your times now.',
    'timetable_published',
    target_opportunity_id
  from public.opportunity_interests oi
  where oi.opportunity_id = target_opportunity_id
    and oi.status in ('accepted', 'timetable_reminder')
    and oi.athlete_id <> opportunity_record.created_by
    and not exists (
      select 1
      from public.notifications n
      where n.user_id = oi.athlete_id
        and n.opportunity_id = target_opportunity_id
        and n.type = 'timetable_published'
    );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke execute on function public.notify_timetable_published(uuid) from public;
revoke execute on function public.notify_timetable_published(uuid) from anon;
grant execute on function public.notify_timetable_published(uuid) to authenticated;
