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

## Hardening before go-live (important)

The MVP RLS policies are **open** (anonymous insert/update/delete) so
crowdsourcing works with no login. Before a public launch, tighten them:

1. Turn on Supabase **Auth** (anonymous or email) and add `owner_id uuid default
   auth.uid()` to the tables.
2. Restrict `update`/`delete` to the owner (e.g.
   `using (auth.uid() = owner_id)`); keep `select` public.
3. Route confirm/dispute only through the `confirm_times` RPC (revoke direct
   `update` on the counts) to prevent vote tampering.
4. Add basic rate limiting / abuse protection and a moderation view for
   disputed or low-confidence rows.
5. Re-check `db/` migrations apply cleanly to a fresh **prod** project.

## Going live, clean

1. Finish building/testing on **dev**.
2. Create **prod**, run `0001_init.sql` (and any later migrations) on it.
3. Apply the hardening above.
4. Point the release build's `.env` (or EAS env) at **prod**.
5. Launch with an empty database; optionally insert only verified real mosques.
