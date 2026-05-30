alter table public.profiles
  add column if not exists is_organizer boolean not null default false,
  add column if not exists use_location_recommendations boolean not null default false;

update public.profiles
set
  is_organizer = coalesce(is_organizer, false) or coalesce(wants_to_create_opportunities, false),
  wants_to_join_opportunities = true,
  wants_to_create_opportunities = coalesce(is_organizer, false) or coalesce(wants_to_create_opportunities, false);

drop policy if exists "Organizers create own opportunities" on public.opportunities;

create policy "Organizers create own opportunities"
on public.opportunities for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_organizer = true
  )
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_name text;
  organizer_enabled boolean;
begin
  selected_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(new.email, '@', 1),
    'Flyloop user'
  );
  organizer_enabled := coalesce((new.raw_user_meta_data->>'is_organizer')::boolean, false);

  insert into public.profiles (
    id,
    full_name,
    country,
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
    nullif(new.raw_user_meta_data->>'country', ''),
    nullif(new.raw_user_meta_data->>'phone', ''),
    nullif(new.raw_user_meta_data->>'whatsapp_number', ''),
    nullif(new.raw_user_meta_data->>'instagram_handle', ''),
    true,
    organizer_enabled,
    organizer_enabled,
    false,
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
