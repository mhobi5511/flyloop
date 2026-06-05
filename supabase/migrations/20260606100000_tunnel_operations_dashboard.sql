create table if not exists public.opportunity_tunnel_dashboard_links (
  opportunity_id uuid primary key references public.opportunities(id) on delete cascade,
  secret text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunity_slot_booking_events (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  slot_id uuid,
  event_type text not null check (event_type in ('booked', 'removed')),
  slot_date date not null,
  start_time time not null,
  minutes integer not null check (minutes > 0),
  created_at timestamptz not null default now()
);

create index if not exists opportunity_tunnel_dashboard_links_secret_idx
on public.opportunity_tunnel_dashboard_links(secret);

create index if not exists opportunity_slot_booking_events_opportunity_created_idx
on public.opportunity_slot_booking_events(opportunity_id, created_at desc);

create index if not exists opportunity_slot_booking_events_opportunity_user_idx
on public.opportunity_slot_booking_events(opportunity_id, user_id, created_at);

drop trigger if exists opportunity_tunnel_dashboard_links_set_updated_at on public.opportunity_tunnel_dashboard_links;

create trigger opportunity_tunnel_dashboard_links_set_updated_at
before update on public.opportunity_tunnel_dashboard_links
for each row execute function public.set_updated_at();

create or replace function public.log_opportunity_slot_booking_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  slot_record public.opportunity_time_slots%rowtype;
  booking_record public.opportunity_slot_bookings%rowtype;
begin
  if tg_op = 'INSERT' then
    booking_record := new;
  elsif tg_op = 'DELETE' then
    booking_record := old;
  else
    return null;
  end if;

  select *
  into slot_record
  from public.opportunity_time_slots
  where id = booking_record.slot_id;

  if not found then
    return null;
  end if;

  insert into public.opportunity_slot_booking_events (
    opportunity_id,
    user_id,
    slot_id,
    event_type,
    slot_date,
    start_time,
    minutes
  ) values (
    booking_record.opportunity_id,
    booking_record.user_id,
    booking_record.slot_id,
    case when tg_op = 'INSERT' then 'booked' else 'removed' end,
    slot_record.slot_date,
    slot_record.start_time,
    booking_record.minutes
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists opportunity_slot_bookings_log_event_insert on public.opportunity_slot_bookings;
drop trigger if exists opportunity_slot_bookings_log_event_delete on public.opportunity_slot_bookings;

create trigger opportunity_slot_bookings_log_event_insert
after insert on public.opportunity_slot_bookings
for each row execute function public.log_opportunity_slot_booking_event();

create trigger opportunity_slot_bookings_log_event_delete
before delete on public.opportunity_slot_bookings
for each row execute function public.log_opportunity_slot_booking_event();

create or replace function public.log_opportunity_slot_time_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_record public.opportunity_slot_bookings%rowtype;
begin
  if old.slot_date = new.slot_date
    and old.start_time = new.start_time
    and old.duration_minutes = new.duration_minutes
  then
    return new;
  end if;

  for booking_record in
    select *
    from public.opportunity_slot_bookings
    where slot_id = old.id
  loop
    insert into public.opportunity_slot_booking_events (
      opportunity_id,
      user_id,
      slot_id,
      event_type,
      slot_date,
      start_time,
      minutes
    ) values (
      old.opportunity_id,
      booking_record.user_id,
      old.id,
      'removed',
      old.slot_date,
      old.start_time,
      booking_record.minutes
    );

    insert into public.opportunity_slot_booking_events (
      opportunity_id,
      user_id,
      slot_id,
      event_type,
      slot_date,
      start_time,
      minutes
    ) values (
      new.opportunity_id,
      booking_record.user_id,
      new.id,
      'booked',
      new.slot_date,
      new.start_time,
      booking_record.minutes
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists opportunity_time_slots_log_time_change on public.opportunity_time_slots;

create trigger opportunity_time_slots_log_time_change
before update of slot_date, start_time, duration_minutes on public.opportunity_time_slots
for each row execute function public.log_opportunity_slot_time_change();

alter table public.opportunity_tunnel_dashboard_links enable row level security;
alter table public.opportunity_slot_booking_events enable row level security;

drop policy if exists "Organizers read own tunnel dashboard links" on public.opportunity_tunnel_dashboard_links;
drop policy if exists "Organizers create own tunnel dashboard links" on public.opportunity_tunnel_dashboard_links;
drop policy if exists "Organizers read own slot booking events" on public.opportunity_slot_booking_events;

create policy "Organizers read own tunnel dashboard links"
on public.opportunity_tunnel_dashboard_links for select
using (
  exists (
    select 1
    from public.opportunities o
    where o.id = opportunity_tunnel_dashboard_links.opportunity_id
      and o.created_by = auth.uid()
  )
);

create policy "Organizers create own tunnel dashboard links"
on public.opportunity_tunnel_dashboard_links for insert
with check (
  exists (
    select 1
    from public.opportunities o
    where o.id = opportunity_tunnel_dashboard_links.opportunity_id
      and o.created_by = auth.uid()
      and o.type = 'camp'
  )
);

create policy "Organizers read own slot booking events"
on public.opportunity_slot_booking_events for select
using (
  exists (
    select 1
    from public.opportunities o
    where o.id = opportunity_slot_booking_events.opportunity_id
      and o.created_by = auth.uid()
  )
);

grant select, insert on public.opportunity_tunnel_dashboard_links to authenticated;
grant select on public.opportunity_slot_booking_events to authenticated;
