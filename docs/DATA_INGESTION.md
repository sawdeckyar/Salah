# Salah — Data Ingestion & Trust

_Last updated: 2026-06-20_

How Salah gets mosque-specific **iqama / Jumu‘ah** times — the data that is
otherwise scattered across individual mosque websites — and how it earns trust.

The strategy is a **hybrid**: automatically extract times from mosque web pages
to seed broad coverage, then let the **crowd confirm** them to earn trust. This
beats pure crowdsourcing (which never gets off the ground — cold-start coverage)
and avoids the years-long, mosque-by-mosque onboarding that the incumbents
(e.g. MAWAQIT) relied on, while leaving room to add a mosque-admin "claim" flow
later for the highest tier of trust.

```
 discover ──▶ fetch ──▶ extract ──▶ candidate ──▶ crowd-confirm ──▶ (mosque-verify)
  (OSM)      (host)    (core)       (registry)     (core trust)        (optional)
```

## 1. Pipeline stages

### 1.1 Discover sources
- Mosques come from **OpenStreetMap** (Overpass). OSM often carries a `website`
  tag — use it. Coverage is partial, so also accept admin/crowd-supplied URLs
  and links to Google/Facebook pages.
- Mosques with **no web presence** can't be scraped — they fall back to pure
  crowd submission. Extraction *raises the floor*; it doesn't cover everyone.

### 1.2 Fetch (host side, not core)
The page fetch, screenshotting, and any PDF/OCR or LLM calls happen at the
**edge** (a backend job or serverless function), never in `@salah/core`. The
host hands the core plain content. This keeps the core pure/testable and keeps
model and provider choices replaceable.

Etiquette is mandatory here: honor `robots.txt`, rate-limit, send a descriptive
User-Agent, cache aggressively, and link back to / attribute the mosque.

### 1.3 Extract (core: `extract.ts` + `extractors/`)
Layered, most-reliable-first. Each layer is an `Extractor`
(`canHandle` + `extract`); `runExtractors()` tries them in order and returns the
first usable result.

| Order | Method (`ExtractionMethod`) | Source | Reliability | Status |
|------:|------------------------------|--------|-------------|--------|
| 1 | `widget` | Detected platform embed (MAWAQIT, Masjidbox, My-Masjid, IslamicFinder, …) | highest | planned |
| 2 | `html` | HTML table / structured markup | high | **shipped** (`tableExtractor`) |
| 3 | `pdf` | PDF monthly timetable | medium | planned |
| 4 | `llm` | Free text / images / screenshots via a vision model | broad, noisier | planned (host-side) |

> **Widget caveat (legal):** if a mosque embeds a competitor's widget, pulling
> from that platform's API may breach *their* ToS. For detected-platform
> mosques, prefer "this mosque publishes on X → deep-link out" over re-hosting
> their data, unless the data is clearly mosque-owned and openly licensed.

Every extraction records **provenance** (`TimeProvenance`): `method`,
`sourceUrl`, `extractor`, `confidence`, `observedAt`. Extracted times enter as a
`candidate` (`candidateFromExtraction`) — never shown as authoritative.

#### The shipped extractor: `tableExtractor` (`table-parser@1`)
- Strips HTML, scans line-by-line for `prayer name + clock time(s)`.
- When a row has several times (a *Begins* and an *Iqama* column), it keeps the
  **last** one — the iqama/jama‘ah time the registry wants.
- Infers AM/PM from the prayer when a timetable omits it (Fajr → AM, the rest →
  PM), which is correct for the overwhelming majority of iqama tables.
- Detects Jumu‘ah lines and emits one service per time found.
- Emits a deliberately **conservative confidence** — the crowd does the real
  trust-building. It is a heuristic, not a universal parser.

### 1.4 Candidate → registry
A `TimeCandidate` carries the proposed `MosqueTimes`, a `status` on the trust
ladder, and confirm/dispute tallies. The registry surfaces the **best** candidate
per mosque; everything is tied back to its `mosqueId` (`osm:node/123` / `reg:…`).

## 2. The trust ladder (core: `trust.ts`)

