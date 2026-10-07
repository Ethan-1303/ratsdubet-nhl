-- ═══════════════════════════════════════════════════════════════
-- BETZONE by Ratsdubet — SQL COMPLET Supabase
-- À coller dans : Supabase → SQL Editor → Run
-- Idempotent (re-jouable sans casser l'existant)
-- Chef de meute : djovins@hotmail.fr
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1) FORUM
-- ─────────────────────────────────────────────────────────────
create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('discussion','ticket','win','loss')),
  title text not null,
  body text not null,
  author_name text not null,
  author_id uuid references auth.users(id) on delete set null,
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.forum_posts add column if not exists image_url text;

create index if not exists forum_posts_created_idx
  on public.forum_posts (created_at desc);

alter table public.forum_posts enable row level security;

drop policy if exists "forum_read_all" on public.forum_posts;
create policy "forum_read_all"
  on public.forum_posts for select
  using (true);

drop policy if exists "forum_insert_auth" on public.forum_posts;
drop policy if exists "forum_insert_public" on public.forum_posts;
create policy "forum_insert_public"
  on public.forum_posts for insert
  with check (true);

-- ─────────────────────────────────────────────────────────────
-- 2) STORAGE (images forum)
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('forum-images', 'forum-images', true)
on conflict (id) do nothing;

drop policy if exists "forum_images_public_read" on storage.objects;
create policy "forum_images_public_read"
  on storage.objects for select
  using (bucket_id = 'forum-images');

drop policy if exists "forum_images_auth_upload" on storage.objects;
create policy "forum_images_auth_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'forum-images'
    and auth.role() = 'authenticated'
  );

-- ─────────────────────────────────────────────────────────────
-- 3) PROFILES (premium, essai, niveaux, admin)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  premium boolean default false,
  trial_expires timestamptz,
  posts_count int default 0,
  tickets_count int default 0,
  level int default 0,
  is_admin boolean default false,
  created_at timestamptz default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists premium boolean default false;
alter table public.profiles add column if not exists trial_expires timestamptz;
alter table public.profiles add column if not exists posts_count int default 0;
alter table public.profiles add column if not exists tickets_count int default 0;
alter table public.profiles add column if not exists level int default 0;
alter table public.profiles add column if not exists is_admin boolean default false;
alter table public.profiles add column if not exists created_at timestamptz default now();

alter table public.profiles enable row level security;

-- Lecture : son propre profil OU admin (dashboard)
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "admin read profiles" on public.profiles;
create policy "profiles_select"
  on public.profiles for select
  using (
    auth.uid() = id
    or lower(coalesce(auth.jwt() ->> 'email', '')) = lower('djovins@hotmail.fr')
    or coalesce(is_admin, false) = true
  );

-- Insert / update son propre profil
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────
-- 4) Auto-création profil à l'inscription
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, premium, level, is_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    false,
    0,
    lower(new.email) = lower('djovins@hotmail.fr')
  )
  on conflict (id) do update set
    email = excluded.email,
    name = coalesce(public.profiles.name, excluded.name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 5) Chef de meute (ton compte)
-- ─────────────────────────────────────────────────────────────
update public.profiles
set is_admin = true, level = 5, premium = true, trial_expires = null
where lower(email) = lower('djovins@hotmail.fr');

-- Si 0 ligne : connecte-toi une fois sur le site, puis relance uniquement :
-- update public.profiles set is_admin = true, level = 5
-- where lower(email) = lower('djovins@hotmail.fr');

-- ─────────────────────────────────────────────────────────────
-- Fin — Success
-- ─────────────────────────────────────────────────────────────
