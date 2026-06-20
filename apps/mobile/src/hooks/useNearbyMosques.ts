import { useCallback, useEffect, useState } from 'react';
import { findNearbyMosques, type Coordinates, type Mosque } from '@salah/core';
import { DEFAULT_RADIUS_M, httpDeps } from '../config';
import { registrySeed } from '../data/registrySeed';
import { rememberMosques } from '../data/mosqueStore';

export type NearbyState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; mosques: Mosque[] };

/**
 * Fetch mosques near a point (OSM Overpass) with the community registry overlaid
 * and sorted by distance. Re-runs when `origin` changes.
 */
export function useNearbyMosques(
  origin: Coordinates | null,
  radiusMeters: number = DEFAULT_RADIUS_M,
): NearbyState & { refresh: () => void } {
  const [state, setState] = useState<NearbyState>({ status: 'idle' });

  const load = useCallback(async () => {
    if (!origin) return;
    setState({ status: 'loading' });
    try {
      const mosques = await findNearbyMosques(
        origin,
        { radiusMeters, registry: registrySeed },
        httpDeps,
      );
      rememberMosques(mosques);
      setState({ status: 'ready', mosques });
    } catch (e) {
      setState({
        status: 'error',
        message:
          e instanceof Error ? e.message : 'Could not load nearby mosques.',
      });
    }
  }, [origin?.latitude, origin?.longitude, radiusMeters]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refresh: load };
}
