create table if not exists public.app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "Allow public read app state" on public.app_state;
create policy "Allow public read app state"
on public.app_state for select
to anon
using (true);

drop policy if exists "Allow public write app state" on public.app_state;
create policy "Allow public write app state"
on public.app_state for insert
to anon
with check (true);

drop policy if exists "Allow public update app state" on public.app_state;
create policy "Allow public update app state"
on public.app_state for update
to anon
using (true)
with check (true);
