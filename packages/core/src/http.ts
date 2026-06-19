/**
 * A tiny, injectable HTTP surface.
 *
 * The core library never reaches for a global `fetch` directly. Callers pass a
 * `FetchLike` (the platform's fetch, or a mock in tests). This keeps the core
 * pure and testable, and lets each platform supply its own networking,
 * caching, retries, or User-Agent headers (Nominatim/Overpass both ask for a
 * descriptive User-Agent).
 */

export type FetchLike = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}>;

export interface HttpDeps {
  fetch: FetchLike;
  /** Sent as User-Agent / Referer where the provider's policy requests it. */
  userAgent?: string;
  signal?: AbortSignal;
}

/** Resolve a default fetch from the host environment, or throw a clear error. */
export function resolveFetch(deps?: Partial<HttpDeps>): FetchLike {
  if (deps?.fetch) return deps.fetch;
  const g = globalThis as { fetch?: unknown };
  if (typeof g.fetch === 'function') {
    return g.fetch.bind(globalThis) as FetchLike;
  }
  throw new Error(
    'No fetch implementation available. Pass { fetch } in deps (e.g. globalThis.fetch or node-fetch).',
  );
}
