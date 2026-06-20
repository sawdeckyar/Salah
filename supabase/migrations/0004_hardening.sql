-- Salah backend — go-live hardening.
--
-- Requires Anonymous sign-ins enabled in the dashboard (Authentication ->
-- Providers -> Anonymous). The app signs in anonymously so every device has a
-- stable auth.uid(); writes then require auth, content is owner-scoped, and
-- votes/RSVPs are one-per-user (tamper-resistant). Idempotent; run after 0003.

-- ---------------------------------------------------------------------------
-- Ownership columns (default to the caller's uid on insert)
-- ---------------------------------------------------------------------------
alter table public.mosque_time_submission add column if not exists owner_id uuid default auth.uid();
alter table public.parking_report          add column if not exists owner_id uuid default auth.uid();
alter table public.community_post          add column if not exists owner_id uuid default auth.uid();

-- ---------------------------------------------------------------------------
-- Parking: authenticated insert, owner-only delete
-- ---------------------------------------------------------------------------
drop policy if exists "insert parking" on public.parking_report;
drop policy if exists "delete parking" on public.parking_report;
create policy "insert parking" on public.parking_report
  for insert to authenticated with check (auth.uid() = owner_id);
create policy "delete parking" on public.parking_report
  for delete to authenticated using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- Community posts: authenticated insert, owner-only delete; counter protected
-- ---------------------------------------------------------------------------
drop policy if exists "insert community" on public.community_post;
drop policy if exists "delete community" on public.community_post;
create policy "insert community" on public.community_post
  for insert to authenticated with check (auth.uid() = owner_id);
create policy "delete community" on public.community_post
  for delete to authenticated using (auth.uid() = owner_id);
-- No direct UPDATE policy: the `interested` counter is only written by the
-- set_interest() RPC (security definer). Block direct updates entirely.
revoke update on public.community_post from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Mosque times: authenticated insert; content editable by any signed-in user
-- (crowdsourced), but the count/status columns are not directly writable.
-- ---------------------------------------------------------------------------
drop policy if exists "insert times" on public.mosque_time_submission;
drop policy if exists "update times" on public.mosque_time_submission;
create policy "insert times" on public.mosque_time_submission
  for insert to authenticated with check (auth.uid() = owner_id);
create policy "update times" on public.mosque_time_submission
  for update to authenticated using (true) with check (true);
revoke update on public.mosque_time_submission from anon, authenticated;
grant update (mosque_name, lat, lon, city, country, iqama, jumuah, notes, contributor, updated_at)
  on public.mosque_time_submission to authenticated;

-- ---------------------------------------------------------------------------
-- Confirmations: one vote per user; counts recomputed from rows
-- ---------------------------------------------------------------------------
alter table public.time_confirmation add column if not exists user_id uuid default auth.uid();
create unique index if not exists time_confirmation_user_uidx
  on public.time_confirmation (submission_id, user_id);
drop policy if exists "insert conf" on public.time_confirmation;
create policy "insert conf" on public.time_confirmation
  for insert to authenticated with check (auth.uid() = user_id);
create policy "update conf" on public.time_confirmation
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Replace the counter-based confirm with a per-user, recompute-from-rows version.
drop function if exists public.confirm_times(text, text, text);
create or replace function public.confirm_times(p_mosque_id text, p_vote text)
returns public.mosque_time_submission
language plpgsql security definer as $$
declare rec public.mosque_time_submission; c int; d int;
begin
  if p_vote not in ('confirm','dispute') then raise exception 'bad vote'; end if;
  select * into rec from public.mosque_time_submission where mosque_id = p_mosque_id;
  if rec.id is null then return null; end if;

  insert into public.time_confirmation (submission_id, vote, user_id)
  values (rec.id, p_vote, auth.uid())
  on conflict (submission_id, user_id) do update set vote = excluded.vote, at = now();

  select count(*) filter (where vote = 'confirm'),
         count(*) filter (where vote = 'dispute')
    into c, d
  from public.time_confirmation where submission_id = rec.id;

  update public.mosque_time_submission s set
    confirms = c, disputes = d,
    last_confirmed_at = case when p_vote = 'confirm' then now() else s.last_confirmed_at end,
    status = case
      when s.status in ('mosque-verified','rejected') then s.status
      when (d - c) >= 3 then 'rejected'
      when (c - d) >= 3 then 'crowd-confirmed'
      else 'candidate' end,
    updated_at = now()
  where s.id = rec.id returning * into rec;
  return rec;
end; $$;
grant execute on function public.confirm_times(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Interest / RSVP: one row per user; counter maintained by RPC
-- ---------------------------------------------------------------------------
create table if not exists public.community_interest (
  post_id uuid not null references public.community_post(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.community_interest enable row level security;
drop policy if exists "read interest" on public.community_interest;
drop policy if exists "insert interest" on public.community_interest;
drop policy if exists "delete interest" on public.community_interest;
create policy "read interest"   on public.community_interest for select using (true);
create policy "insert interest" on public.community_interest for insert to authenticated with check (auth.uid() = user_id);
create policy "delete interest" on public.community_interest for delete to authenticated using (auth.uid() = user_id);

drop function if exists public.bump_interest(uuid, int);
create or replace function public.set_interest(p_post_id uuid, p_interested boolean)
returns int language plpgsql security definer as $$
declare n int;
begin
  if p_interested then
    insert into public.community_interest (post_id, user_id)
    values (p_post_id, auth.uid()) on conflict do nothing;
  else
    delete from public.community_interest where post_id = p_post_id and user_id = auth.uid();
  end if;
  select count(*) into n from public.community_interest where post_id = p_post_id;
  update public.community_post set interested = n where id = p_post_id;
  return n;
end; $$;
grant execute on function public.set_interest(uuid, boolean) to authenticated;
