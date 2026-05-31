create or replace function public.is_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt()->>'email', '')) = 'marc.hobi@gmx.ch';
$$;

update public.profiles p
set
  is_admin = lower(u.email) = 'marc.hobi@gmx.ch',
  is_organizer = case
    when lower(u.email) = 'marc.hobi@gmx.ch' then true
    else p.is_organizer
  end,
  wants_to_create_opportunities = case
    when lower(u.email) = 'marc.hobi@gmx.ch' then true
    else p.wants_to_create_opportunities
  end,
  updated_at = now()
from auth.users u
where u.id = p.id;

drop policy if exists "Public read tunnel profiles" on public.tunnel_profiles;
drop policy if exists "Authenticated read tunnel profiles" on public.tunnel_profiles;
drop policy if exists "Admins manage tunnel profiles" on public.tunnel_profiles;
drop policy if exists "Admins insert tunnel profiles" on public.tunnel_profiles;
drop policy if exists "Admins update tunnel profiles" on public.tunnel_profiles;
drop policy if exists "Admins delete tunnel profiles" on public.tunnel_profiles;
drop policy if exists "Users add unverified tunnel profiles" on public.tunnel_profiles;

create policy "Authenticated read tunnel profiles"
on public.tunnel_profiles for select
to authenticated
using (true);

create policy "Admins insert tunnel profiles"
on public.tunnel_profiles for insert
to authenticated
with check (public.is_admin());

create policy "Admins update tunnel profiles"
on public.tunnel_profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins delete tunnel profiles"
on public.tunnel_profiles for delete
to authenticated
using (public.is_admin());

grant select, insert, update, delete on public.tunnel_profiles to authenticated;

drop policy if exists "Public read tunnel images" on storage.objects;
drop policy if exists "Admins upload tunnel images" on storage.objects;
drop policy if exists "Admins update tunnel images" on storage.objects;
drop policy if exists "Admins delete tunnel images" on storage.objects;

create policy "Public read tunnel images"
on storage.objects for select
using (bucket_id = 'tunnel-images');

create policy "Admins upload tunnel images"
on storage.objects for insert
with check (
  bucket_id = 'tunnel-images'
  and public.is_admin()
);

create policy "Admins update tunnel images"
on storage.objects for update
using (
  bucket_id = 'tunnel-images'
  and public.is_admin()
)
with check (
  bucket_id = 'tunnel-images'
  and public.is_admin()
);

create policy "Admins delete tunnel images"
on storage.objects for delete
using (
  bucket_id = 'tunnel-images'
  and public.is_admin()
);

create or replace function public.get_admin_user_overview()
returns table (
  id uuid,
  full_name text,
  email text,
  is_organizer boolean,
  wants_to_create_opportunities boolean
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    p.id,
    p.full_name,
    u.email::text,
    p.is_organizer,
    p.wants_to_create_opportunities
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_admin()
  order by p.full_name asc nulls last, u.email asc;
$$;

grant execute on function public.get_admin_user_overview() to authenticated;
