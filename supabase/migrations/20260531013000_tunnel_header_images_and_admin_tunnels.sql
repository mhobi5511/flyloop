alter table public.tunnel_profiles
  add column if not exists header_image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tunnel-images',
  'tunnel-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users add unverified tunnel profiles" on public.tunnel_profiles;
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
  and public.is_admin(auth.uid())
);

create policy "Admins update tunnel images"
on storage.objects for update
using (
  bucket_id = 'tunnel-images'
  and public.is_admin(auth.uid())
)
with check (
  bucket_id = 'tunnel-images'
  and public.is_admin(auth.uid())
);

create policy "Admins delete tunnel images"
on storage.objects for delete
using (
  bucket_id = 'tunnel-images'
  and public.is_admin(auth.uid())
);

grant select, insert, update on public.tunnel_profiles to authenticated;
