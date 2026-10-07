
-- Optionnel : permettre au chef de lire les profils (dashboard admin)
-- Remplace l'email si besoin
create policy if not exists "admin read profiles"
on public.profiles for select
using (
  auth.jwt() ->> 'email' = 'djovins@hotmail.fr'
  or is_admin = true
);

-- Si "if not exists" non supporté, utilise :
-- drop policy if exists "admin read profiles" on public.profiles;
-- create policy "admin read profiles" on public.profiles for select
-- using ( lower(auth.jwt() ->> 'email') = lower('djovins@hotmail.fr') );
