create or replace function public.ensure_camp_approval_booking_mode()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'camp' then
    new.booking_mode := 'approval_required';
  end if;

  return new;
end;
$$;

drop trigger if exists opportunities_enforce_camp_booking_mode on public.opportunities;

create trigger opportunities_enforce_camp_booking_mode
before insert or update of type, booking_mode on public.opportunities
for each row execute function public.ensure_camp_approval_booking_mode();

update public.opportunities
set booking_mode = 'approval_required'
where type = 'camp';

alter table public.opportunity_slot_bookings
  add column if not exists is_final boolean not null default false,
  add column if not exists finalized_at timestamptz,
  add column if not exists release_requested_at timestamptz,
  add column if not exists release_requested_by uuid references public.profiles(id) on delete set null;

update public.opportunity_slot_bookings
set
  is_final = true,
  finalized_at = coalesce(finalized_at, created_at)
where is_final is distinct from true;

create index if not exists opportunity_slot_bookings_opportunity_final_idx
on public.opportunity_slot_bookings(opportunity_id, is_final);

create index if not exists opportunity_slot_bookings_release_requested_idx
on public.opportunity_slot_bookings(opportunity_id, release_requested_at);

create table if not exists public.camp_day_preferences (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  participant_id uuid not null references public.profiles(id) on delete cascade,
  day_id integer not null check (day_id > 0),
  preferred_minutes integer not null check (preferred_minutes in (30, 45, 60, 75, 90)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, participant_id, day_id)
);

create index if not exists camp_day_preferences_opportunity_idx
on public.camp_day_preferences(opportunity_id);

drop trigger if exists camp_day_preferences_set_updated_at on public.camp_day_preferences;

create trigger camp_day_preferences_set_updated_at
before update on public.camp_day_preferences
for each row execute function public.set_updated_at();

alter table public.camp_day_preferences enable row level security;

drop policy if exists "Organizers read camp day preferences" on public.camp_day_preferences;
drop policy if exists "Accepted participants manage own camp preferences" on public.camp_day_preferences;
drop policy if exists "Participants read own camp preferences" on public.camp_day_preferences;

create policy "Organizers read camp day preferences"
on public.camp_day_preferences for select
using (
  exists (
    select 1
    from public.opportunities o
    where o.id = camp_day_preferences.opportunity_id
      and o.created_by = auth.uid()
  )
);

create policy "Participants read own camp preferences"
on public.camp_day_preferences for select
using (
  participant_id = auth.uid()
  and exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = camp_day_preferences.opportunity_id
      and oi.athlete_id = auth.uid()
      and oi.status in ('pending', 'accepted', 'waitlist', 'declined')
  )
);

create policy "Accepted participants manage own camp preferences"
on public.camp_day_preferences for insert
with check (
  participant_id = auth.uid()
  and exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = camp_day_preferences.opportunity_id
      and oi.athlete_id = auth.uid()
      and oi.status = 'accepted'
  )
);

create policy "Accepted participants update own camp preferences"
on public.camp_day_preferences for update
using (
  participant_id = auth.uid()
  and exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = camp_day_preferences.opportunity_id
      and oi.athlete_id = auth.uid()
      and oi.status = 'accepted'
  )
)
with check (
  participant_id = auth.uid()
  and exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = camp_day_preferences.opportunity_id
      and oi.athlete_id = auth.uid()
      and oi.status = 'accepted'
  )
);

create policy "Accepted participants delete own camp preferences"
on public.camp_day_preferences for delete
using (
  participant_id = auth.uid()
  and exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = camp_day_preferences.opportunity_id
      and oi.athlete_id = auth.uid()
      and oi.status = 'accepted'
  )
);

grant select, insert, update, delete on public.camp_day_preferences to authenticated;

