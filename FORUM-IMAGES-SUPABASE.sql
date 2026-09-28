-- Colonne image sur les posts
alter table public.forum_posts
  add column if not exists image_url text;

-- Bucket public pour les images forum
insert into storage.buckets (id, name, public)
values ('forum-images', 'forum-images', true)
on conflict (id) do nothing;

-- Lecture publique
create policy "forum_images_public_read"
on storage.objects for select
using (bucket_id = 'forum-images');

-- Upload : utilisateurs connectés uniquement
create policy "forum_images_auth_upload"
on storage.objects for insert
with check (
  bucket_id = 'forum-images'
  and auth.role() = 'authenticated'
);
