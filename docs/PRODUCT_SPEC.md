# Salah — Product Specification

_Last updated: 2026-06-19 · Status: design finalized, core engine built_

## 1. Problem

Daily and Friday (Jumu‘ah) prayer times in Muslim communities are **fragmented**:

- Every mosque sets its **own** iqama (congregation) and Jumu‘ah times.
- Those times live **only on each mosque's website** (or a flyer on the door).
- There is **no single, location-aware source**.
- **Travellers suffer most:** someone driving between cities can't easily plan to
  reach a congregation on time, or even find which mosques are en route.

## 2. Vision

A single app that, from your location (or anywhere on a map), shows:

1. The **adhan** (astronomical) prayer times for that spot.
2. The **mosques nearby**, on a map and as a list.
3. Each mosque's **real iqama and Jumu‘ah times**.
4. The **qibla** direction.
5. A **journey planner** for prayers while travelling between cities.

## 3. Target users

| User | Primary need |
|------|--------------|
| **Traveller / commuter** | Find mosques + their Jumu‘ah times along a route; plan stops. |
| **New-in-town / visitor** | Discover the nearest mosque and when its next congregation is. |
| **Local worshipper** | Quick daily reference for their mosque's iqama times + adhan reminders. |
| **Mosque admin** | Publish/maintain their mosque's times in one authoritative place. |

## 4. Core concepts (must stay distinct in the UI)

- **Adhan time** — astronomical, computed from coordinates + method. Deterministic,
  offline, available for *every* location. (When the prayer *enters*.)
- **Iqama time** — when the *congregation* prays. Human-set, per mosque. Comes from
  the community registry; not computable.
- **Jumu‘ah** — Friday's midday congregation(s); each mosque may host several at
  different times and in different languages.

Conflating these is the #1 UX risk. Always label which is which.

## 5. Features

### 5.1 MVP (v1)
- **Locate me** → reverse-geocoded place label + adhan times for here/today.
- **Mosques near me** → OSM Overpass discovery, on a map + distance-sorted list.
- **Mosque detail** → adhan times + community iqama/Jumu‘ah times (or "times not yet
  submitted" with a prompt to add them).
- **Calculation settings** → method (MWL, ISNA/NorthAmerica, Umm al-Qura, Karachi, …),
  madhab (Asr), high-latitude rule, per-prayer adjustments.
- **Qibla** compass.
- **City lookup** → type any city → its adhan times + mosques there (travel pre-planning).
- **Submit/update times** → community form, validated, attributed.

### 5.2 v1.x
- **Adhan playback** + local notifications at prayer (and pre-iqama) times.
- **Journey planner** → origin → destination, see which prayers fall during the
  trip, where, and suggested mosque stops (`planJourneyPrayers`).
- **Offline cache** → last-known mosques + times available without signal.
- **Auto-extracted times + crowd confirmation** → seed iqama/Jumu‘ah times from
  mosque web pages, shown as candidates with a ✓/✗/✎ prompt to nearby users; a
  trust ladder promotes confirmed times and re-checks stale ones
  ([`DATA_INGESTION.md`](DATA_INGESTION.md)).
- **Verification** → mosque-admin claim + "verified" badge on times.

### 5.3 Later
- Mosque admin portal (self-service times, special Ramadan/Eid schedules).
- Hijri calendar, Ramadan timetables, Eid prayer announcements.
- Notifications by mosque ("notify me before ICCNY's Maghrib iqama").
- Community moderation / trust scoring of submissions.

## 6. Out of scope (v1)
- Turn-by-turn navigation (we point at a mosque; hand off to the OS map app).
- Donations/payments, social feed, halal-food directory.

## 7. Non-functional requirements
- **Offline-first** for adhan times + qibla + last-fetched mosque data.
- **Privacy:** location used on-device; never sell/track. Geocoding requests
  carry only what's needed.
- **Provider etiquette:** descriptive User-Agent, client-side rate limiting,
  cache OSM/Nominatim responses (their policies require it).
- **Accuracy & humility:** show the calculation method; label unverified times;
  iqama times are community data, not guarantees.

## 8. Success metrics
- Time-to-first-useful-answer (location → nearby mosque times) < 5s.
- % of nearby mosques with community times present (registry coverage).
- Repeat usage by travellers (journeys planned).

## 9. Roadmap / sequencing

| Phase | Deliverable | State |
|-------|-------------|-------|
| 0 | Design + **platform-agnostic core** (`@salah/core`) + data model | ✅ done |
| 1 | Expo/RN app: Today, Nearby (map + list), mosque detail, Qibla, Travel | ✅ v0 (`apps/mobile`) |
| 2 | Settings (method/madhab), city lookup polish, submit-times form | 🚧 partial (city lookup shipped) |
| 3 | Adhan playback + notifications; offline cache; per-coordinate timezones | ⏭️ next |
| 4 | Journey planner UI | ✅ v0 (Travel tab) |
| 5 | Supabase-backed registry + edge ingestion + mosque-admin verification | |

### Positioning (post competitive review)

Nearby-iqama apps exist and are mature (MAWAQIT leads, with mosque-owned data via
free in-mosque displays). Salah's two wedges:

1. **Traveller / journey niche** — under-served by mosque-centric incumbents;
   "which prayers fall during my drive, where, and which mosque do I stop at"
   (`travel.planJourneyPrayers`).
2. **Hybrid data acquisition** — auto-extract iqama times from mosque pages, then
   crowd-confirm, instead of pure crowdsourcing (low coverage) or years of
   mosque onboarding. See [`DATA_INGESTION.md`](DATA_INGESTION.md).

**Platform decision is deferred** (leaning React Native / mobile). Because all
non-UI logic is in `@salah/core`, phase 1 can start on either React Native or a
web PWA without rework. See [`ARCHITECTURE.md`](ARCHITECTURE.md).
