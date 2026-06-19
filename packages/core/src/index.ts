/**
 * @salah/core — platform-agnostic engine for the Salah app.
 *
 * Everything a React Native app, a web PWA, or a backend needs to:
 *   - compute adhan times anywhere, offline (prayerTimes, qibla)
 *   - find mosques by location (osm) and label places (geocoding)
 *   - overlay community iqama/Jumu‘ah times (registry)
 *   - plan prayers across a journey (travel)
 */
export * from './types.js';
export * from './http.js';
export * from './geo.js';
export * from './prayerTimes.js';
export * from './qibla.js';
export * from './osm.js';
export * from './geocoding.js';
export * from './registry.js';
export * from './travel.js';

import { resolveFetch, type HttpDeps } from './http.js';
import {
  fetchNearbyMosques,
  type NearbyMosquesOptions,
} from './osm.js';
import {
  buildRegistryIndex,
  mergeMosquesWithRegistry,
} from './registry.js';
import type { Coordinates, Mosque, RegistryEntry } from './types.js';

export interface FindNearbyMosquesOptions extends NearbyMosquesOptions {
  /** Community time entries to overlay. Defaults to none. */
  registry?: RegistryEntry[];
  /** Radius for including standalone (OSM-unknown) registry mosques. */
  registryNearbyRadiusM?: number;
}

/**
 * One-call orchestration for the main "mosques near me" screen: query OSM,
 * overlay the community time registry, fold in standalone registry mosques,
 * and return everything sorted by distance from `origin`.
 */
export async function findNearbyMosques(
  origin: Coordinates,
  options: FindNearbyMosquesOptions = {},
  deps?: Partial<HttpDeps>,
): Promise<Mosque[]> {
  // Validate fetch up front so callers fail fast with a clear message.
  resolveFetch(deps);

  const osmMosques = await fetchNearbyMosques(origin, options, deps);
  const index = buildRegistryIndex(options.registry ?? []);
  return mergeMosquesWithRegistry(
    osmMosques,
    index,
    origin,
    options.registryNearbyRadiusM,
  );
}
