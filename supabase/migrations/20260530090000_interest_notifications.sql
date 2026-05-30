create or replace function public.notify_organizer_of_new_interest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  organizer_id uuid;
  opportunity_title text;
  athlete_name text;
begin
  select o.created_by, o.title
  into organizer_id, opportunity_title
  from public.opportunities o
  where o.id = new.opportunity_id;

  if organizer_id is null or organizer_id = new.athlete_id then
    return new;
  end if;

  select p.full_name
  into athlete_name
  from public.profiles p
  where p.id = new.athlete_id;

  insert into public.notifications (user_id, title, body, type, opportunity_id)
  values (
    organizer_id,
    'New application',
    coalesce(athlete_name, 'An athlete') || ' applied for ' || coalesce(opportunity_title, 'your opportunity') || '.',
    'new_interest',
    new.opportunity_id
  );

  return new;
end;
$$;

drop trigger if exists opportunity_interests_notify_organizer on public.opportunity_interests;

create trigger opportunity_interests_notify_organizer
after insert on public.opportunity_interests
for each row execute function public.notify_organizer_of_new_interest();
