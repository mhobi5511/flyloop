alter table public.opportunities
  add column if not exists tunnel_time_mode text;

update public.opportunities
set tunnel_time_mode = coalesce(
  tunnel_time_mode,
  'athletes_may_use_own_tunnel_time'
);

alter table public.opportunities
  drop constraint if exists opportunities_tunnel_time_mode_check;

alter table public.opportunities
  add constraint opportunities_tunnel_time_mode_check
  check (
    tunnel_time_mode in (
      'athletes_may_use_own_tunnel_time',
      'tunnel_time_must_be_purchased_through_coach'
    )
  );

alter table public.opportunities
  alter column tunnel_time_mode set default 'athletes_may_use_own_tunnel_time';

alter table public.opportunities
  alter column tunnel_time_mode set not null;
