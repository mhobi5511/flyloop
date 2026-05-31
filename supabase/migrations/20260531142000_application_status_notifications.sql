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
    when 'withdrawn' then
      'Your application for ' || coalesce(opportunity_title, 'this opportunity') || ' was withdrawn.'
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

drop trigger if exists opportunity_interests_notify_athlete_status on public.opportunity_interests;

create trigger opportunity_interests_notify_athlete_status
after update of status on public.opportunity_interests
for each row execute function public.notify_athlete_of_application_status_change();

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception
  when duplicate_object then null;
end;
$$;
