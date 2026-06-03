alter table public.opportunity_interests
  add column if not exists interest_type text not null default 'application';

alter table public.opportunity_interests
  drop constraint if exists opportunity_interests_interest_type_check;

alter table public.opportunity_interests
  add constraint opportunity_interests_interest_type_check
  check (interest_type in ('application', 'timetable_reminder'));

update public.opportunity_interests
set interest_type = 'application'
where interest_type is null;

drop policy if exists "Users create interests for published opportunities" on public.opportunity_interests;

create policy "Users create interests for published opportunities"
on public.opportunity_interests for insert
with check (
  athlete_id = auth.uid()
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and wants_to_join_opportunities = true
  )
  and exists (
    select 1
    from public.opportunities o
    where o.id = opportunity_interests.opportunity_id
      and o.status = 'published'
      and o.available_spots > 0
      and (
        (
          o.booking_mode = 'approval_required'
          and opportunity_interests.status = 'pending'
          and opportunity_interests.interest_type = 'application'
        )
        or (
          o.booking_mode = 'direct_time_booking'
          and opportunity_interests.status = 'pending'
          and opportunity_interests.interest_type = 'timetable_reminder'
        )
      )
  )
);

drop policy if exists "Users delete own timetable reminders" on public.opportunity_interests;

create policy "Users delete own timetable reminders"
on public.opportunity_interests for delete
using (
  athlete_id = auth.uid()
  and interest_type = 'timetable_reminder'
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
      and oi.interest_type <> 'timetable_reminder'
  )
);

create or replace function public.notify_organizer_of_new_interest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  organizer_id uuid;
  opportunity_title text;
  opportunity_type public.opportunity_type;
  opportunity_start date;
  tunnel_name text;
  athlete_name text;
  date_text text;
begin
  if new.interest_type = 'timetable_reminder' then
    return new;
  end if;

  select o.created_by, o.title, o.type, o.start_date, t.name
  into organizer_id, opportunity_title, opportunity_type, opportunity_start, tunnel_name
  from public.opportunities o
  join public.tunnel_profiles t on t.id = o.tunnel_id
  where o.id = new.opportunity_id;

  if organizer_id is null or organizer_id = new.athlete_id then
    return new;
  end if;

  select p.full_name
  into athlete_name
  from public.profiles p
  where p.id = new.athlete_id;

  date_text := case
    when opportunity_start is null then ''
    else ' on ' || to_char(opportunity_start, 'Mon FMDD')
  end;

  insert into public.notifications (user_id, title, body, type, opportunity_id)
  values (
    organizer_id,
    'New application for ' || coalesce(opportunity_title, 'your opportunity'),
    coalesce(athlete_name, 'An athlete') || ' applied to ' ||
      coalesce(opportunity_title, 'your opportunity') ||
      ' at ' || coalesce(tunnel_name, 'the tunnel') || date_text || '.',
    'new_interest',
    new.opportunity_id
  );

  return new;
end;
$$;

create or replace function public.notify_athlete_of_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  opportunity_title text;
  notification_body text;
begin
  if old.interest_type = 'timetable_reminder'
    or new.interest_type = 'timetable_reminder'
  then
    return new;
  end if;

  if old.status is not distinct from new.status then
    return new;
  end if;

  select o.title
  into opportunity_title
  from public.opportunities o
  where o.id = new.opportunity_id;

  notification_body := case new.status
    when 'accepted' then
      'Your application for ' || coalesce(opportunity_title, 'this opportunity') || ' was accepted.'
    when 'declined' then
      'Your application for ' || coalesce(opportunity_title, 'this opportunity') || ' was declined.'
    when 'waitlist' then
      'You have been added to the waitlist for ' || coalesce(opportunity_title, 'this opportunity') || '.'
    when 'pending' then
      'Your application for ' || coalesce(opportunity_title, 'this opportunity') || ' is pending.'
    else
      'Your application for ' || coalesce(opportunity_title, 'this opportunity') || ' was updated.'
  end;

  insert into public.notifications (user_id, title, body, type, opportunity_id)
  values (
    new.athlete_id,
    'Application status updated',
    notification_body,
    'application_status',
    new.opportunity_id
  );

  return new;
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

revoke execute on function public.notify_timetable_published(uuid) from public;
revoke execute on function public.notify_timetable_published(uuid) from anon;
grant execute on function public.notify_timetable_published(uuid) to authenticated;
