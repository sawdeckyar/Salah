import type { CalculationMethodName, HttpDeps, Madhab } from '@salah/core';

/**
 * Descriptive User-Agent for OSM Overpass / Nominatim, as their usage policies
 * request. Replace the contact before any real deployment.
 */
export const USER_AGENT = 'SalahApp/0.1 (https://github.com/sawdeckyar/Salah)';

/** Default search radius for "mosques near me". */
export const DEFAULT_RADIUS_M = 6000;

/** Default prayer-calculation settings (later: user-configurable in Settings). */
export const DEFAULT_METHOD: CalculationMethodName = 'NorthAmerica';
export const DEFAULT_MADHAB: Madhab = 'shafi';

/** Shared HTTP deps for all core network calls (React Native ships fetch). */
export const httpDeps: Partial<HttpDeps> = {
  fetch: globalThis.fetch?.bind(globalThis),
  userAgent: USER_AGENT,
};
