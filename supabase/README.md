# Salah — Supabase backend

The shared backend that makes crowdsourced **mosque times** and **parking**
visible to everyone (instead of on-device only). The app talks to it through
`apps/mobile/src/lib/supabase.ts` + `src/data/remote.ts`, gated on env vars — so
the app keeps working locally until these are set.

## Environments: dev + prod (recommended)

Create **two** Supabase projects (free tier is fine):

| Project | Use |
|---------|-----|
| `salah-dev` | day-to-day development & testing; throwaway data |
| `salah-prod` | the real, **clean** database you launch with |

Develop and test migrations/RLS against **dev**. When ready, create **prod
fresh**, apply the same migration, and launch clean (no test rows). The app
selects the project purely from env vars — no code change between them.

> If you truly want to start with just one project, use a single `salah-prod`
> and keep it clean — but you'll be testing against live data, which is riskier.

## One-time setup (per project)

1. Create the project at https://supabase.com/dashboard (pick a strong DB
   password; choose a region close to your users).
2. Open **SQL Editor → New query**, paste the contents of
   [`migrations/0001_init.sql`](migrations/0001_init.sql), and **Run**.
   (Or, with the Supabase CLI: `supabase link` then `supabase db push`.)
3. **Project Settings → API** → copy the **Project URL** and the **anon public**
   key.
4. In `apps/mobile/`, copy `.env.example` to `.env.local` and paste them:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>
   ```
5. Restart Expo (`npx expo start -c`). The app now reads/writes Supabase.
   With no `.env.local`, it falls back to on-device storage.

> The **anon public** key is safe to ship in a client app — access is governed
> by Row Level Security, not by hiding the key. Never put the **service_role**
> key in the app.

## What the schema provides

- `mosque_time_submission` — one row per mosque (upserted) with iqama/Jumu'ah,
  status, and confirm/dispute counts.
- `parking_report` — point pins or drawn polygons (`legal` / `no` / `private`).
- `time_confirmation` — audit of confirm/dispute votes.
- `confirm_times(p_mosque_id, p_vote)` RPC — atomically updates counts and
  promotes/rejects using the same thresholds as `@salah/core` (net ±3).

## Hardening — `0004_hardening.sql` (implemented)

`0001`–`0003` ship intentionally **open** policies (anonymous writes) so you can
develop with zero auth. **`0004_hardening.sql`** locks the backend down for a
public launch:

- **Anonymous Auth required for writes.** The app signs in anonymously
  (`ensureAuth` in `src/lib/supabase.ts`), giving each device a stable
  `auth.uid()`. **You must enable it:** dashboard → Authentication → Providers →
  **Anonymous** → enable. (Without it, reads still work but writes are rejected.)
- **Ownership.** `owner_id uuid default auth.uid()` on every table; insert
  requires `auth.uid() = owner_id`; parking & community **delete is owner-only**.
- **Vote integrity.** `time_confirmation` is now **one row per user**
  (`unique(submission_id, user_id)`); `confirm_times()` upserts the user's vote
  and **recomputes** counts from rows — no raw counter to inflate.
- **RSVP integrity.** New `community_interest(post_id, user_id)` table, one row
  per user; `set_interest()` toggles it and maintains the displayed counter.
- **Counter columns are not directly writable** (direct `UPDATE` revoked); only
  the SECURITY DEFINER RPCs change counts/status. Mosque-time *content* stays
  editable by any signed-in user (crowdsourced), via column-scoped grants.

Run order on each project: `0001` → `0002` → `0003` → `0004`, then enable
Anonymous sign-ins.

Still recommended before a big launch: basic rate limiting / abuse protection,
and a moderation view for disputed or low-confidence rows.

## Going live, clean

1. Finish building/testing on **dev**.
2. Create **prod**, run `0001_init.sql` (and any later migrations) on it.
3. Apply the hardening above.
4. Point the release build's `.env` (or EAS env) at **prod**.
5. Launch with an empty database; optionally insert only verified real mosques.
