alter table public.profiles
  add column if not exists profile_image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images',
  'profile-images',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload own profile images" on storage.objects;
drop policy if exists "Users update own profile images" on storage.objects;
drop policy if exists "Users delete own profile images" on storage.objects;
drop policy if exists "Public read profile images" on storage.objects;

create policy "Public read profile images"
on storage.objects for select
using (bucket_id = 'profile-images');

create policy "Users upload own profile images"
on storage.objects for insert
with check (
  bucket_id = 'profile-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users update own profile images"
on storage.objects for update
using (
  bucket_id = 'profile-images'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'profile-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users delete own profile images"
on storage.objects for delete
using (
  bucket_id = 'profile-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);
