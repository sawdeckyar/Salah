/**
 * City / place search and reverse geocoding via OpenStreetMap Nominatim.
 *
 * Powers the travel-planning flow: "I'm driving to Chicago — show me prayer
 * times and mosques there." Forward geocoding turns a typed city into
 * coordinates; reverse geocoding labels the user's GPS position.
 *
 * Note: Nominatim's usage policy asks for a descriptive User-Agent and at most
 * ~1 request/second. Pass `userAgent` via deps and debounce on the client.
 */
import { resolveFetch, type HttpDeps } from './http.js';
import type { Coordinates, GeocodeResult } from './types.js';

export const DEFAULT_NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org';

interface NominatimPlace {
  place_id?: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
}

function pickCity(addr?: Record<string, string>): string | undefined {
  if (!addr) return undefined;
  return (
    addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? addr.county
  );
}

function toResult(p: NominatimPlace): GeocodeResult {
  return {
    displayName: p.display_name,
    coordinates: {
      latitude: Number.parseFloat(p.lat),
      longitude: Number.parseFloat(p.lon),
    },
    city: pickCity(p.address),
    country: p.address?.country,
    providerId: p.place_id != null ? String(p.place_id) : undefined,
  };
}

export interface GeocodeOptions {
  endpoint?: string;
  /** Max results for forward search. Default 5. */
  limit?: number;
  /** Optional ISO country code bias, e.g. "us". */
  countryCodes?: string;
}

/** Forward geocode: turn a free-text city/place query into coordinates. */
export async function geocodeCity(
  query: string,
  options: GeocodeOptions = {},
  deps?: Partial<HttpDeps>,
): Promise<GeocodeResult[]> {
  const fetchImpl = resolveFetch(deps);
  const base = options.endpoint ?? DEFAULT_NOMINATIM_ENDPOINT;
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    limit: String(options.limit ?? 5),
  });
  if (options.countryCodes) params.set('countrycodes', options.countryCodes);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (deps?.userAgent) headers['User-Agent'] = deps.userAgent;

  const res = await fetchImpl(`${base}/search?${params.toString()}`, {
    headers,
    signal: deps?.signal,
  });
  if (!res.ok) throw new Error(`Geocoding failed: HTTP ${res.status}`);

  const data = (await res.json()) as NominatimPlace[];
  return Array.isArray(data) ? data.map(toResult) : [];
}

/** Reverse geocode: label a coordinate (e.g. the user's current position). */
export async function reverseGeocode(
  coordinates: Coordinates,
  options: GeocodeOptions = {},
  deps?: Partial<HttpDeps>,
): Promise<GeocodeResult | null> {
  const fetchImpl = resolveFetch(deps);
  const base = options.endpoint ?? DEFAULT_NOMINATIM_ENDPOINT;
  const params = new URLSearchParams({
    lat: String(coordinates.latitude),
    lon: String(coordinates.longitude),
    format: 'jsonv2',
    addressdetails: '1',
  });

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (deps?.userAgent) headers['User-Agent'] = deps.userAgent;

  const res = await fetchImpl(`${base}/reverse?${params.toString()}`, {
    headers,
    signal: deps?.signal,
  });
  if (!res.ok) throw new Error(`Reverse geocoding failed: HTTP ${res.status}`);

  const data = (await res.json()) as NominatimPlace | { error?: string };
  if (!data || 'error' in data || !('lat' in data)) return null;
  return toResult(data as NominatimPlace);
}
