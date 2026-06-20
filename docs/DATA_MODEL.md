# Salah — Data Model

_Last updated: 2026-06-19_

This document defines the **mosque-times registry** — the crowdsourced layer that
makes Salah more than a prayer-time calculator. Types live in
`packages/core/src/types.ts`; the JSON Schema is `data/mosque-times.schema.json`;
sample data is `data/mosque-times.seed.json`.

## 1. The two-layer model

| Layer | Where it comes from | Shape | Computable? |
|-------|---------------------|-------|-------------|
| Adhan times | `adhan` on-device | `PrayerTimesResult.times` (absolute `Date`s) | ✅ yes |
| Mosque locations | OSM Overpass | `Mosque` (source `osm`) | – |
| Iqama / Jumu‘ah | community registry | `MosqueTimes` | ❌ human-set |

Iqama and Jumu‘ah times are **local wall-clock `HH:mm` strings**, not `Date`s:
they are set by the mosque ("Maghrib jamā‘ah at 8:35"), not derived from
astronomy, and apply at the mosque's local time.

## 2. Core types

### `Coordinates`
```ts
{ latitude: number; longitude: number }   // WGS-84 decimal degrees
```

### `Mosque`
```ts
{
  id: string;                  // "osm:node/123" | "reg:<id>"
  source: 'osm' | 'registry' | 'merged';
  name: string;
  location: Coordinates;
  address?: string; city?: string; country?: string;
  contact?: { phone?: string; website?: string; email?: string };
  distanceMeters?: number;     // set when searched from an origin
  times?: MosqueTimes;         // present after registry merge
}
```

### `MosqueTimes`
```ts
{
  iqama?: { fajr?; dhuhr?; asr?; maghrib?; isha?: string };  // "HH:mm" 24h
  jumuah?: JumuahService[];
  notes?: string;
  updatedAt?: string;          // ISO-8601
  contributor?: string;
  verified?: boolean;
  provenance?: TimeProvenance; // where these times came from + how
  confirmations?: number;      // net community confirmations
  lastConfirmedAt?: string;    // ISO-8601 of last positive confirmation
}
```
(Sunrise has no iqama — it is not a congregational prayer.)

`provenance`, `confirmations`, and `lastConfirmedAt` support the hybrid
extraction + crowd-confirmation pipeline — see
[`DATA_INGESTION.md`](DATA_INGESTION.md) for `TimeProvenance`, `TimeCandidate`,
and the trust ladder.

### `JumuahService`
```ts
{ label?: string; khutbahTime: string; iqamaTime?: string; language?: string }
```
A mosque may host **several** Jumu‘ah services (e.g. early/late, Arabic/English).

### `RegistryEntry`
A registry record either **annotates an OSM feature** (`osmId`) or **defines a
standalone mosque** (`name` + `location`) OSM doesn't have yet:
```ts
{
  id: string;
  osmId?: string;              // "node/123" | "way/123" | "relation/123"
  name?: string;               // required if no osmId
  location?: Coordinates;      // required if no osmId
  address?; city?; country?; contact?;
  times: MosqueTimes;          // required
}
```

## 3. Identity & linking

- OSM mosques get id `osm:<type>/<id>` (e.g. `osm:node/24181972`).
- Registry entries reference them via `osmId`, normalized to `<type>/<id>`.
  `buildRegistryIndex` accepts `node/123`, `osm:node/123`, or a full
  `openstreetmap.org/...` URL.
- Standalone registry mosques get id `reg:<entry id>`.

## 4. Merge semantics (`mergeMosquesWithRegistry`)

1. For each OSM mosque with a matching registry entry: set `source: 'merged'`,
   attach `times`, and fill missing `address`/`city`/`country`/`contact` from the
   entry (OSM values win where both exist).
2. Append standalone registry mosques. If an `origin` is given, only those within
   `nearbyRadiusM` (default 25 km) are included.
3. If `origin` is given, annotate every result with `distanceMeters` and sort
   ascending.

Unmatched OSM mosques pass through unchanged (`source: 'osm'`, no `times`) so the
UI can show "times not yet submitted — add them".

## 5. Validation (`validateMosqueTimes`)

Returns human-readable errors (empty = valid). Enforces:
- iqama and Jumu‘ah times match `HH:mm` (00:00–23:59);
- a submission has at least one iqama time **or** one Jumu‘ah service.

Used by the submission form **and** the backend write path.

## 6. Registry file format

`data/mosque-times.seed.json` (validated by `data/mosque-times.schema.json`):
```json
{
  "version": 1,
  "updatedAt": "2026-06-19T00:00:00Z",
  "entries": [ /* RegistryEntry[] */ ]
}
```

> ⚠️ The seed data is **illustrative**, not verified. Replace with real
> community-sourced times (or the Supabase-backed registry) before depending on it.

## 7. Production storage (planned)

Move `entries` into Supabase Postgres (`mosque_time_submission`), add a
moderation/verification workflow, and serve the same `RegistryEntry[]` shape to
clients. Because the core consumes a plain array, **nothing in `@salah/core`
changes** — only the data source does. Schema sketch in
[`ARCHITECTURE.md`](ARCHITECTURE.md) §6.
