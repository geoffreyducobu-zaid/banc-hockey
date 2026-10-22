-- Base en ligne de l'app StickMate. À coller une seule fois dans Supabase :
-- SQL Editor > New query > coller tout ce fichier > Run.

-- Une ligne par coach : son équipe, ses matchs (state) et sa saison (season).
create table if not exists public.coach_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  season jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Chaque coach ne voit et ne modifie que sa propre ligne.
alter table public.coach_data enable row level security;
drop policy if exists "coach lit ses donnees" on public.coach_data;
drop policy if exists "coach cree ses donnees" on public.coach_data;
drop policy if exists "coach modifie ses donnees" on public.coach_data;
drop policy if exists "coach efface ses donnees" on public.coach_data;
create policy "coach lit ses donnees" on public.coach_data for select to authenticated using ((select auth.uid()) = user_id);
create policy "coach cree ses donnees" on public.coach_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "coach modifie ses donnees" on public.coach_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "coach efface ses donnees" on public.coach_data for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.coach_data from anon;

-- Bouton « Supprimer mon compte » : efface le compte du coach connecté et,
-- par cascade, toutes ses données. Personne d'autre ne peut l'appeler.
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
