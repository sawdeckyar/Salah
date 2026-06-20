-- Salah backend schema — crowdsourced mosque times + parking + the trust ladder.
-- Apply to a fresh Supabase project (dev first, then prod) via the SQL editor
-- or `supabase db push`. See supabase/README.md for the runbook.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Crowdsourced mosque congregation (iqama / Jumu'ah) times
-- One current row per mosque (upsert target); history lives in time_confirmation.
-- ---------------------------------------------------------------------------
create table if not exists public.mosque_time_submission (
  id uuid primary key default gen_random_uuid(),
  mosque_id text not null,                 -- e.g. 'osm:node/123' or 'reg:<uuid>'
  mosque_name text,
  lat double precision,
  lon double precision,
  city text,
  country text,
  iqama jsonb,                             -- { fajr, dhuhr, asr, maghrib, isha }
  jumuah jsonb,                            -- [ { label, khutbahTime, iqamaTime, language } ]
  notes text,
  contributor text,
  status text not null default 'candidate'
    check (status in ('candidate','crowd-confirmed','mosque-verified','rejected')),
  confirms int not null default 0,
  disputes int not null default 0,
  last_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists mosque_time_submission_mosque_uidx
  on public.mosque_time_submission (mosque_id);

-- ---------------------------------------------------------------------------
-- Crowdsourced parking (point pins or drawn polygons)
-- ---------------------------------------------------------------------------
create table if not exists public.parking_report (
  id uuid primary key default gen_random_uuid(),
  mosque_id text not null,
  kind text not null check (kind in ('legal','no','private')),
  lat double precision not null,
  lon double precision not null,
  polygon jsonb,                           -- [[lng,lat], ...] ring, or null for a pin
  note text,
  contributor text,
  created_at timestamptz not null default now()
);
create index if not exists parking_report_mosque_idx
  on public.parking_report (mosque_id);

-- ---------------------------------------------------------------------------
-- Confirmation events feeding the trust ladder
-- ---------------------------------------------------------------------------
create table if not exists public.time_confirmation (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.mosque_time_submission(id) on delete cascade,
  vote text not null check (vote in ('confirm','dispute')),
  user_key text,
  at timestamptz not null default now()
);
create index if not exists time_confirmation_submission_idx
  on public.time_confirmation (submission_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- MVP policies are intentionally open (anonymous crowdsourcing). Before a real
-- launch, add auth + an owner_id and tighten update/delete to the owner. See
-- supabase/README.md "Hardening before go-live".
-- ---------------------------------------------------------------------------
alter table public.mosque_time_submission enable row level security;
alter table public.parking_report          enable row level security;
alter table public.time_confirmation       enable row level security;

create policy "read times"    on public.mosque_time_submission for select using (true);
create policy "insert times"  on public.mosque_time_submission for insert with check (true);
create policy "update times"  on public.mosque_time_submission for update using (true) with check (true);

create policy "read parking"   on public.parking_report for select using (true);
create policy "insert parking" on public.parking_report for insert with check (true);
create policy "delete parking" on public.parking_report for delete using (true);

create policy "read conf"   on public.time_confirmation for select using (true);
create policy "insert conf" on public.time_confirmation for insert with check (true);

-- ---------------------------------------------------------------------------
-- Confirm/dispute RPC — mirrors @salah/core trust thresholds (promote/reject
-- at net +/-3). Atomic counter update + audit row.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_times(
  p_mosque_id text,
  p_vote text,
  p_user_key text default null
) returns public.mosque_time_submission
language plpgsql security definer as $$
declare
  rec public.mosque_time_submission;
  new_confirms int;
  new_disputes int;
begin
  if p_vote not in ('confirm','dispute') then
    raise exception 'vote must be confirm or dispute';
  end if;

  select * into rec from public.mosque_time_submission where mosque_id = p_mosque_id;
  if rec.id is null then
    return null;
  end if;

  new_confirms := rec.confirms + (case when p_vote = 'confirm' then 1 else 0 end);
  new_disputes := rec.disputes + (case when p_vote = 'dispute' then 1 else 0 end);

  update public.mosque_time_submission s
  set confirms = new_confirms,
      disputes = new_disputes,
      last_confirmed_at = case when p_vote = 'confirm' then now() else s.last_confirmed_at end,
      status = case
        when s.status in ('mosque-verified','rejected') then s.status
        when (new_disputes - new_confirms) >= 3 then 'rejected'
        when (new_confirms - new_disputes) >= 3 then 'crowd-confirmed'
        else 'candidate'
      end,
      updated_at = now()
  where s.id = rec.id
  returning * into rec;

  insert into public.time_confirmation (submission_id, vote, user_key)
  values (rec.id, p_vote, p_user_key);

  return rec;
end; $$;

-- Allow the anon role to call the RPC.
grant execute on function public.confirm_times(text, text, text) to anon, authenticated;
