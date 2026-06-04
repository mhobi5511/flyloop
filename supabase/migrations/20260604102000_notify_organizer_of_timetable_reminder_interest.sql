create or replace function public.notify_organizer_of_timetable_reminder_interest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  organizer_id uuid;
  opportunity_title text;
  athlete_name text;
  has_published_timetable boolean;
begin
  if new.interest_type <> 'timetable_reminder' then
    return new;
  end if;

  select
    o.created_by,
    o.title,
    exists (
      select 1
      from public.opportunity_time_slots ots
      where ots.opportunity_id = o.id
        and ots.is_published = true
    )
  into organizer_id, opportunity_title, has_published_timetable
  from public.opportunities o
  where o.id = new.opportunity_id
    and o.booking_mode = 'direct_time_booking';

  if organizer_id is null
    or organizer_id = new.athlete_id
    or has_published_timetable
  then
    return new;
  end if;

  select p.full_name
  into athlete_name
  from public.profiles p
  where p.id = new.athlete_id;

  insert into public.notifications (user_id, title, body, type, opportunity_id)
  values (
    organizer_id,
    'Someone is waiting for your timetable',
    coalesce(nullif(trim(athlete_name), ''), 'Someone') ||
      ' wants to book times for ' ||
      coalesce(opportunity_title, 'your opportunity') || '.',
    'timetable_reminder_interest',
    new.opportunity_id
  );

  return new;
end;
$$;

drop trigger if exists opportunity_interests_notify_timetable_reminder_organizer
on public.opportunity_interests;

create trigger opportunity_interests_notify_timetable_reminder_organizer
after insert on public.opportunity_interests
for each row execute function public.notify_organizer_of_timetable_reminder_interest();
