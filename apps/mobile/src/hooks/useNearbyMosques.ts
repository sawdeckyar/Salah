import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  findNearbyMosques,
  type Coordinates,
  type Mosque,
  type RegistryEntry,
} from '@salah/core';
import { DEFAULT_RADIUS_M, httpDeps } from '../config';
import { registrySeed } from '../data/registrySeed';
import { rememberMosques } from '../data/mosqueStore';
import { applyLocalTimes, subscribeLocal } from '../data/localSubmissions';
import { fetchTimeRegistry, remoteEnabled } from '../data/remote';

export type NearbyState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; mosques: Mosque[] };

/**
 * Fetch mosques near a point (OSM Overpass) with the community registry and any
 * local crowdsourced times overlaid, sorted by distance. Re-runs when `origin`
 * changes, and re-applies local submissions live when they change.
 */
export function useNearbyMosques(
  origin: Coordinates | null,
  radiusMeters: number = DEFAULT_RADIUS_M,
): NearbyState & { refresh: () => void } {
  const [raw, setRaw] = useState<NearbyState>({ status: 'idle' });
  const [localVersion, setLocalVersion] = useState(0);
  const [registry, setRegistry] = useState<RegistryEntry[]>(registrySeed);

  useEffect(
    () => subscribeLocal(() => setLocalVersion((v) => v + 1)),
    [],
  );

  // Load the shared community registry from Supabase when configured.
  useEffect(() => {
    if (!remoteEnabled()) return;
    fetchTimeRegistry()
      .then((entries) => setRegistry([...registrySeed, ...entries]))
      .catch(() => {});
  }, [localVersion]);

  const load = useCallback(async () => {
    if (!origin) return;
    setRaw({ status: 'loading' });
    try {
      const mosques = await findNearbyMosques(
        origin,
        { radiusMeters, registry },
        httpDeps,
      );
      setRaw({ status: 'ready', mosques });
    } catch (e) {
      setRaw({
        status: 'error',
        message:
          e instanceof Error ? e.message : 'Could not load nearby mosques.',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.latitude, origin?.longitude, radiusMeters, registry]);

  useEffect(() => {
    load();
  }, [load]);

  // Overlay local crowdsourced times (re-derives when raw or local data change).
  const state = useMemo<NearbyState>(() => {
    if (raw.status !== 'ready') return raw;
    const mosques = applyLocalTimes(raw.mosques);
    rememberMosques(mosques);
    return { status: 'ready', mosques };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, localVersion]);

  return { ...state, refresh: load };
}
