-- Autoriser la publication forum pour tout utilisateur connecté Supabase
drop policy if exists "forum_insert_auth" on public.forum_posts;
create policy "forum_insert_auth" on public.forum_posts
  for insert with check (auth.role() = 'authenticated');

-- (optionnel) laisser author_id libre si session présente
