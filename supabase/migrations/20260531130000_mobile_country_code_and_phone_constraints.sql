alter table public.profiles
  add column if not exists mobile_country_code text;

alter table public.profiles
  drop constraint if exists profiles_mobile_country_code_format,
  add constraint profiles_mobile_country_code_format
    check (mobile_country_code is null or mobile_country_code ~ '^\+[1-9][0-9]{1,3}$')
    not valid;

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
    nullif(new.raw_user_meta_data->>'country', ''),
    nullif(new.raw_user_meta_data->>'mobile_country_code', ''),
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
