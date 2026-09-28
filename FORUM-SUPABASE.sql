-- BETZONE Forum — à exécuter dans Supabase → SQL Editor
create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('discussion','ticket','win','loss')),
  title text not null,
  body text not null,
  author_name text not null,
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.forum_posts enable row level security;

-- Lecture publique
create policy "forum_read_all" on public.forum_posts
  for select using (true);

-- Publication : utilisateurs connectés uniquement
create policy "forum_insert_auth" on public.forum_posts
  for insert with check (auth.uid() = author_id);

create index if not exists forum_posts_created_idx on public.forum_posts (created_at desc);
