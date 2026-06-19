/**
 * The community mosque-times registry — the heart of what makes Salah useful.
 *
 * OSM tells us *where* mosques are; it almost never knows their iqama or
 * Jumu‘ah times. Those live, scattered, on each mosque's own website. The
 * registry is a single crowdsourced dataset of mosque-specific congregation
 * times. This module indexes it and merges it onto OSM results so a mosque on
 * the map shows its real jamā‘ah times.
 *
 * In production the registry is served from a database (Supabase). Here it is
 * just an array of `RegistryEntry` — the merge logic is identical either way.
 */
import { haversineMeters } from './geo.js';
import type {
  Coordinates,
  Mosque,
  MosqueTimes,
  RegistryEntry,
} from './types.js';

export interface RegistryIndex {
  /** Entries keyed by their OSM reference (e.g. "node/123"). */
  byOsmId: Map<string, RegistryEntry>;
  /** Standalone entries (no OSM reference) as ready-to-use mosques. */
  standalone: Mosque[];
}

function normalizeOsmId(osmId: string): string {
  // Accept "node/123", "osm:node/123", or "https://www.openstreetmap.org/node/123".
  const m = osmId.match(/(node|way|relation)\/(\d+)/i);
  return m ? `${m[1].toLowerCase()}/${m[2]}` : osmId;
}

function entryToStandaloneMosque(entry: RegistryEntry): Mosque | null {
  if (!entry.location || !entry.name) return null;
  return {
    id: `reg:${entry.id}`,
    source: 'registry',
    name: entry.name,
    location: entry.location,
    address: entry.address,
    city: entry.city,
    country: entry.country,
    contact: entry.contact,
    times: entry.times,
  };
}

/** Build a fast lookup index from a flat list of registry entries. */
export function buildRegistryIndex(entries: RegistryEntry[]): RegistryIndex {
  const byOsmId = new Map<string, RegistryEntry>();
  const standalone: Mosque[] = [];

  for (const entry of entries) {
    if (entry.osmId) {
      byOsmId.set(normalizeOsmId(entry.osmId), entry);
    } else {
      const mosque = entryToStandaloneMosque(entry);
      if (mosque) standalone.push(mosque);
    }
  }
  return { byOsmId, standalone };
}

function osmRefOf(mosque: Mosque): string | null {
  // mosque.id looks like "osm:node/123"; strip the "osm:" prefix.
  const m = mosque.id.match(/^osm:(.+)$/);
  return m ? normalizeOsmId(m[1]) : null;
}

/**
 * Overlay registry times onto OSM mosques and fold in any standalone registry
 * mosques near the search origin.
 *
 * @param osmMosques  Results from Overpass (source: 'osm').
 * @param index       From `buildRegistryIndex`.
 * @param origin      If given, standalone mosques within `nearbyRadiusM` are
 *                    included and everything is annotated with distance.
 * @param nearbyRadiusM  Radius for including standalone mosques. Default 25km.
 */
export function mergeMosquesWithRegistry(
  osmMosques: Mosque[],
  index: RegistryIndex,
  origin?: Coordinates,
  nearbyRadiusM = 25_000,
): Mosque[] {
  const usedEntryIds = new Set<string>();

  const merged: Mosque[] = osmMosques.map((m) => {
    const ref = osmRefOf(m);
    const entry = ref ? index.byOsmId.get(ref) : undefined;
    if (!entry) return m;
    usedEntryIds.add(entry.id);
    return {
      ...m,
      source: 'merged',
      // Registry contact/address augment OSM where OSM is missing them.
      address: m.address ?? entry.address,
      city: m.city ?? entry.city,
      country: m.country ?? entry.country,
      contact: mergeContact(m.contact, entry.contact),
      times: entry.times,
    };
  });

  // Standalone registry mosques OSM doesn't know about.
  for (const standalone of index.standalone) {
    if (origin) {
      const d = haversineMeters(origin, standalone.location);
      if (d > nearbyRadiusM) continue;
    }
    merged.push(standalone);
  }

  if (origin) {
    for (const m of merged) {
      m.distanceMeters = haversineMeters(origin, m.location);
    }
    merged.sort(
      (a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity),
    );
  }

  return merged;
}

function mergeContact(
  a: Mosque['contact'],
  b: Mosque['contact'],
): Mosque['contact'] {
  const merged = { ...(b ?? {}), ...(a ?? {}) };
  return Object.keys(merged).length ? merged : undefined;
}

/**
 * Validate a community time submission before it enters the registry. Returns
 * a list of human-readable problems (empty = valid). Used by the submission
 * form and the backend write path.
 */
export function validateMosqueTimes(times: MosqueTimes): string[] {
  const errors: string[] = [];
  const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;

  if (times.iqama) {
    for (const [prayer, value] of Object.entries(times.iqama)) {
      if (value && !hhmm.test(value)) {
        errors.push(`Iqama time for ${prayer} must be HH:mm (got "${value}").`);
      }
    }
  }
  if (times.jumuah) {
    times.jumuah.forEach((j, i) => {
      if (!hhmm.test(j.khutbahTime)) {
        errors.push(`Jumu‘ah #${i + 1} khutbah time must be HH:mm.`);
      }
      if (j.iqamaTime && !hhmm.test(j.iqamaTime)) {
        errors.push(`Jumu‘ah #${i + 1} iqama time must be HH:mm.`);
      }
    });
  }
  if (
    !times.iqama &&
    (!times.jumuah || times.jumuah.length === 0)
  ) {
    errors.push('Provide at least one iqama time or a Jumu‘ah service.');
  }
  return errors;
}
