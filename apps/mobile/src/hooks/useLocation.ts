import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { Coordinates } from '@salah/core';

export type LocationState =
  | { status: 'loading' }
  | { status: 'denied' }
  | { status: 'error'; message: string }
  | { status: 'ready'; coords: Coordinates };

/**
 * Request foreground location permission and resolve the device's coordinates.
 * Exposes `refresh()` for pull-to-retry.
 */
export function useLocation(): LocationState & { refresh: () => void } {
  const [state, setState] = useState<LocationState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setState({ status: 'denied' });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setState({
        status: 'ready',
        coords: {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        },
      });
    } catch (e) {
      setState({
        status: 'error',
        message: e instanceof Error ? e.message : 'Could not get location.',
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refresh: load };
}
