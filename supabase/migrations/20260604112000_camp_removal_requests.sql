alter table public.opportunity_interests
  add column if not exists removal_requested_at timestamptz;

create index if not exists opportunity_interests_removal_requested_idx
on public.opportunity_interests(opportunity_id, removal_requested_at)
where removal_requested_at is not null;

create or replace function public.release_slot_bookings_when_not_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  opportunity_title text;
  released_count integer;
  copy record;
  is_organizer_approved_removal boolean;
begin
  if old.status <> 'accepted' or new.status = 'accepted' then
    return new;
  end if;

  delete from public.opportunity_slot_bookings osb
  where osb.opportunity_id = new.opportunity_id
    and osb.user_id = new.athlete_id;

  get diagnostics released_count = row_count;

  is_organizer_approved_removal :=
    new.status = 'withdrawn' and old.removal_requested_at is not null;

  if released_count > 0 and not is_organizer_approved_removal then
    select o.title
    into opportunity_title
    from public.opportunities o
    where o.id = new.opportunity_id;

    select *
    into copy
    from public.flyloop_notification_copy(
      notification_type := 'slot_bookings_released',
      opportunity_title := opportunity_title
    );

    insert into public.notifications (user_id, title, body, type, opportunity_id)
    values (
      new.athlete_id,
      copy.title,
      copy.body,
      'slot_bookings_released',
      new.opportunity_id
    );
  end if;

  return new;
end;
$$;
