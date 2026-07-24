-- Pixel&Digital — Site & contenus / Supabase Storage
-- À exécuter après les migrations Prisma de l'application.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-media',
  'site-media',
  true,
  26214400,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'image/svg+xml', 'video/mp4', 'video/webm', 'application/pdf'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- La lecture publique est nécessaire pour le site vitrine.
drop policy if exists "site media public read" on storage.objects;
create policy "site media public read"
on storage.objects for select
to public
using (bucket_id = 'site-media');
