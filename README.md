# Salah 🕌

**Find nearby mosques and their real prayer times — wherever you are, wherever you're driving.**

Friday and daily prayer (ṣalāh) times are scattered. Every mosque sets its own
iqama (congregation) and Jumu‘ah times, and the only place to find them is each
mosque's own website. For anyone travelling between cities, planning to make it
to a congregation on time is needlessly hard.

**Salah** fixes this with one location-aware service:

- 📍 **Mosques near you, on a map** — discovered live from OpenStreetMap.
- 🕰️ **Two kinds of times, clearly separated:**
  - the **adhan** (astronomical) times, computed on-device for any location, fully offline; and
  - the **iqama / Jumu‘ah** times each mosque actually sets, from a community registry.
- 🧭 **Qibla** direction from anywhere.
- 🚗 **Journey planner** — "I'm driving to Chicago": see which prayers fall during
  the trip, roughly where you'll be, and find a mosque to stop at.
- 🔔 **Adhan + reminders** at the right local times (per platform).

---

## Why this is the hard part — and how we solve it

Astronomical prayer times are a *solved* problem: given latitude, longitude and a
calculation method they're deterministic. The genuinely scattered data is the
**mosque-specific iqama and Jumu‘ah times**, which are human-set and live only on
mosque websites.

Salah's answer is a **two-layer model**:

| Layer | Source | Nature |
|-------|--------|--------|
| Adhan times | computed on-device (`adhan`) | deterministic, offline, every location |
| Mosque locations | OpenStreetMap (Overpass) | free, global, key-less |
| Iqama / Jumu‘ah times | **community registry** | crowdsourced, verifiable, per-mosque |

The registry overlays community times onto OSM mosques (and adds mosques OSM
doesn't have yet). That merge is the core of the product — see
[`docs/DATA_MODEL.md`](docs/DATA_MODEL.md).

---

## Repository layout

```
Salah/
├── docs/
│   ├── PRODUCT_SPEC.md     # problem, users, features, MVP scope, roadmap
│   ├── ARCHITECTURE.md     # system design, data flow, platform plan
│   ├── DATA_MODEL.md       # registry schema + merge semantics
│   └── DATA_INGESTION.md   # auto-extract from mosque pages + crowd-confirm trust ladder
├── apps/
│   └── mobile/             # Expo / React Native app (expo-router) built on @salah/core
│       ├── app/            # routes: Today, Nearby (map), Travel, Qibla, mosque detail
│       └── src/            # theme, hooks, components
├── packages/
│   └── core/               # @salah/core — platform-agnostic engine (this is built & tested)
│       ├── src/            # prayer times, qibla, geo, OSM, geocoding, registry, travel, trust, extract
│       └── test/           # 52 unit tests (vitest)
└── data/
    ├── mosque-times.schema.json   # JSON Schema for the registry
    └── mosque-times.seed.json     # illustrative seed data
```

### Core + thin UI

Everything genuinely hard — prayer math, mosque discovery, geocoding, the registry
merge, journey planning, the ingestion/trust ladder — lives in **`@salah/core`**, a
pure TypeScript library with **no React, DOM, or Node-only dependencies** and an
injectable `fetch`. It runs unchanged in React Native, a web app, or a backend.

The first UI is the **Expo / React Native** app in [`apps/mobile`](apps/mobile)
(see its README to run it). Because the logic is in the core, the screens stay
thin and a web client could be added later against the same API.

---

## `@salah/core` quick start

```ts
import {
  findNearbyMosques,
  calculatePrayerTimes,
  getPrayerStatus,
  qiblaDirection,
  planJourneyPrayers,
} from '@salah/core';

// 1. Adhan times for the current location (offline, deterministic)
const today = calculatePrayerTimes(
  { latitude: 40.7128, longitude: -74.006 },
  new Date(),
  { method: 'NorthAmerica', madhab: 'shafi' },
);

// 2. What's next?
const status = getPrayerStatus({ latitude: 40.7128, longitude: -74.006 });
// → { current: 'dhuhr', next: 'asr', nextTime: Date, minutesToNext: 73 }

// 3. Nearby mosques (OSM) + community iqama times, sorted by distance
const mosques = await findNearbyMosques(
  { latitude: 40.7128, longitude: -74.006 },
  { radiusMeters: 5000, registry: communityEntries },
  { fetch: globalThis.fetch, userAgent: 'SalahApp/0.1 (contact@salah.app)' },
);

// 4. Qibla bearing (degrees from true north)
const bearing = qiblaDirection({ latitude: 40.7128, longitude: -74.006 });

// 5. Plan prayers across a drive
const plan = planJourneyPrayers(routeSamples, { method: 'NorthAmerica' });
```

> The core never calls a global `fetch` itself — pass one in via `deps`. This
> keeps it testable and lets each platform add its own caching, retries and the
> descriptive `User-Agent` that Overpass/Nominatim request.

---

## Develop

```bash
npm install        # installs all workspaces; builds @salah/core via its "prepare"
npm test           # run the @salah/core test suite (52 tests)
npm run typecheck  # type-only check (core)
npm run build      # emit packages/core/dist
npm run mobile     # start the Expo app (apps/mobile) — see its README
```

## Status

- ✅ **Core engine** — built, typed, and tested (prayer times, qibla, geo, OSM
  discovery, geocoding, registry merge, journey planner).
- ✅ **Data ingestion engine** — provenance + crowd-confirmation trust ladder
  (`trust`) and a pluggable mosque-page extractor framework with a working
  table parser (`extract`). See [`docs/DATA_INGESTION.md`](docs/DATA_INGESTION.md).
- ✅ **Data model** — registry JSON Schema + seed.
- ✅ **Design docs** — product spec, architecture, data model, data ingestion.
- ✅ **Mobile app (v0)** — Expo / React Native: Today, Nearby (map + list),
  Travel (journey planner), Qibla, mosque detail with crowd-confirm. See
  [`apps/mobile`](apps/mobile).
- ⏭️ **Next** — Settings (calc method/madhab), submit-times form, adhan
  notifications, per-coordinate timezones; edge fetcher + Supabase persistence
  for the ingestion pipeline. See [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md).

## Attribution & licensing

Mosque locations and geocoding come from **OpenStreetMap** contributors
(© OpenStreetMap, ODbL). Respect the
[Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API) and
[Nominatim](https://operations.osmfoundation.org/policies/nominatim/) usage
policies (descriptive User-Agent, rate limiting, caching). Prayer-time math via
[`adhan`](https://github.com/batoulapps/adhan-js). Code is MIT licensed.
