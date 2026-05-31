create or replace function public.cache_tunnel_geocode(
  target_tunnel_id uuid,
  target_city text,
  target_country text,
  target_latitude double precision,
  target_longitude double precision
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if auth.uid() is null then
    return false;
  end if;

  if target_latitude < -90
    or target_latitude > 90
    or target_longitude < -180
    or target_longitude > 180 then
    return false;
  end if;

  update public.tunnel_profiles
  set
    latitude = target_latitude,
    longitude = target_longitude,
    updated_at = now()
  where id = target_tunnel_id
    and latitude is null
    and longitude is null
    and lower(trim(city)) = lower(trim(target_city))
    and lower(trim(country)) = lower(trim(target_country));

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

grant execute on function public.cache_tunnel_geocode(
  uuid,
  text,
  text,
  double precision,
  double precision
) to authenticated;
