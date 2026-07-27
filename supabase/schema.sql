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

-- Enables live cross-device updates: without this, devices only see other
-- devices' changes after their own next save or a full page reload.
alter publication supabase_realtime add table public.app_state;

-- Product photos: public bucket, same anon-write trust model as app_state.
insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

drop policy if exists "Public read product photos" on storage.objects;
create policy "Public read product photos"
on storage.objects for select
to public
using (bucket_id = 'product-photos');

drop policy if exists "Anon upload product photos" on storage.objects;
create policy "Anon upload product photos"
on storage.objects for insert
to anon
with check (bucket_id = 'product-photos');

drop policy if exists "Anon update product photos" on storage.objects;
create policy "Anon update product photos"
on storage.objects for update
to anon
using (bucket_id = 'product-photos')
with check (bucket_id = 'product-photos');

drop policy if exists "Anon delete product photos" on storage.objects;
create policy "Anon delete product photos"
on storage.objects for delete
to anon
using (bucket_id = 'product-photos');