```
            net confirms ≥ confirmThreshold
 candidate ───────────────────────────────▶ crowd-confirmed
     ▲                                            │
     │           net disputes ≥ rejectThreshold   │  (demote)
     └────────────────────────────────────────────┘
                                                  ▼
                                              rejected

 mosque-verified  ── set by an imam/claim flow; not demoted by votes (top tier)
```

- `applyConfirmation(candidate, { vote }, policy)` — pure, immutable. Records a
  vote, recomputes status, mirrors net confirmations onto `times.confirmations`
  and stamps `lastConfirmedAt`.
- `markMosqueVerified(candidate)` — promote to the top tier (`verified: true`).
- `trustLevelOf(candidate)` → `unverified | crowd-confirmed | mosque-verified`
  for the UI badge.
- Default policy: promote at **net +3**, reject at **net −3**, stale after
  **60 days** (tunable via `TrustPolicy`).

### 2.1 Staleness — non-negotiable
Iqama times drift seasonally (Maghrib tracks sunset). `isStale(times, now,
policy)` flags crowd-confirmed times older than `staleAfterDays` (and any
never-confirmed times) so the app re-surfaces them for re-confirmation and the
host re-crawls. Mosque-verified times never auto-stale. **Confidently showing a
wrong time is worse than showing none** — a missed jama‘ah destroys trust.

### 2.2 Crowd-confirmation UX
Show candidate times to users **physically near** the mosque with a light prompt:
**✓ correct · ✗ wrong · ✎ fix**. A fix creates a new candidate; confirmations
push the current one up the ladder. Weight votes by recency and (later) user
reputation; dedupe by `userId`.

## 3. What's in `@salah/core` vs. at the edge

| Concern | Location | Why |
|--------|----------|-----|
| Extractor interface, runner, time normalization | core (`extract.ts`) | pure, testable |
| `tableExtractor` | core (`extractors/`) | deterministic, unit-tested |
| Trust ladder + staleness | core (`trust.ts`) | pure reducers, reused everywhere |
| Page fetch, robots/rate-limit, caching | **edge** | I/O + policy, platform-specific |
| LLM / vision / OCR extraction | **edge** | provider choice, cost, keys |
| Persistence + moderation queue | **edge (Supabase)** | storage + auth |

The core ships the brain; the edge supplies the hands (network, models, storage).

## 4. Persistence (planned, Supabase)

```
time_candidate(
  id uuid pk,
  mosque_id text,                  -- osm:node/123 | reg:<id>
  times jsonb,                     -- MosqueTimes incl. provenance
  status text,                     -- candidate|crowd-confirmed|mosque-verified|rejected
  confirms int default 0,
  disputes int default 0,
  last_confirmed_at timestamptz,
  created_at timestamptz default now()
)
confirmation_event(
  id uuid pk, candidate_id uuid references time_candidate,
  user_id text, vote text, at timestamptz default now()
)
```
RLS for multi-contributor safety; a moderation view for disputed/low-confidence
candidates; a scheduled job to re-crawl stale candidates. The read API returns
`RegistryEntry[]` so `findNearbyMosques` is unchanged.

## 5. Legal & ethical guardrails (summary)
- Respect `robots.txt` and site ToS; rate-limit; identify the bot; cache.
- Prayer times are largely **factual** (thin copyright) but scraping isn't
  risk-free — prefer **opt-in / "claim your mosque"** where possible.
- Don't re-host a competitor platform's data against its ToS — link out instead.
- Always show **source + trust level**; never present unverified times as
  guaranteed. Provide an easy correction path and a way for mosques to take over.

## 6. Status
- ✅ Provenance, candidate, and trust-ladder types (`types.ts`)
- ✅ Trust engine + staleness (`trust.ts`, tested)
- ✅ Extractor framework + runner + `tableExtractor` (`extract.ts`, tested)
- ⏭️ Widget detector, PDF, and host-side LLM extractors
- ⏭️ Edge fetcher (robots/rate-limit/cache) + Supabase persistence + moderation
- ⏭️ Crowd-confirmation UI + mosque "claim" flow
