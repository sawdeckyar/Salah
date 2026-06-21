# Salah — Product Vision

_Status: finalized 2026-06-21. This is the north star; feature specifics live in
[`PRODUCT_SPEC.md`](PRODUCT_SPEC.md), data/trust in
[`DATA_INGESTION.md`](DATA_INGESTION.md)._

## North star

> **Mosque times, solved.** The trustworthy place to find *any* mosque's real
> prayer, iqama and Jumu‘ah times — wherever you are — built on a community that
> keeps the data honest.

Everything else (nearby map, halal discovery, parking, events, qibla, traveller
tools) exists to serve, surround, and reinforce that one promise.

## The problem

Daily and Friday prayer times are **fragmented**: every mosque sets its own
iqama and Jumu‘ah times, published only on its own website or a flyer. There is
no single, reliable, location-aware source. **Travellers and newcomers suffer
most** — in an unfamiliar city you can't easily find the nearest mosque, when its
congregation actually prays, where to park, or where to eat halal.

## Who it's for

| Audience | Role | Why us |
|----------|------|--------|
| **Travellers & newcomers** _(primary)_ | The people we optimize for when features conflict. | In an unfamiliar place they need mosque + times + halal *fast*; incumbents assume you're near your home mosque. |
| Local daily worshippers | Everyday retention; the people most able to *verify* times. | One quick reference + their community in one app. |
| Mosques & organizers | Supply side — publish times, post events. | Free reach; one authoritative place for their times. |

When a decision pits these against each other, **the traveller/newcomer wins.**

## Positioning & differentiation

Nearby-iqama apps exist (MAWAQIT leads, ~9,500 mosques, via mosque-owned data).
We don't win by copying them. Our edges:

1. **Universal coverage + honesty layer.** We show *every* mosque (OpenStreetMap),
   even ones with no published times ("times not yet submitted — add them"), and
   we make crowdsourced times **trustworthy** with a visible trust ladder
   (candidate → crowd-confirmed → mosque-verified) and staleness checks. The data
   model *is* the moat.
2. **The traveller bundle.** Mosque times + halal food + parking + community
   events, location-aware, for when you're on the road or new in town — nobody
   packages this for that moment.
3. **Community-owned, not vendor-owned.** Free, crowdsourced, sadaqah-supported —
   aligned with users, not advertisers.

## Product pillars

**Core (the promise):**
- **Real mosque times** — adhan computed on-device anywhere; iqama/Jumu‘ah from
  the community registry; auto-extraction from mosque pages + crowd confirmation.

**Supporting (the surround — must feed engagement/data back to the core):**
- **Nearby** — full-screen map of all mosques, search-this-area, next prayer on tap.
- **Explore** — halal food (live OSM) + community fun/events/gatherings/meetups
  with RSVP. The reason to open the app between prayers.
- **Parking** — crowdsourced legal/no-parking pins and drawn areas around mosques.
- **Qibla**, **per-location timezones**, **musāfir** (qaṣr/combine) — traveller
  essentials.

Guardrail for "build both in parallel": every supporting feature should either
(a) bring people in who then rely on mosque times, or (b) improve the mosque-time
data. If it does neither, it's a distraction.

## The flywheel (why it compounds)

```
   more users  ──▶  more confirmations & submissions  ──▶  more trustworthy
        ▲                                                     mosque times
        │                                                          │
        └──────────  better, more-covered data attracts  ◀────────┘
```

Auto-extraction seeds coverage; the crowd verifies; verified data attracts more
travellers; travellers verify more. Community/halal/events widen the top of the
funnel.

## Principles

1. **Trust over coverage.** Never show a confidently-wrong time. Label source +
   confidence; let times go stale and ask for re-confirmation.
2. **Free, forever, for the core.** Prayer times and mosque finding are never
   paywalled. Sustained by **donations (sadaqah)**.
3. **Community-owned data** with attribution (© OpenStreetMap) and easy correction.
4. **Privacy-respecting.** Location used to help, not to track or sell. Anonymous
   by default.
5. **Humility on religious content.** Calculation method shown; qaṣr/jam‘ and
   Jumu‘ah framed as guidance, not fatwa.
6. **Works on the road.** Offline-friendly core; correct across timezones.

## Business model

**Free + sadaqah donations.** Keep the whole core free; invite optional
donations (in-app + web). Possible *later, non-paywalling* additions if needed:
sponsored halal/mosque listings clearly marked, or free mosque-admin tools — but
only if they don't compromise trust or the free core.

## Success metrics

- **North-star metric:** trustworthy mosque-time lookups (a user views a
  crowd-confirmed or mosque-verified set of times).
- **Coverage:** % of mosques shown near active users that have *any* community
  times; % that are *verified*.
- **Trust loop:** confirmations & submissions per active user.
- **Traveller value:** lookups in a city ≠ the user's home city.
- **Engagement:** Explore opens / RSVPs (top-of-funnel health).

## Roadmap to launch (two tracks, in parallel)

**Track 1 — Core to launch-ready**
- Settings (calculation method/madhab), per-location timezone polish.
- Adhan notifications (needs a dev build).
- Tighten the trust ladder UX; seed verified mosques in a beachhead city.

**Track 2 — Community & data**
- Supabase live (dev → clean prod) + the hardening migration.
- Crowdsourced photos / "suggest a halal spot"; structured event dates.

**Launch gates (must clear before App Store):**
- ✅ Platform-agnostic core, backend schema + hardening migration written.
- ⬜ **UGC compliance** (terms + report + block + moderation) — Guideline 1.2.
- ⬜ Privacy policy + App Privacy labels; real icon/screenshots.
- ⬜ Enable anonymous auth; apply migrations to a clean prod DB.

See [`apps/mobile/APP_STORE.md`](../apps/mobile/APP_STORE.md).

## Non-goals (for now)

- Turn-by-turn navigation (hand off to Apple/Google Maps).
- Full journey/route planning (incumbents do it; deliberately removed).
- Becoming a generic Muslim super-app — breadth only where it feeds the core.
- Ad-driven monetization.
