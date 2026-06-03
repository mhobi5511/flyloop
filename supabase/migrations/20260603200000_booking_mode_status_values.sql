do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'opportunity_booking_mode'
  ) then
    create type public.opportunity_booking_mode as enum (
      'approval_required',
      'direct_time_booking'
    );
  end if;
end
$$;

alter table public.opportunities
  add column if not exists booking_mode public.opportunity_booking_mode;

update public.opportunities
set booking_mode = 'approval_required'
where booking_mode is null;

alter table public.opportunities
  alter column booking_mode set default 'approval_required',
  alter column booking_mode set not null;

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

alter type public.interest_status add value if not exists 'withdrawn';
