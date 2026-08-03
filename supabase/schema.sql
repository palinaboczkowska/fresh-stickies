-- Fresh Stickies v2 — shared notes backend.
--
-- Access model (deliberate, documented): the extension talks straight to
-- PostgREST with the anon key. Anyone holding the key can read/write all
-- notes — acceptable for an internal Scaly tool distributed via a private
-- repo. If the extension ever leaves Scaly, switch to Supabase Auth and
-- per-user policies before widening distribution.

create table public.stickies (
  id uuid primary key default gen_random_uuid(),
  page_key text not null check (char_length(page_key) <= 500),
  x integer not null,
  y integer not null,
  text text not null default '' check (char_length(text) <= 2000),
  created_by text not null default '' check (char_length(created_by) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stickies_page_key_idx on public.stickies (page_key);

alter table public.stickies enable row level security;

create policy "anon can read stickies"
  on public.stickies for select
  to anon
  using (true);

create policy "anon can create stickies"
  on public.stickies for insert
  to anon
  with check (true);

create policy "anon can update stickies"
  on public.stickies for update
  to anon
  using (true)
  with check (true);

create policy "anon can delete stickies"
  on public.stickies for delete
  to anon
  using (true);

-- Explicit grants in case the project's Data API defaults don't cover new tables.
grant select, insert, update, delete on public.stickies to anon;