create or replace function public.flyloop_notification_copy(
  notification_type text,
  opportunity_title text default null,
  actor_name text default null,
  total_minutes integer default null,
  tunnel_name text default null,
  coach_name text default null,
  status_value text default null,
  has_timetable boolean default false
)
returns table(title text, body text)
language sql
stable
as $$
  select
    case
      when notification_type = 'application_status' and status_value = 'accepted' then '🎉 You''re in!'
      when notification_type = 'application_status' and status_value = 'declined' then 'Application update'
      when notification_type = 'application_status' and status_value = 'waitlist' then 'You''re on the waitlist'
      when notification_type = 'application_status' then 'Application update'
      when notification_type = 'timetable_published' then '⏰ Timetable published'
      when notification_type = 'timetable_booking_reminder' then 'Don''t forget your slots'
      when notification_type = 'timetable_booking_changed' then '⚠️ Your schedule changed'
      when notification_type in (
        'slot_bookings_released',
        'slot_bookings_released_by_organizer',
        'slot_booking_released_by_organizer'
      ) then '⚠️ Your schedule changed'
      when notification_type = 'new_time_booking' then '🛫 New flyer booked time'
      when notification_type = 'timetable_reminder_interest' then 'Someone is waiting for your timetable'
      when notification_type = 'new_interest' then 'New flyer wants in'
      when notification_type = 'new_opportunity_tunnel' then 'New session at ' || coalesce(nullif(tunnel_name, ''), 'your tunnel')
      when notification_type = 'new_opportunity' then 'New camp from ' || coalesce(nullif(coach_name, ''), 'a coach')
      when notification_type = 'last_minute' then 'Still time to join'
      else coalesce(nullif(opportunity_title, ''), 'Flyloop update')
    end as title,
    case
      when notification_type = 'application_status' and status_value = 'accepted' and has_timetable then
        'Your spot is confirmed. Book your flying times now.'
      when notification_type = 'application_status' and status_value = 'accepted' then
        'Your spot for ' || coalesce(nullif(opportunity_title, ''), 'this opportunity') || ' is confirmed.'
      when notification_type = 'application_status' and status_value = 'declined' then
        'Unfortunately, there wasn''t a spot available for ' || coalesce(nullif(opportunity_title, ''), 'this opportunity') || '.'
      when notification_type = 'application_status' and status_value = 'waitlist' then
        'A spot may still open up for ' || coalesce(nullif(opportunity_title, ''), 'this opportunity') || '.'
      when notification_type = 'application_status' then
        'There is an update for ' || coalesce(nullif(opportunity_title, ''), 'this opportunity') || '.'
      when notification_type = 'timetable_published' then
        'Your timetable has been published. Here are your final flight times for ' ||
          coalesce(nullif(opportunity_title, ''), 'this opportunity') || '.'
      when notification_type = 'timetable_booking_reminder' then
        'Please select your flying times for ' || coalesce(nullif(opportunity_title, ''), 'this opportunity') || '.'
      when notification_type = 'timetable_booking_changed' then
        'One or more of your booked times for ' || coalesce(nullif(opportunity_title, ''), 'this opportunity') || ' were removed.'
      when notification_type in (
        'slot_bookings_released',
        'slot_bookings_released_by_organizer',
        'slot_booking_released_by_organizer'
      ) then
        'One or more of your booked times for ' || coalesce(nullif(opportunity_title, ''), 'this opportunity') || ' were removed.'
      when notification_type = 'new_time_booking' then
        coalesce(nullif(actor_name, ''), 'A flyer') || ' booked ' || coalesce(total_minutes, 0) || ' min for ' ||
          coalesce(nullif(opportunity_title, ''), 'this opportunity') || '.'
      when notification_type = 'timetable_reminder_interest' then
        coalesce(nullif(actor_name, ''), 'Someone') || ' wants to book times for ' ||
          coalesce(nullif(opportunity_title, ''), 'this opportunity') || '.'
      when notification_type = 'new_interest' then
        coalesce(nullif(actor_name, ''), 'A flyer') || ' applied for ' ||
          coalesce(nullif(opportunity_title, ''), 'your opportunity') || '.'
      when notification_type in ('new_opportunity', 'new_opportunity_tunnel') then
        coalesce(nullif(opportunity_title, ''), 'A new opportunity') || ' is now open.'
      when notification_type = 'last_minute' then
        coalesce(nullif(opportunity_title, ''), 'An opportunity') || ' still has open spots at ' ||
          coalesce(nullif(tunnel_name, ''), 'the tunnel') || '.'
      else
        coalesce(nullif(opportunity_title, ''), 'Open Flyloop to see what changed.')
    end as body;
$$;

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
    where osb.slot_id = target_slot_id
      and osb.is_final = true;

    if current_booking_count >= slot_record.capacity then
      raise exception 'One of these slots is full';
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
      current_user_id,
      slot_record.duration_minutes,
      false
    );

    inserted_count := inserted_count + 1;
  end loop;

  return inserted_count;
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
    and is_published = true
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
  where osb.slot_id = target_slot_id
    and osb.is_final = true;

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
    false
  )
  returning id into inserted_booking_id;

  return inserted_booking_id;
end;
$$;

create or replace function public.notify_timetable_published(target_opportunity_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  opportunity_record public.opportunities%rowtype;
  inserted_count integer;
  copy record;
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

  update public.opportunity_slot_bookings
  set
    is_final = true,
    finalized_at = coalesce(finalized_at, now())
  where opportunity_id = target_opportunity_id;

  select *
  into copy
  from public.flyloop_notification_copy(
    notification_type := 'timetable_published',
    opportunity_title := opportunity_record.title
  );

  insert into public.notifications (user_id, title, body, type, opportunity_id)
  select distinct
    oi.athlete_id,
    copy.title,
    copy.body,
    'timetable_published',
    target_opportunity_id
  from public.opportunity_interests oi
  where oi.opportunity_id = target_opportunity_id
    and (
      oi.status = 'accepted'
      or oi.interest_type = 'timetable_reminder'
    )
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

revoke execute on function public.get_published_opportunity_slots(uuid) from public;
revoke execute on function public.get_published_opportunity_slots(uuid) from anon;
grant execute on function public.get_published_opportunity_slots(uuid) to authenticated;

revoke execute on function public.book_opportunity_slots(uuid, uuid[]) from public;
revoke execute on function public.book_opportunity_slots(uuid, uuid[]) from anon;
grant execute on function public.book_opportunity_slots(uuid, uuid[]) to authenticated;

revoke execute on function public.assign_opportunity_slot_booking(uuid, uuid, uuid) from public;
revoke execute on function public.assign_opportunity_slot_booking(uuid, uuid, uuid) from anon;
grant execute on function public.assign_opportunity_slot_booking(uuid, uuid, uuid) to authenticated;

revoke execute on function public.notify_timetable_published(uuid) from public;
revoke execute on function public.notify_timetable_published(uuid) from anon;
grant execute on function public.notify_timetable_published(uuid) to authenticated;
