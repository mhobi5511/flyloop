insert into public.profiles (
  id,
  full_name,
  wants_to_join_opportunities,
  wants_to_create_opportunities,
  is_organizer,
  is_admin
)
select
  users.id,
  coalesce(
    nullif(users.raw_user_meta_data->>'full_name', ''),
    split_part(users.email, '@', 1),
    'Flyloop admin'
  ),
  true,
  true,
  true,
  true
from auth.users
where lower(email) = 'marc.hobi@gmx.ch'
on conflict (id) do update
set
  is_admin = true,
  is_organizer = true,
  wants_to_create_opportunities = true,
  updated_at = now();
