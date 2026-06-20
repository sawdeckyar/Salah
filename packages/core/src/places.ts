/**
 * Discover Muslim-friendly places (halal restaurants, cafes, shops) from
 * OpenStreetMap — the basis for making Travel a discovery hub. Uses the
 * `diet:halal` tag (yes/only). Key-free, like the mosque finder.
 */
import { resolveFetch, type HttpDeps } from './http.js';
import {
  DEFAULT_OVERPASS_ENDPOINT,
  type NearbyMosquesOptions,
} from './osm.js';
import type { Coordinates } from './types.js';

export type PlaceKind = 'restaurant' | 'cafe' | 'fast_food' | 'shop' | 'other';

export interface Place {
  id: string;
  name: string;
  location: Coordinates;
  kind: PlaceKind;
  cuisine?: string;
  /** 'only' = fully halal, 'yes' = halal options available. */
  halal?: string;
  /** Photo URL from OSM (image tag), if present. */
  imageUrl?: string;
  website?: string;
  phone?: string;
  distanceMeters?: number;
}

/** Overpass QL for halal places within `radius` metres of `center`. */
export function buildHalalQuery(
  center: Coordinates,
  radiusMeters = 4000,
): string {
  const lat = center.latitude;
  const lon = center.longitude;
  const r = Math.round(radiusMeters);
  return [
    '[out:json][timeout:25];',
    '(',
    `  nwr["diet:halal"="yes"](around:${r},${lat},${lon});`,
    `  nwr["diet:halal"="only"](around:${r},${lat},${lon});`,
    ');',
    'out center tags;',
  ].join('\n');
}

interface OverpassEl {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function kindOf(tags: Record<string, string>): PlaceKind {
  const a = tags.amenity;
  if (a === 'restaurant') return 'restaurant';
  if (a === 'cafe') return 'cafe';
  if (a === 'fast_food') return 'fast_food';
  if (tags.shop) return 'shop';
  return 'other';
}

export function parseHalalResponse(data: unknown): Place[] {
  const res = data as { elements?: OverpassEl[] };
  if (!res || !Array.isArray(res.elements)) return [];
  const out: Place[] = [];
  const seen = new Set<string>();
  for (const el of res.elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    const tags = el.tags ?? {};
    if (!tags.name) continue; // skip unnamed
    const id = `osm:${el.type}/${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const image = tags.image;
    out.push({
      id,
      name: tags.name,
      location: { latitude: lat, longitude: lon },
      kind: kindOf(tags),
      cuisine: tags.cuisine?.replace(/_/g, ' ').replace(/;/g, ', '),
      halal: tags['diet:halal'],
      imageUrl: image && /^https?:\/\//i.test(image) ? image : undefined,
      website: tags.website ?? tags['contact:website'],
      phone: tags.phone ?? tags['contact:phone'],
    });
  }
  return out;
}

/** Fetch halal places near a point from Overpass. */
export async function fetchHalalPlaces(
  center: Coordinates,
  options: NearbyMosquesOptions = {},
  deps?: Partial<HttpDeps>,
): Promise<Place[]> {
  const fetchImpl = resolveFetch(deps);
  const endpoint = options.endpoint ?? DEFAULT_OVERPASS_ENDPOINT;
  const radius = options.radiusMeters ?? 4000;
  const query = buildHalalQuery(center, radius);

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

  return parseHalalResponse(await res.json()).slice(0, options.limit ?? 60);
}
