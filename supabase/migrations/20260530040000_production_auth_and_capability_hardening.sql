alter table public.profiles
  add column if not exists wants_to_join_opportunities boolean not null default true,
  add column if not exists wants_to_create_opportunities boolean not null default false,
  add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = user_id and is_admin = true
  );
$$;

create or replace function public.guard_profile_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    if tg_op = 'INSERT' then
      new.is_admin := false;
    elsif new.is_admin is distinct from old.is_admin then
      new.is_admin := old.is_admin;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_admin_fields on public.profiles;

create trigger profiles_guard_admin_fields
before insert or update on public.profiles
for each row execute function public.guard_profile_admin_fields();

drop policy if exists "Admins manage profiles" on public.profiles;
drop policy if exists "Users read own profile" on public.profiles;
drop policy if exists "Organizers read interested user profiles" on public.profiles;
drop policy if exists "Users insert own profile" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
drop policy if exists "Organizers create own opportunities" on public.opportunities;
drop policy if exists "Organizers update own opportunities" on public.opportunities;
drop policy if exists "Organizers delete own opportunities" on public.opportunities;

create policy "Admins manage profiles"
on public.profiles for all
using (public.is_admin())
with check (public.is_admin());

create policy "Users read own profile"
on public.profiles for select
using (id = auth.uid() or public.is_admin());

create policy "Organizers read interested user profiles"
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
);

create policy "Users insert own profile"
on public.profiles for insert
with check (id = auth.uid() and is_admin = false);

create policy "Users update own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid() and is_admin = false);

create policy "Organizers create own opportunities"
on public.opportunities for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles
    where id = auth.uid()
      and wants_to_create_opportunities = true
  )
);

create policy "Organizers update own opportunities"
on public.opportunities for update
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

create policy "Organizers delete own opportunities"
on public.opportunities for delete
using (created_by = auth.uid() or public.is_admin());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_name text;
  selected_purpose text;
begin
  selected_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(new.email, '@', 1),
    'Flyloop user'
  );
  selected_purpose := coalesce(nullif(new.raw_user_meta_data->>'flyloop_purpose', ''), 'join');

  insert into public.profiles (
    id,
    full_name,
    country,
    phone,
    whatsapp_number,
    instagram_handle,
    wants_to_join_opportunities,
    wants_to_create_opportunities,
    is_admin
  ) values (
    new.id,
    selected_name,
    nullif(new.raw_user_meta_data->>'country', ''),
    nullif(new.raw_user_meta_data->>'phone', ''),
    nullif(new.raw_user_meta_data->>'whatsapp_number', ''),
    nullif(new.raw_user_meta_data->>'instagram_handle', ''),
    selected_purpose in ('join', 'both'),
    selected_purpose in ('create', 'both'),
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
