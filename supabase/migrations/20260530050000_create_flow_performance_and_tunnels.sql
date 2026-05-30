alter table public.opportunities
  alter column registration_deadline drop not null;

create or replace function public.is_last_minute_opportunity(
  start_date date,
  registration_deadline date,
  available_spots integer,
  status public.opportunity_status,
  starts_within_days integer default 10,
  deadline_window_days integer default 3
)
returns boolean
language sql
stable
as $$
  select coalesce(
    status = 'published'
    and available_spots > 0
    and registration_deadline is not null
    and start_date >= current_date
    and start_date <= current_date + starts_within_days
    and registration_deadline >= current_date - 1
    and registration_deadline <= current_date + deadline_window_days,
    false
  );
$$;

alter table public.tunnel_profiles
  add column if not exists verified boolean not null default false,
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

create index if not exists tunnel_profiles_verified_idx
on public.tunnel_profiles(verified);

create index if not exists tunnel_profiles_created_by_idx
on public.tunnel_profiles(created_by);

drop policy if exists "Users add unverified tunnel profiles" on public.tunnel_profiles;

create policy "Users add unverified tunnel profiles"
on public.tunnel_profiles for insert
with check (
  created_by = auth.uid()
  and verified = false
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and wants_to_create_opportunities = true
  )
);

grant insert on public.tunnel_profiles to authenticated;
