do $$
begin
  create type public.participant_profile_status as enum ('registered', 'guest', 'claim_pending', 'archived');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.participant_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  first_name text not null,
  last_name text not null,
  full_name text generated always as (trim(first_name || ' ' || last_name)) stored,
  normalized_email text,
  phone text,
  status public.participant_profile_status not null default 'guest',
  created_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participant_profiles_registered_user_required
    check (status <> 'registered' or user_id is not null),
  constraint participant_profiles_claimed_user_required
    check (claimed_at is null or user_id is not null)
);

create table if not exists public.participant_claim_tokens (
  id uuid primary key default gen_random_uuid(),
  participant_profile_id uuid not null references public.participant_profiles(id) on delete cascade,
  token_hash text not null unique,
  email text,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.participant_audit_events (
  id uuid primary key default gen_random_uuid(),
  participant_profile_id uuid references public.participant_profiles(id) on delete set null,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index participant_profiles_user_id_idx
on public.participant_profiles(user_id);

create index participant_profiles_normalized_email_idx
on public.participant_profiles(normalized_email)
where normalized_email is not null;

create index participant_profiles_status_idx
on public.participant_profiles(status);

create index participant_profiles_name_search_idx
on public.participant_profiles(lower(full_name) text_pattern_ops);

create index participant_claim_tokens_profile_idx
on public.participant_claim_tokens(participant_profile_id);

create index participant_claim_tokens_active_expiry_idx
on public.participant_claim_tokens(expires_at)
where claimed_at is null and revoked_at is null;

create index participant_audit_events_profile_idx
on public.participant_audit_events(participant_profile_id, created_at desc);

create index participant_audit_events_opportunity_idx
on public.participant_audit_events(opportunity_id, created_at desc);

alter table public.opportunity_interests
  add column if not exists participant_profile_id uuid references public.participant_profiles(id) on delete restrict,
  alter column athlete_id drop not null;

alter table public.opportunity_slot_bookings
  add column if not exists participant_profile_id uuid references public.participant_profiles(id) on delete restrict,
  alter column user_id drop not null;

alter table public.camp_day_preferences
  add column if not exists participant_profile_id uuid references public.participant_profiles(id) on delete cascade;

create unique index if not exists opportunity_interests_opportunity_participant_profile_uidx
on public.opportunity_interests(opportunity_id, participant_profile_id)
where participant_profile_id is not null;

create unique index if not exists opportunity_slot_bookings_slot_participant_profile_uidx
on public.opportunity_slot_bookings(slot_id, participant_profile_id)
where participant_profile_id is not null;

create unique index if not exists camp_day_preferences_profile_day_uidx
on public.camp_day_preferences(opportunity_id, participant_profile_id, day_id)
where participant_profile_id is not null;

create index if not exists opportunity_interests_participant_profile_idx
on public.opportunity_interests(participant_profile_id);

create index if not exists opportunity_slot_bookings_opportunity_profile_idx
on public.opportunity_slot_bookings(opportunity_id, participant_profile_id);

create index if not exists camp_day_preferences_participant_profile_idx
on public.camp_day_preferences(participant_profile_id);

create or replace function public.normalize_participant_email(email_value text)
returns text
language sql
immutable
as $$
  select nullif(lower(trim(email_value)), '');
$$;

create or replace function public.name_parts_from_full_name(full_name text)
returns table(first_name text, last_name text)
language sql
immutable
as $$
  select
    coalesce(nullif(split_part(trim(coalesce(full_name, 'Participant')), ' ', 1), ''), 'Participant'),
    nullif(trim(regexp_replace(trim(coalesce(full_name, '')), '^\S+\s*', '')), '');
$$;

drop trigger if exists participant_profiles_set_updated_at on public.participant_profiles;

create trigger participant_profiles_set_updated_at
before update on public.participant_profiles
for each row execute function public.set_updated_at();

insert into public.participant_profiles (
  user_id,
  first_name,
  last_name,
  phone,
  status,
  created_by,
  claimed_at,
  created_at,
  updated_at
)
select
  profiles.id,
  parts.first_name,
  coalesce(parts.last_name, ''),
  coalesce(profiles.whatsapp_number, profiles.phone),
  'registered',
  profiles.id,
  profiles.created_at,
  profiles.created_at,
  profiles.updated_at
from public.profiles
cross join lateral public.name_parts_from_full_name(profiles.full_name) parts
on conflict (user_id) do update
set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  phone = coalesce(public.participant_profiles.phone, excluded.phone),
  status = 'registered',
  claimed_at = coalesce(public.participant_profiles.claimed_at, excluded.claimed_at);

update public.opportunity_interests oi
set participant_profile_id = pp.id
from public.participant_profiles pp
where oi.participant_profile_id is null
  and oi.athlete_id = pp.user_id;

-- Backfill existing slot bookings without firing the pre-existing auth.uid()
-- booking guard. The trigger is recreated below with participant-profile support.
alter table public.opportunity_slot_bookings
  disable trigger opportunity_slot_bookings_guard;

update public.opportunity_slot_bookings osb
set participant_profile_id = pp.id
from public.participant_profiles pp
where osb.participant_profile_id is null
  and osb.user_id = pp.user_id;

alter table public.opportunity_slot_bookings
  enable trigger opportunity_slot_bookings_guard;

update public.camp_day_preferences cdp
set participant_profile_id = pp.id
from public.participant_profiles pp
where cdp.participant_profile_id is null
  and cdp.participant_id = pp.user_id;

create or replace function public.can_manage_opportunity(target_opportunity_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.opportunities o
    where o.id = target_opportunity_id
      and (o.created_by = target_user_id or public.is_admin(target_user_id))
  );
$$;

create or replace function public.can_read_participant_profile(target_participant_profile_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.participant_profiles pp
    where pp.id = target_participant_profile_id
      and pp.user_id = target_user_id
  )
  or exists (
    select 1
    from public.opportunity_interests oi
    join public.opportunities o on o.id = oi.opportunity_id
    where oi.participant_profile_id = target_participant_profile_id
      and o.created_by = target_user_id
  )
  or public.is_admin(target_user_id);
$$;

create or replace function public.ensure_opportunity_interest_participant_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.participant_profile_id is null and new.athlete_id is not null then
    select pp.id
    into new.participant_profile_id
    from public.participant_profiles pp
    where pp.user_id = new.athlete_id;
  end if;

  if new.athlete_id is null and new.participant_profile_id is not null then
    select pp.user_id
    into new.athlete_id
    from public.participant_profiles pp
    where pp.id = new.participant_profile_id;
  end if;

  if new.participant_profile_id is null then
    raise exception 'Participant profile is required';
  end if;

  return new;
end;
$$;

drop trigger if exists opportunity_interests_ensure_participant_profile on public.opportunity_interests;

create trigger opportunity_interests_ensure_participant_profile
before insert or update of athlete_id, participant_profile_id on public.opportunity_interests
for each row execute function public.ensure_opportunity_interest_participant_profile();

create or replace function public.ensure_camp_day_preference_participant_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.participant_profile_id is null and new.participant_id is not null then
    select pp.id
    into new.participant_profile_id
    from public.participant_profiles pp
    where pp.user_id = new.participant_id;
  end if;

  if new.participant_id is null and new.participant_profile_id is not null then
    select pp.user_id
    into new.participant_id
    from public.participant_profiles pp
    where pp.id = new.participant_profile_id;
  end if;

  return new;
end;
$$;

drop trigger if exists camp_day_preferences_ensure_participant_profile on public.camp_day_preferences;

create trigger camp_day_preferences_ensure_participant_profile
before insert or update of participant_id, participant_profile_id on public.camp_day_preferences
for each row execute function public.ensure_camp_day_preference_participant_profile();

alter table public.participant_profiles enable row level security;
alter table public.participant_claim_tokens enable row level security;
alter table public.participant_audit_events enable row level security;

create policy "Participants and coaches read scoped participant profiles"
on public.participant_profiles for select
using (public.can_read_participant_profile(id));

create policy "Participants update own claimed participant profile"
on public.participant_profiles for update
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "Admins manage participant profiles"
on public.participant_profiles for all
using (public.is_admin())
with check (public.is_admin());

create policy "Coaches read scoped claim tokens"
on public.participant_claim_tokens for select
using (
  public.is_admin()
  or exists (
    select 1
    from public.opportunity_interests oi
    join public.opportunities o on o.id = oi.opportunity_id
    where oi.participant_profile_id = participant_claim_tokens.participant_profile_id
      and o.created_by = auth.uid()
  )
);

create policy "Coaches read scoped participant audit events"
on public.participant_audit_events for select
using (
  public.is_admin()
  or (
    opportunity_id is not null
    and public.can_manage_opportunity(opportunity_id)
  )
  or (
    participant_profile_id is not null
    and public.can_read_participant_profile(participant_profile_id)
  )
);

create or replace function public.search_participant_profiles(
  target_opportunity_id uuid,
  search_query text,
  result_limit integer default 12
)
returns table (
  participant_profile_id uuid,
  user_id uuid,
  full_name text,
  normalized_email text,
  phone text,
  status public.participant_profile_status,
  already_in_opportunity boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_query text := lower(trim(coalesce(search_query, '')));
  limited_count integer := least(greatest(coalesce(result_limit, 12), 1), 25);
begin
  if auth.uid() is null or not public.can_manage_opportunity(target_opportunity_id) then
    raise exception 'Opportunity not found'
      using errcode = '42501';
  end if;

  if length(normalized_query) < 2 then
    return;
  end if;

  return query
  select
    pp.id,
    pp.user_id,
    pp.full_name,
    pp.normalized_email,
    pp.phone,
    pp.status,
    exists (
      select 1
      from public.opportunity_interests oi
      where oi.opportunity_id = target_opportunity_id
        and oi.participant_profile_id = pp.id
        and oi.status <> 'withdrawn'
    ) as already_in_opportunity
  from public.participant_profiles pp
  where pp.archived_at is null
    and (
      lower(pp.full_name) like normalized_query || '%'
      or pp.normalized_email = public.normalize_participant_email(normalized_query)
      or (
        length(normalized_query) >= 3
        and lower(pp.full_name) like '%' || normalized_query || '%'
      )
    )
    and (
      pp.user_id is not null
      or exists (
        select 1
        from public.opportunity_interests scoped_oi
        join public.opportunities scoped_o on scoped_o.id = scoped_oi.opportunity_id
        where scoped_oi.participant_profile_id = pp.id
          and scoped_o.created_by = auth.uid()
      )
      or pp.created_by = auth.uid()
      or public.is_admin()
    )
  order by
    case when pp.normalized_email = public.normalize_participant_email(normalized_query) then 0 else 1 end,
    lower(pp.full_name)
  limit limited_count;
end;
$$;

create or replace function public.add_participant_profile_to_opportunity(
  target_opportunity_id uuid,
  target_participant_profile_id uuid,
  target_status public.interest_status default 'accepted',
  coach_note text default null
)
returns table (
  interest_id uuid,
  participant_profile_id uuid,
  user_id uuid,
  full_name text,
  normalized_email text,
  phone text,
  status public.interest_status,
  participant_status public.participant_profile_status,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  opportunity_record public.opportunities%rowtype;
  profile_record public.participant_profiles%rowtype;
  interest_record public.opportunity_interests%rowtype;
  safe_status public.interest_status := coalesce(target_status, 'accepted');
begin
  if auth.uid() is null then
    raise exception 'Please log in again'
      using errcode = '42501';
  end if;

  select *
  into opportunity_record
  from public.opportunities
  where id = target_opportunity_id
  for update;

  if not found or opportunity_record.created_by <> auth.uid() then
    raise exception 'Opportunity not found'
      using errcode = '42501';
  end if;

  select *
  into profile_record
  from public.participant_profiles
  where id = target_participant_profile_id
    and archived_at is null
  for update;

  if not found then
    raise exception 'Participant not found';
  end if;

  if safe_status = 'withdrawn' then
    raise exception 'Choose an active participant status';
  end if;

  insert into public.opportunity_interests (
    opportunity_id,
    athlete_id,
    participant_profile_id,
    status,
    message,
    interest_type
  )
  values (
    target_opportunity_id,
    profile_record.user_id,
    profile_record.id,
    safe_status,
    nullif(trim(coach_note), ''),
    'application'
  )
  on conflict (opportunity_id, participant_profile_id)
  where participant_profile_id is not null
  do update set
    status = excluded.status,
    message = coalesce(public.opportunity_interests.message, excluded.message),
    updated_at = now()
  returning * into interest_record;

  insert into public.participant_audit_events (
    participant_profile_id,
    opportunity_id,
    actor_id,
    event_type,
    metadata
  )
  values (
    profile_record.id,
    target_opportunity_id,
    auth.uid(),
    'guest_added_to_opportunity',
    jsonb_build_object('interest_id', interest_record.id)
  );

  return query
  select
    interest_record.id,
    profile_record.id,
    profile_record.user_id,
    profile_record.full_name,
    profile_record.normalized_email,
    profile_record.phone,
    interest_record.status,
    profile_record.status,
    interest_record.created_at;
end;
$$;

create or replace function public.create_guest_participant_for_opportunity(
  target_opportunity_id uuid,
  first_name_value text,
  last_name_value text,
  email_value text default null,
  phone_value text default null,
  coach_note text default null
)
returns table (
  interest_id uuid,
  participant_profile_id uuid,
  user_id uuid,
  full_name text,
  normalized_email text,
  phone text,
  status public.interest_status,
  participant_status public.participant_profile_status,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email_value text := public.normalize_participant_email(email_value);
  existing_profile_id uuid;
  created_profile_id uuid;
begin
  if auth.uid() is null or not public.can_manage_opportunity(target_opportunity_id) then
    raise exception 'Opportunity not found'
      using errcode = '42501';
  end if;

  if nullif(trim(first_name_value), '') is null or nullif(trim(last_name_value), '') is null then
    raise exception 'First and last name are required';
  end if;

  if normalized_email_value is not null then
    select pp.id
    into existing_profile_id
    from public.participant_profiles pp
    where pp.normalized_email = normalized_email_value
      and pp.archived_at is null
      and (
        pp.user_id is not null
        or pp.created_by = auth.uid()
        or exists (
          select 1
          from public.opportunity_interests oi
          join public.opportunities o on o.id = oi.opportunity_id
          where oi.participant_profile_id = pp.id
            and o.created_by = auth.uid()
        )
        or public.is_admin()
      )
    order by case when pp.user_id is not null then 0 else 1 end, pp.created_at asc
    limit 1;

    if existing_profile_id is not null then
      return query
      select *
      from public.add_participant_profile_to_opportunity(
        target_opportunity_id,
        existing_profile_id,
        'accepted',
        coach_note
      );
      return;
    end if;
  end if;

  insert into public.participant_profiles (
    first_name,
    last_name,
    normalized_email,
    phone,
    status,
    created_by
  )
  values (
    trim(first_name_value),
    trim(last_name_value),
    normalized_email_value,
    nullif(trim(phone_value), ''),
    'guest',
    auth.uid()
  )
  returning id into created_profile_id;

  insert into public.participant_audit_events (
    participant_profile_id,
    opportunity_id,
    actor_id,
    event_type,
    metadata
  )
  values (
    created_profile_id,
    target_opportunity_id,
    auth.uid(),
    'guest_participant_created',
    jsonb_build_object('has_email', normalized_email_value is not null)
  );

  return query
  select *
  from public.add_participant_profile_to_opportunity(
    target_opportunity_id,
    created_profile_id,
    'accepted',
    coach_note
  );
end;
$$;

create or replace function public.generate_participant_claim_token(
  target_opportunity_id uuid,
  target_participant_profile_id uuid,
  token_hash_value text,
  email_value text default null,
  expires_in interval default interval '14 days'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_token_id uuid;
begin
  if auth.uid() is null or not public.can_manage_opportunity(target_opportunity_id) then
    raise exception 'Opportunity not found'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = target_opportunity_id
      and oi.participant_profile_id = target_user_id
      and oi.status <> 'withdrawn'
  ) then
    raise exception 'Participant is not in this opportunity';
  end if;

  update public.participant_claim_tokens
  set revoked_at = now()
  where participant_profile_id = target_participant_profile_id
    and claimed_at is null
    and revoked_at is null;

  insert into public.participant_claim_tokens (
    participant_profile_id,
    token_hash,
    email,
    expires_at,
    created_by
  )
  values (
    target_participant_profile_id,
    token_hash_value,
    public.normalize_participant_email(email_value),
    now() + coalesce(expires_in, interval '14 days'),
    auth.uid()
  )
  returning id into created_token_id;

  update public.participant_profiles
  set status = 'claim_pending'
  where id = target_participant_profile_id
    and user_id is null
    and status = 'guest';

  insert into public.participant_audit_events (
    participant_profile_id,
    opportunity_id,
    actor_id,
    event_type
  )
  values (
    target_participant_profile_id,
    target_opportunity_id,
    auth.uid(),
    'invitation_generated'
  );

  return created_token_id;
end;
$$;

create or replace function public.claim_participant_profile(token_hash_value text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  token_record public.participant_claim_tokens%rowtype;
  profile_record public.participant_profiles%rowtype;
begin
  if current_user_id is null then
    raise exception 'Please log in again'
      using errcode = '42501';
  end if;

  select *
  into token_record
  from public.participant_claim_tokens
  where token_hash = token_hash_value
  for update;

  if not found or token_record.claimed_at is not null or token_record.revoked_at is not null then
    raise exception 'This claim link is no longer valid';
  end if;

  if token_record.expires_at <= now() then
    raise exception 'This claim link has expired';
  end if;

  select *
  into profile_record
  from public.participant_profiles
  where id = token_record.participant_profile_id
  for update;

  if not found or profile_record.user_id is not null then
    raise exception 'This participant profile is already claimed';
  end if;

  if exists (
    select 1
    from public.participant_profiles pp
    where pp.user_id = current_user_id
      and pp.id <> profile_record.id
  ) then
    raise exception 'This account is already connected to another participant profile';
  end if;

  update public.participant_profiles
  set
    user_id = current_user_id,
    status = 'registered',
    claimed_at = now()
  where id = profile_record.id;

  update public.opportunity_interests
  set athlete_id = current_user_id
  where participant_profile_id = profile_record.id
    and athlete_id is null;

  update public.opportunity_slot_bookings
  set user_id = current_user_id
  where participant_profile_id = profile_record.id
    and user_id is null;

  update public.camp_day_preferences
  set participant_id = current_user_id
  where participant_profile_id = profile_record.id
    and participant_id is null;

  update public.participant_claim_tokens
  set claimed_at = now()
  where id = token_record.id;

  update public.participant_claim_tokens
  set revoked_at = now()
  where participant_profile_id = profile_record.id
    and id <> token_record.id
    and claimed_at is null
    and revoked_at is null;

  insert into public.participant_audit_events (
    participant_profile_id,
    actor_id,
    event_type
  )
  values (
    profile_record.id,
    current_user_id,
    'profile_claimed'
  );

  return profile_record.id;
end;
$$;

create or replace function public.guard_opportunity_slot_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  slot_record public.opportunity_time_slots%rowtype;
  opportunity_owner uuid;
  current_booking_count integer;
  interest_record public.opportunity_interests%rowtype;
  booking_participant_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authorized to book this slot'
      using errcode = '42501';
  end if;

  select *
  into slot_record
  from public.opportunity_time_slots
  where id = new.slot_id
  for update;

  if not found then
    raise exception 'Slot does not exist';
  end if;

  select created_by
  into opportunity_owner
  from public.opportunities
  where id = slot_record.opportunity_id;

  if not found then
    raise exception 'Opportunity not found';
  end if;

  if new.participant_profile_id is null and new.user_id is not null then
    select pp.id
    into booking_participant_profile_id
    from public.participant_profiles pp
    where pp.user_id = new.user_id;

    new.participant_profile_id := booking_participant_profile_id;
  end if;

  if new.participant_profile_id is null then
    raise exception 'Participant profile is required';
  end if;

  if new.user_id = auth.uid() then
    select *
    into interest_record
    from public.opportunity_interests oi
    where oi.opportunity_id = new.opportunity_id
      and oi.participant_profile_id = new.participant_profile_id
      and oi.athlete_id = new.user_id
    for update;

    if slot_record.opportunity_id <> new.opportunity_id then
      raise exception 'Booking opportunity must match slot opportunity';
    end if;

    if not found or interest_record.status <> 'accepted' then
      raise exception 'Only accepted participants can book slots'
        using errcode = '42501';
    end if;

    if not coalesce(interest_record.self_booking_enabled, false) then
      raise exception 'Self-booking is not enabled for this participant'
        using errcode = '42501';
    end if;

    if tg_op = 'UPDATE' and coalesce(interest_record.self_booking_enabled, false) then
      if new.opportunity_id is distinct from old.opportunity_id
        or new.slot_id is distinct from old.slot_id
        or new.user_id is distinct from old.user_id
        or new.participant_profile_id is distinct from old.participant_profile_id
        or new.minutes is distinct from old.minutes
        or new.is_final is distinct from old.is_final
        or new.finalized_at is distinct from old.finalized_at
      then
        if new.release_requested_at is not null
          and new.release_requested_by = auth.uid()
        then
          return new;
        end if;

        raise exception 'Self-booking participants may only request slot release'
          using errcode = '42501';
      end if;

      if new.release_requested_at is null
        or new.release_requested_by is distinct from auth.uid()
      then
        raise exception 'Self-booking release requests must be submitted by the participant'
          using errcode = '42501';
      end if;

      return new;
    end if;
  elsif opportunity_owner <> auth.uid() then
    raise exception 'Not authorized to book this slot'
      using errcode = '42501';
  end if;

  if slot_record.opportunity_id <> new.opportunity_id then
    raise exception 'Booking opportunity must match slot opportunity';
  end if;

  if not exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = new.opportunity_id
      and oi.participant_profile_id = new.participant_profile_id
      and oi.status = 'accepted'
      and oi.interest_type <> 'timetable_reminder'
  ) then
    raise exception 'Only accepted participants can be assigned'
      using errcode = '42501';
  end if;

  select count(*)
  into current_booking_count
  from public.opportunity_slot_bookings osb
  where osb.slot_id = new.slot_id
    and (tg_op <> 'UPDATE' or osb.id <> new.id);

  if current_booking_count >= slot_record.capacity then
    raise exception 'Slot is full';
  end if;

  return new;
end;
$$;

create or replace function public.assign_opportunity_slot_booking(
  target_opportunity_id uuid,
  target_slot_id uuid,
  target_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  opportunity_record public.opportunities%rowtype;
  slot_record public.opportunity_time_slots%rowtype;
  participant_record public.participant_profiles%rowtype;
  current_booking_count integer;
  inserted_booking_id uuid;
begin
  if current_user_id is null then
    raise exception 'Please log in again'
      using errcode = '42501';
  end if;

  select *
  into opportunity_record
  from public.opportunities
  where id = target_opportunity_id
  for update;

  if not found then
    raise exception 'Opportunity not found';
  end if;

  if opportunity_record.type <> 'camp' then
    raise exception 'Assign Slot is only available for Camps';
  end if;

  if opportunity_record.created_by <> current_user_id then
    raise exception 'Only the coach can assign slots'
      using errcode = '42501';
  end if;

  select *
  into participant_record
  from public.participant_profiles
  where id = target_user_id
    and archived_at is null
  for update;

  if not found or participant_record.user_id = opportunity_record.created_by then
    raise exception 'Choose a valid participant';
  end if;

  select *
  into slot_record
  from public.opportunity_time_slots
  where id = target_slot_id
    and opportunity_id = target_opportunity_id
    and is_published = true
  for update;

  if not found then
    raise exception 'Slot is no longer available';
  end if;

  if not exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = target_opportunity_id
      and oi.participant_profile_id = target_user_id
      and oi.status = 'accepted'
      and oi.interest_type <> 'timetable_reminder'
  ) then
    raise exception 'Only accepted participants can be assigned';
  end if;

  if exists (
    select 1
    from public.opportunity_slot_bookings osb
    where osb.slot_id = target_slot_id
      and osb.participant_profile_id = target_user_id
  ) then
    raise exception 'This participant is already assigned to that slot';
  end if;

  select count(*)
  into current_booking_count
  from public.opportunity_slot_bookings osb
  where osb.slot_id = target_slot_id;

  if current_booking_count >= slot_record.capacity then
    raise exception 'Slot is full';
  end if;

  insert into public.opportunity_slot_bookings (
    slot_id,
    opportunity_id,
    user_id,
    participant_profile_id,
    minutes,
    is_final
  ) values (
    target_slot_id,
    target_opportunity_id,
    participant_record.user_id,
    participant_record.id,
    slot_record.duration_minutes,
    false
  )
  returning id into inserted_booking_id;

  return inserted_booking_id;
end;
$$;

create or replace function public.sync_participant_slot_booking_draft(
  target_opportunity_id uuid,
  target_user_id uuid,
  target_slot_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  opportunity_record public.opportunities%rowtype;
  participant_record public.participant_profiles%rowtype;
  normalized_slot_ids uuid[];
  slot_record record;
  selected_slot_count integer;
  current_booking_count integer;
  removed_count integer := 0;
  inserted_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'Please log in again'
      using errcode = '42501';
  end if;

  select *
  into opportunity_record
  from public.opportunities
  where id = target_opportunity_id
  for share;

  if not found then
    raise exception 'Opportunity not found';
  end if;

  if opportunity_record.type <> 'camp' then
    raise exception 'Mass Booking is only available for Camps';
  end if;

  if opportunity_record.created_by <> current_user_id then
    raise exception 'Only the coach can assign slots'
      using errcode = '42501';
  end if;

  select *
  into participant_record
  from public.participant_profiles
  where id = target_user_id
    and archived_at is null
  for update;

  if not found or participant_record.user_id = opportunity_record.created_by then
    raise exception 'Choose a valid participant';
  end if;

  if coalesce(cardinality(target_slot_ids), 0) > 500 then
    raise exception 'Choose no more than 500 slots at once';
  end if;

  perform oi.id
  from public.opportunity_interests oi
  where oi.opportunity_id = target_opportunity_id
    and oi.participant_profile_id = target_user_id
    and oi.status = 'accepted'
    and oi.interest_type <> 'timetable_reminder'
  for update;

  if not found then
    raise exception 'Only accepted participants can be assigned'
      using errcode = '42501';
  end if;

  select coalesce(array_agg(slot_id order by slot_id), '{}'::uuid[])
  into normalized_slot_ids
  from (
    select distinct requested_slot_id as slot_id
    from unnest(coalesce(target_slot_ids, '{}'::uuid[]))
      as requested_slots(requested_slot_id)
    where requested_slot_id is not null
  ) requested_slots;

  perform ots.id
  from public.opportunity_time_slots ots
  where ots.opportunity_id = target_opportunity_id
    and ots.id = any(normalized_slot_ids)
  order by ots.id
  for update;

  select count(*)::integer
  into selected_slot_count
  from public.opportunity_time_slots ots
  where ots.opportunity_id = target_opportunity_id
    and ots.id = any(normalized_slot_ids);

  if selected_slot_count <> cardinality(normalized_slot_ids) then
    raise exception 'One or more selected slots are no longer available';
  end if;

  for slot_record in
    select ots.id, ots.capacity, ots.duration_minutes
    from public.opportunity_time_slots ots
    where ots.opportunity_id = target_opportunity_id
      and ots.id = any(normalized_slot_ids)
      and not exists (
        select 1
        from public.opportunity_slot_bookings existing_booking
        where existing_booking.slot_id = ots.id
          and existing_booking.participant_profile_id = target_user_id
      )
    order by ots.id
  loop
    select count(*)::integer
    into current_booking_count
    from public.opportunity_slot_bookings osb
    where osb.slot_id = slot_record.id;

    if current_booking_count >= slot_record.capacity then
      raise exception 'One or more selected slots are full';
    end if;
  end loop;

  delete from public.opportunity_slot_bookings osb
  where osb.opportunity_id = target_opportunity_id
    and osb.participant_profile_id = target_user_id
    and not (osb.slot_id = any(normalized_slot_ids));

  get diagnostics removed_count = row_count;

  insert into public.opportunity_slot_bookings (
    slot_id,
    opportunity_id,
    user_id,
    participant_profile_id,
    minutes,
    is_final,
    finalized_at,
    release_requested_at,
    release_requested_by
  )
  select
    ots.id,
    target_opportunity_id,
    participant_record.user_id,
    participant_record.id,
    ots.duration_minutes,
    false,
    null,
    null,
    null
  from public.opportunity_time_slots ots
  where ots.opportunity_id = target_opportunity_id
    and ots.id = any(normalized_slot_ids)
    and not exists (
      select 1
      from public.opportunity_slot_bookings existing_booking
      where existing_booking.slot_id = ots.id
        and existing_booking.participant_profile_id = target_user_id
    )
  order by ots.id;

  get diagnostics inserted_count = row_count;

  return jsonb_build_object(
    'inserted_count', inserted_count,
    'removed_count', removed_count,
    'notification_created', false
  );
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
  inserted_count integer := 0;
  copy record;
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

  select *
  into copy
  from public.flyloop_notification_copy(
    notification_type := 'timetable_published',
    opportunity_title := opportunity_record.title
  );

  with updated_users as (
    update public.opportunity_slot_bookings osb
    set
      is_final = true,
      finalized_at = coalesce(osb.finalized_at, now())
    where osb.opportunity_id = target_opportunity_id
      and osb.is_final = false
    returning osb.user_id
  )
  insert into public.notifications (user_id, title, body, type, opportunity_id)
  select distinct
    updated_users.user_id,
    copy.title,
    copy.body,
    'timetable_published',
    target_opportunity_id
  from updated_users
  where updated_users.user_id is not null
    and updated_users.user_id <> opportunity_record.created_by
    and not exists (
      select 1
      from public.notifications n
      where n.user_id = updated_users.user_id
        and n.opportunity_id = target_opportunity_id
        and n.type = 'timetable_published'
        and n.read = false
    );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

drop policy if exists "Coaches read athletes interested in own opportunities" on public.profiles;
create policy "Coaches read athletes interested in own opportunities"
on public.profiles for select
using (
  public.is_admin()
  or exists (
    select 1
    from public.opportunity_interests oi
    join public.opportunities o on o.id = oi.opportunity_id
    where oi.athlete_id = profiles.id
      and o.created_by = auth.uid()
  )
  or exists (
    select 1
    from public.participant_profiles pp
    join public.opportunity_interests oi on oi.participant_profile_id = pp.id
    join public.opportunities o on o.id = oi.opportunity_id
    where pp.user_id = profiles.id
      and o.created_by = auth.uid()
  )
);

drop policy if exists "Athletes create interests for published opportunities" on public.opportunity_interests;
create policy "Athletes create interests for published opportunities"
on public.opportunity_interests for insert
with check (
  athlete_id = auth.uid()
  and participant_profile_id in (
    select pp.id from public.participant_profiles pp where pp.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.opportunities
    where id = opportunity_id
      and status = 'published'
      and available_spots > 0
  )
);

drop policy if exists "Athletes read own interests" on public.opportunity_interests;
create policy "Athletes read own interests"
on public.opportunity_interests for select
using (
  athlete_id = auth.uid()
  or participant_profile_id in (
    select pp.id from public.participant_profiles pp where pp.user_id = auth.uid()
  )
  or public.is_admin()
);

drop policy if exists "Accepted participants read own slot bookings" on public.opportunity_slot_bookings;
create policy "Accepted participants read own slot bookings"
on public.opportunity_slot_bookings for select
using (
  (
    user_id = auth.uid()
    or participant_profile_id in (
      select pp.id from public.participant_profiles pp where pp.user_id = auth.uid()
    )
  )
  and exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = opportunity_slot_bookings.opportunity_id
      and oi.participant_profile_id = opportunity_slot_bookings.participant_profile_id
      and oi.status = 'accepted'
  )
);

drop policy if exists "Accepted participants create own slot bookings" on public.opportunity_slot_bookings;
create policy "Accepted participants create own slot bookings"
on public.opportunity_slot_bookings for insert
with check (
  user_id = auth.uid()
  and participant_profile_id in (
    select pp.id from public.participant_profiles pp where pp.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.opportunity_time_slots ots
    where ots.id = opportunity_slot_bookings.slot_id
      and ots.opportunity_id = opportunity_slot_bookings.opportunity_id
  )
  and exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = opportunity_slot_bookings.opportunity_id
      and oi.participant_profile_id = opportunity_slot_bookings.participant_profile_id
      and oi.status = 'accepted'
  )
);

drop policy if exists "Accepted participants delete own slot bookings" on public.opportunity_slot_bookings;
create policy "Accepted participants delete own slot bookings"
on public.opportunity_slot_bookings for delete
using (
  user_id = auth.uid()
  and participant_profile_id in (
    select pp.id from public.participant_profiles pp where pp.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = opportunity_slot_bookings.opportunity_id
      and oi.participant_profile_id = opportunity_slot_bookings.participant_profile_id
      and oi.status = 'accepted'
  )
);

grant select, update on public.participant_profiles to authenticated;
grant select on public.participant_claim_tokens to authenticated;
grant select on public.participant_audit_events to authenticated;
grant execute on function public.normalize_participant_email(text) to authenticated;
grant execute on function public.search_participant_profiles(uuid, text, integer) to authenticated;
grant execute on function public.add_participant_profile_to_opportunity(uuid, uuid, public.interest_status, text) to authenticated;
grant execute on function public.create_guest_participant_for_opportunity(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.generate_participant_claim_token(uuid, uuid, text, text, interval) to authenticated;
grant execute on function public.claim_participant_profile(text) to authenticated;

create or replace function public.release_participant_slot_bookings(
  target_opportunity_id uuid,
  target_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  opportunity_record public.opportunities%rowtype;
  participant_record public.participant_profiles%rowtype;
  released_count integer;
begin
  if current_user_id is null then
    raise exception 'Please log in again'
      using errcode = '42501';
  end if;

  select *
  into opportunity_record
  from public.opportunities
  where id = target_opportunity_id;

  if not found then
    raise exception 'Opportunity not found';
  end if;

  if opportunity_record.created_by <> current_user_id then
    raise exception 'Only the coach can release participant times'
      using errcode = '42501';
  end if;

  select *
  into participant_record
  from public.participant_profiles
  where id = target_user_id;

  if not found then
    raise exception 'Participant not found';
  end if;

  delete from public.opportunity_slot_bookings osb
  where osb.opportunity_id = target_opportunity_id
    and osb.participant_profile_id = target_user_id;

  get diagnostics released_count = row_count;

  if participant_record.user_id is not null and released_count > 0 then
    insert into public.notifications (user_id, title, body, type, opportunity_id)
    select
      participant_record.user_id,
      copy.title,
      copy.body,
      'slot_bookings_released_by_organizer',
      target_opportunity_id
    from public.flyloop_notification_copy(
      notification_type := 'slot_booking_released_by_organizer',
      opportunity_title := opportunity_record.title
    ) copy
    where not exists (
      select 1
      from public.notifications n
      where n.user_id = participant_record.user_id
        and n.opportunity_id = target_opportunity_id
        and n.type = 'slot_bookings_released_by_organizer'
        and n.read = false
    );
  end if;

  return released_count;
end;
$$;

revoke execute on function public.release_participant_slot_bookings(uuid, uuid) from public;
revoke execute on function public.release_participant_slot_bookings(uuid, uuid) from anon;
grant execute on function public.release_participant_slot_bookings(uuid, uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_name text;
  organizer_enabled boolean;
  metadata jsonb;
  parts record;
begin
  metadata := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  selected_name := coalesce(
    nullif(metadata->>'full_name', ''),
    split_part(new.email, '@', 1),
    'Flyloop user'
  );
  organizer_enabled := coalesce(
    case
      when lower(coalesce(metadata->>'wants_to_create_opportunities', '')) in ('true', '1', 'yes') then true
      when lower(coalesce(metadata->>'wants_to_create_opportunities', '')) in ('false', '0', 'no') then false
      else null
    end,
    case
      when lower(coalesce(metadata->>'is_organizer', '')) in ('true', '1', 'yes') then true
      when lower(coalesce(metadata->>'is_organizer', '')) in ('false', '0', 'no') then false
      else null
    end,
    true
  );

  insert into public.profiles (
    id,
    full_name,
    country,
    city,
    bio,
    disciplines,
    home_tunnel_id,
    website_url,
    youtube_url,
    mobile_country_code,
    phone,
    whatsapp_number,
    instagram_handle,
    wants_to_join_opportunities,
    wants_to_create_opportunities,
    is_organizer,
    use_location_recommendations,
    is_admin
  ) values (
    new.id,
    selected_name,
    nullif(metadata->>'country', ''),
    nullif(metadata->>'city', ''),
    nullif(metadata->>'bio', ''),
    coalesce(
      array(select jsonb_array_elements_text(metadata->'disciplines')),
      '{}'::text[]
    ),
    nullif(metadata->>'home_tunnel_id', '')::uuid,
    nullif(metadata->>'website_url', ''),
    nullif(metadata->>'youtube_url', ''),
    nullif(metadata->>'mobile_country_code', ''),
    nullif(metadata->>'phone', ''),
    nullif(metadata->>'whatsapp_number', ''),
    nullif(metadata->>'instagram_handle', ''),
    true,
    organizer_enabled,
    organizer_enabled,
    false,
    false
  )
  on conflict (id) do nothing;

  select *
  into parts
  from public.name_parts_from_full_name(coalesce(selected_name, 'Flyloop user'));

  insert into public.participant_profiles (
    user_id,
    first_name,
    last_name,
    normalized_email,
    phone,
    status,
    created_by,
    claimed_at
  )
  values (
    new.id,
    parts.first_name,
    coalesce(parts.last_name, ''),
    public.normalize_participant_email(new.email),
    coalesce(nullif(metadata->>'whatsapp_number', ''), nullif(metadata->>'phone', '')),
    'registered',
    new.id,
    now()
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;
