create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_name text;
begin
  selected_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(new.email, '@', 1),
    'Flyloop user'
  );

  insert into public.profiles (
    id,
    role,
    full_name,
    country,
    disciplines
  ) values (
    new.id,
    'athlete',
    selected_name,
    nullif(new.raw_user_meta_data->>'country', ''),
    '{}'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
