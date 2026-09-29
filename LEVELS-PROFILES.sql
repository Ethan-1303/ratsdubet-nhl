-- Niveaux membres BETZONE / RATSDUBET
alter table public.profiles add column if not exists posts_count int default 0;
alter table public.profiles add column if not exists tickets_count int default 0;
alter table public.profiles add column if not exists level int default 0;
alter table public.profiles add column if not exists is_admin boolean default false;

-- Optionnel : te passer Chef de meute (remplace l'email)
-- update public.profiles set is_admin = true, level = 5 where email = 'TON_EMAIL@example.com';
