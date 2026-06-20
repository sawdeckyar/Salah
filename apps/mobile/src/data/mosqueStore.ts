import type { Mosque } from '@salah/core';

/**
 * Minimal in-memory cache of the most recently loaded mosques, so the detail
 * route can resolve a mosque by id without re-querying. (A later iteration can
 * swap this for React Query / a real cache.)
 */
const cache = new Map<string, Mosque>();

export function rememberMosques(mosques: Mosque[]): void {
  for (const m of mosques) cache.set(m.id, m);
}

export function getMosque(id: string): Mosque | undefined {
  return cache.get(id);
}
