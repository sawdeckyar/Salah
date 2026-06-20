# Salah — Mobile app (Expo / React Native)

The consumer app, built on **[`@salah/core`](../../packages/core)**. Expo SDK 56,
React Native 0.85, React 19, expo-router.

## Screens

| Tab | Route | What it does |
|-----|-------|--------------|
| **Today** | `app/(tabs)/index.tsx` | Next-prayer banner + countdown and today's adhan times for your location. |
| **Nearby** | `app/(tabs)/nearby.tsx` | Map (Leaflet/OSM in a WebView, no API key) + distance-sorted list of mosques with their congregation times. |
| **Travel** | `app/(tabs)/travel.tsx` | Search a city → which prayers fall during the drive (journey planner) + the destination's times. |
| **Qibla** | `app/(tabs)/qibla.tsx` | Live compass pointing to the Kaaba. |
| Mosque detail | `app/mosque/[id].tsx` | Adhan + iqama + Jumu‘ah, trust badge, contact links, and a ✓/✗ crowd-confirm control wired to the core trust ladder. |

All prayer math, mosque discovery, geocoding, registry merge, journey planning,
and the trust ladder come from `@salah/core` — the screens are a thin layer.

## Run it

From the repo root (installs the workspace and builds the core):

```bash
npm install
npm run build --workspace @salah/core   # also runs automatically via core's "prepare"
```

Then start the app:

```bash
npm run mobile          # = npm run start --workspace mobile
# or
cd apps/mobile && npx expo start
```

Open in **Expo Go** (scan the QR) or a simulator. Everything here runs in Expo
Go — the map is a key-free Leaflet/OSM WebView, so no native map module or
Google API key is required.

> Grant **location** permission when prompted — Today, Nearby, Travel, and Qibla
> all use it.

## Notes & current limitations

- **Timezones:** times render in the *device's* local timezone. For Travel,
  a destination in another timezone will show times in your current zone until
  per-coordinate timezone conversion lands.
- **Registry data** is the bundled illustrative seed (`src/data/registrySeed.ts`).
  It will be replaced by the Supabase-backed registry — see
  [`docs/DATA_INGESTION.md`](../../docs/DATA_INGESTION.md).
- **Crowd-confirm** votes on the detail screen are in-memory (they demonstrate
  the real `@salah/core` trust ladder); persistence is the next step.
- **OSM etiquette:** Overpass/Nominatim calls send a descriptive User-Agent
  (`src/config.ts`). Replace the contact and add caching before any real launch.

## Project wiring

- `metro.config.js` — monorepo config so Metro resolves the `@salah/core`
  workspace package and honors its `exports`.
- `app.json` — expo-router plugin + location permission strings.
- `src/` — theme, formatting, config, hooks (`useLocation`, `useNearbyMosques`),
  and presentational components.
