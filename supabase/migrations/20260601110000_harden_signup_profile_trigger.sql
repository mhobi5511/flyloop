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

  return new;
end;
$$;
