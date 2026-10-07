-- Forum visible et publiable pour tous (via site BETZONE uniquement recommandé)
-- Lecture publique
drop policy if exists "forum_read_all" on public.forum_posts;
create policy "forum_read_all" on public.forum_posts
  for select using (true);

-- Insert public (le site gère qui peut poster côté UI)
drop policy if exists "forum_insert_auth" on public.forum_posts;
drop policy if exists "forum_insert_public" on public.forum_posts;
create policy "forum_insert_public" on public.forum_posts
  for insert with check (true);
