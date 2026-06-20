/**
 * Discover nearby mosques from OpenStreetMap via the Overpass API.
 *
 * OSM is free, global, key-less, and community-maintained — ideal for "find
 * mosques around me / around a city I'm driving to". It gives us *locations*;
 * the community time registry (registry.ts) supplies the *iqama times* OSM
 * does not carry.
 */
import { boundingBox } from './geo.js';
import { resolveFetch, type HttpDeps } from './http.js';
import type { Coordinates, Mosque, ParkingFeature } from './types.js';

export const DEFAULT_OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
export const DEFAULT_RADIUS_M = 5_000;

export interface NearbyMosquesOptions {
  radiusMeters?: number;
  endpoint?: string;
  /** Hard cap on results (after distance sort). Default 50. */
  limit?: number;
}

/**
 * Build the Overpass QL query for muslim places of worship within `radius`
 * metres of `center`. Exposed for testing and for callers that want to run
 * the query through their own transport/cache.
 */
export function buildOverpassQuery(
  center: Coordinates,
  radiusMeters: number = DEFAULT_RADIUS_M,
): string {
  const lat = center.latitude;
  const lon = center.longitude;
  const r = Math.round(radiusMeters);
  const filter = '["amenity"="place_of_worship"]["religion"="muslim"]';
  return [
    '[out:json][timeout:25];',
    '(',
    `  node${filter}(around:${r},${lat},${lon});`,
    `  way${filter}(around:${r},${lat},${lon});`,
    `  relation${filter}(around:${r},${lat},${lon});`,
    ');',
    'out center tags;',
  ].join('\n');
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

function composeAddress(tags: Record<string, string>): string | undefined {
  const parts = [
    [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
    tags['addr:city'],
    tags['addr:state'],
    tags['addr:postcode'],
  ].filter((p) => p && p.length > 0);
  return parts.length ? parts.join(', ') : undefined;
}

/** Convert a raw Overpass element into a `Mosque`, or null if unusable. */
export function elementToMosque(el: OverpassElement): Mosque | null {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;

  const tags = el.tags ?? {};
  const name =
    tags.name ?? tags['name:en'] ?? tags['official_name'] ?? 'Unnamed mosque';

  const contact: Mosque['contact'] = {};
  const phone = tags.phone ?? tags['contact:phone'];
  const website = tags.website ?? tags['contact:website'];
  const email = tags.email ?? tags['contact:email'];
  if (phone) contact.phone = phone;
  if (website) contact.website = website;
  if (email) contact.email = email;

  return {
    id: `osm:${el.type}/${el.id}`,
    source: 'osm',
    name,
    location: { latitude: lat, longitude: lon },
    address: composeAddress(tags),
    city: tags['addr:city'],
    country: tags['addr:country'],
    contact: Object.keys(contact).length ? contact : undefined,
  };
}

/** Parse a full Overpass JSON response into mosques. */
export function parseOverpassResponse(data: unknown): Mosque[] {
  const res = data as OverpassResponse;
  if (!res || !Array.isArray(res.elements)) return [];
  const out: Mosque[] = [];
  const seen = new Set<string>();
  for (const el of res.elements) {
    const mosque = elementToMosque(el);
    if (mosque && !seen.has(mosque.id)) {
      seen.add(mosque.id);
      out.push(mosque);
    }
  }
  return out;
}

/**
 * Fetch mosques near a point from Overpass. Distances are NOT computed here;
 * pass results through `mergeMosquesWithRegistry` / `sortByDistance` (or use
 * the higher-level `findNearbyMosques` in index.ts).
 */
export async function fetchNearbyMosques(
  center: Coordinates,
  options: NearbyMosquesOptions = {},
  deps?: Partial<HttpDeps>,
): Promise<Mosque[]> {
  const fetchImpl = resolveFetch(deps);
  const endpoint = options.endpoint ?? DEFAULT_OVERPASS_ENDPOINT;
  const radius = options.radiusMeters ?? DEFAULT_RADIUS_M;
  const query = buildOverpassQuery(center, radius);

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (deps?.userAgent) headers['User-Agent'] = deps.userAgent;

  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers,
    body: `data=${encodeURIComponent(query)}`,
    signal: deps?.signal,
  });

  if (!res.ok) {
    throw new Error(`Overpass request failed: HTTP ${res.status}`);
  }

  const mosques = parseOverpassResponse(await res.json());
  const limit = options.limit ?? 50;
  return mosques.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Parking (amenity=parking)
// ---------------------------------------------------------------------------

/** Overpass QL for parking facilities within `radius` metres of `center`. */
export function buildParkingQuery(
  center: Coordinates,
  radiusMeters = 600,
): string {
  const lat = center.latitude;
  const lon = center.longitude;
  const r = Math.round(radiusMeters);
  const filter = '["amenity"="parking"]';
  return [
    '[out:json][timeout:25];',
    '(',
    `  node${filter}(around:${r},${lat},${lon});`,
    `  way${filter}(around:${r},${lat},${lon});`,
    `  relation${filter}(around:${r},${lat},${lon});`,
    ');',
    'out center tags;',
  ].join('\n');
}

function elementToParking(el: OverpassElement): ParkingFeature | null {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  const tags = el.tags ?? {};
  const capacity = Number.parseInt(tags.capacity ?? '', 10);
  return {
    id: `osm:${el.type}/${el.id}`,
    location: { latitude: lat, longitude: lon },
    name: tags.name,
    access: tags.access,
    fee: tags.fee,
    capacity: Number.isFinite(capacity) ? capacity : undefined,
  };
}

/** Parse an Overpass response into parking features. */
export function parseParkingResponse(data: unknown): ParkingFeature[] {
  const res = data as OverpassResponse;
  if (!res || !Array.isArray(res.elements)) return [];
  const out: ParkingFeature[] = [];
  const seen = new Set<string>();
  for (const el of res.elements) {
    const p = elementToParking(el);
    if (p && !seen.has(p.id)) {
      seen.add(p.id);
      out.push(p);
    }
  }
  return out;
}

/** Fetch parking facilities near a point from Overpass. */
export async function fetchNearbyParking(
  center: Coordinates,
  options: NearbyMosquesOptions = {},
  deps?: Partial<HttpDeps>,
): Promise<ParkingFeature[]> {
  const fetchImpl = resolveFetch(deps);
  const endpoint = options.endpoint ?? DEFAULT_OVERPASS_ENDPOINT;
  const radius = options.radiusMeters ?? 600;
  const query = buildParkingQuery(center, radius);

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (deps?.userAgent) headers['User-Agent'] = deps.userAgent;

  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers,
    body: `data=${encodeURIComponent(query)}`,
    signal: deps?.signal,
  });
  if (!res.ok) throw new Error(`Overpass request failed: HTTP ${res.status}`);

  const parking = parseParkingResponse(await res.json());
  return parking.slice(0, options.limit ?? 60);
}

// Re-export so the bounding box helper is reachable for map viewport queries.
export { boundingBox };
