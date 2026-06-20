# Salah — Architecture

_Last updated: 2026-06-19_

## 1. Guiding principle: logic in the core, UI on top

The hard, reusable logic lives in **`@salah/core`** — a pure TypeScript library
with **no React, no DOM, no Node-only APIs**, and an **injectable `fetch`**. The
UI (React Native or web) is a thin presentation layer that calls the core.

This is what lets us **defer the platform decision** (currently leaning React
Native) without betting the codebase on it.

```
┌──────────────────────────────────────────────────────────┐
│  UI layer  (choose later: React Native  |  Next.js PWA)   │
│  screens · map · compass · forms · notifications          │
└───────────────────────────┬──────────────────────────────┘
                            │ calls
┌───────────────────────────▼──────────────────────────────┐
│  @salah/core   (pure TypeScript, injectable fetch)        │
│                                                            │
│  prayerTimes ─ adhan times + next/current (offline)        │
│  qibla       ─ bearing to the Kaaba                        │
│  geo         ─ haversine, bounding box, distance sort      │
│  osm         ─ Overpass: mosques near a point             │
│  geocoding   ─ Nominatim: city search + reverse           │
│  registry    ─ merge community iqama times onto OSM        │
│  travel      ─ plan prayers across a journey              │
│  index       ─ findNearbyMosques() orchestration          │
└───────┬───────────────────────┬───────────────────┬───────┘
        │                       │                   │
   ┌────▼────┐           ┌──────▼──────┐      ┌──────▼──────┐
   │ adhan   │           │  Overpass   │      │  Nominatim  │
   │ (npm)   │           │   (OSM)     │      │   (OSM)     │
   └─────────┘           └─────────────┘      └─────────────┘
                              (network — supplied by the host's fetch)
```

## 2. Module responsibilities (`packages/core/src`)

| Module | Responsibility | Network? |
|--------|----------------|----------|
| `types.ts` | All shared domain types. | – |
| `http.ts` | `FetchLike` abstraction + `resolveFetch`. | – |
| `geo.ts` | Haversine distance, bounding box, distance sort. | – |
| `prayerTimes.ts` | Adhan times, current/next prayer (wraps `adhan`). | no (offline) |
| `qibla.ts` | Qibla bearing. | no |
| `osm.ts` | Build/parse Overpass queries; fetch nearby mosques. | yes |
| `geocoding.ts` | Nominatim forward/reverse geocoding. | yes |
| `registry.ts` | Index + merge community times; validate submissions. | – |
| `travel.ts` | Journey prayer planning. | no |
| `trust.ts` | Crowd-confirmation trust ladder + staleness. | – |
| `extract.ts` + `extractors/` | Mosque-page extraction framework + `tableExtractor`. | no (host fetches) |
| `index.ts` | `findNearbyMosques()` orchestrator + re-exports. | yes |

## 3. Key data flows

### 3.1 "Mosques near me"
1. UI gets device GPS → `Coordinates`.
2. `findNearbyMosques(origin, { registry, radiusMeters }, { fetch })`:
   - `osm.fetchNearbyMosques` → Overpass → OSM mosques.
   - `registry.buildRegistryIndex` over community entries.
   - `registry.mergeMosquesWithRegistry` overlays iqama times, folds in
     standalone registry mosques, annotates distance, sorts.
3. UI renders map pins + list; per-mosque, shows adhan times
   (`calculatePrayerTimes` for the mosque's coordinates) **and** iqama/Jumu‘ah
   times from the merge.

### 3.2 Travel pre-planning
1. User types a destination city → `geocoding.geocodeCity` → coordinates.
2. Adhan times for that city (`calculatePrayerTimes`) + mosques there
   (`findNearbyMosques`).

### 3.3 Journey planner
1. UI samples the route (waypoints + ETAs) — from a routing engine or manual stops.
2. `travel.planJourneyPrayers(samples, opts)` returns, per obligatory prayer, the
   estimated time and location and whether it falls during the trip.
3. For "during-journey" prayers, UI calls `findNearbyMosques` near that location.

## 4. The `fetch` injection contract

`@salah/core` never touches a global `fetch`. Callers pass `deps.fetch` (and
optionally `userAgent`, `signal`). Benefits:

- **Testable** — mock the transport, no network in CI (all 36 tests are offline).
- **Polite** — the host supplies the descriptive User-Agent Overpass/Nominatim ask
  for, plus caching/rate-limiting/retries appropriate to the platform.
- **Portable** — React Native fetch, browser fetch, or Node fetch all satisfy
  `FetchLike`.

## 5. Data sources & why

| Need | Source | Why |
|------|--------|-----|
| Adhan times | `adhan` (on-device) | deterministic, offline, no API key, well-tested. |
| Mosque locations | OSM Overpass | free, global, key-less, community-maintained. |
| City / reverse geocoding | OSM Nominatim | free, key-less; pairs with OSM data. |
| **Iqama / Jumu‘ah times** | **Salah community registry** | the missing layer; not available elsewhere. |

## 6. Registry: file today, database tomorrow

The registry is modelled as `RegistryEntry[]` (see `data/` and
[`DATA_MODEL.md`](DATA_MODEL.md)). In v1 it can ship as a bundled/CDN JSON file.
For production it moves to **Supabase Postgres** (chosen to match the team's
stack), exposed via a read endpoint returning the same shape and a write endpoint
that runs `registry.validateMosqueTimes`. **No core code changes** — only the
source of the `registry` array passed to `findNearbyMosques`.

Suggested production schema sketch:

```
mosque_time_submission(
  id uuid pk, osm_id text null, name text, lat double, lon double,
  city text, country text, contact jsonb,
  iqama jsonb, jumuah jsonb, notes text,
  contributor text, verified bool default false,
  status text check (status in ('pending','approved','rejected')),
  created_at timestamptz, updated_at timestamptz
)
```
with RLS for multi-contributor safety and a moderation/verification workflow.

How the registry is *populated* — automatic extraction from mosque web pages
plus a crowd-confirmation trust ladder — is specified in
[`DATA_INGESTION.md`](DATA_INGESTION.md). The pure parts (extractor framework,
`tableExtractor`, trust reducers, staleness) live in the core; fetching,
LLM/vision extraction, and persistence live at the edge.

## 7. Platform decision (deferred, leaning React Native)

| Option | Pros | Cons |
|--------|------|------|
| **React Native (Expo)** | Best mobile feel; reliable background notifications/adhan; device compass; app-store presence. | Slower to first run; store review. |
| **Web PWA (Next.js)** | Instant, installable, one codebase, matches team's existing stack; works on desktop. | Background notifications/audio weaker on iOS; compass less reliable. |

Either consumes `@salah/core` unchanged. Recommendation: prototype the "near me"
screen on the chosen platform in phase 1; the core API (`findNearbyMosques`,
`calculatePrayerTimes`, `getPrayerStatus`, `qiblaDirection`, `planJourneyPrayers`)
is already stable.

## 8. Testing

`vitest`, fully offline — network is mocked through `FetchLike`. Coverage spans
prayer math (incl. madhab/adjustments/day-rollover), geo math, Overpass build/parse,
geocoding parse, the registry merge (overlay + standalone + distance), journey
planning, and the `findNearbyMosques` orchestration. `npm test` → 36 passing.
