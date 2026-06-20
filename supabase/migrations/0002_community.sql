-- Salah backend — community posts for the Travel discovery hub.
-- Halal "fun", events, and gatherings are community-submitted (halal food comes
-- live from OpenStreetMap, so it has no table). Apply after 0001_init.sql.

create table if not exists public.community_post (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('fun','event','gathering')),
  title text not null,
  description text,
  lat double precision,
  lon double precision,
  place_name text,
  city text,
  when_text text,                          -- free-text time, e.g. "Sat 7:00 PM"
  url text,
  contributor text,
  created_at timestamptz not null default now()
);
create index if not exists community_post_category_idx on public.community_post (category);
create index if not exists community_post_created_idx  on public.community_post (created_at desc);

alter table public.community_post enable row level security;

-- MVP open policies (anonymous crowdsourcing). Tighten with auth + owner_id
-- before go-live (see supabase/README.md "Hardening before go-live").
create policy "read community"   on public.community_post for select using (true);
create policy "insert community" on public.community_post for insert with check (true);
create policy "delete community" on public.community_post for delete using (true);
