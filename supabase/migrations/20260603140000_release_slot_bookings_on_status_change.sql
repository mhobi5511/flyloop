create or replace function public.release_slot_bookings_when_not_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  opportunity_title text;
  released_count integer;
begin
  if old.status <> 'accepted' or new.status = 'accepted' then
    return new;
  end if;

  delete from public.opportunity_slot_bookings osb
  where osb.opportunity_id = new.opportunity_id
    and osb.user_id = new.athlete_id;

  get diagnostics released_count = row_count;

  if released_count > 0 then
    select o.title
    into opportunity_title
    from public.opportunities o
    where o.id = new.opportunity_id;

    insert into public.notifications (user_id, title, body, type, opportunity_id)
    values (
      new.athlete_id,
      'Your booked times were removed.',
      'Your booked times for ' || coalesce(opportunity_title, 'this opportunity') || ' were removed because your application status changed.',
      'slot_bookings_released',
      new.opportunity_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists opportunity_interests_release_slot_bookings on public.opportunity_interests;

create trigger opportunity_interests_release_slot_bookings
after update of status on public.opportunity_interests
for each row execute function public.release_slot_bookings_when_not_accepted();

insert into public.notifications (user_id, title, body, type, opportunity_id)
select distinct
  osb.user_id,
  'Your booked times were removed.',
  'Your booked times for ' || coalesce(o.title, 'this opportunity') || ' were removed because your application status changed.',
  'slot_bookings_released',
  osb.opportunity_id
from public.opportunity_slot_bookings osb
join public.opportunities o on o.id = osb.opportunity_id
where not exists (
  select 1
  from public.opportunity_interests oi
  where oi.opportunity_id = osb.opportunity_id
    and oi.athlete_id = osb.user_id
    and oi.status = 'accepted'
);

delete from public.opportunity_slot_bookings osb
where not exists (
  select 1
  from public.opportunity_interests oi
  where oi.opportunity_id = osb.opportunity_id
    and oi.athlete_id = osb.user_id
    and oi.status = 'accepted'
);
