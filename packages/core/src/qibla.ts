/**
 * Qibla (direction to the Kaaba in Mecca) calculation.
 */
import * as adhan from 'adhan';
import type { Coordinates } from './types.js';

/** Coordinates of the Kaaba, Masjid al-Haram, Mecca. */
export const KAABA: Coordinates = {
  latitude: 21.422_487,
  longitude: 39.826_206,
};

/**
 * Bearing to the Qibla from `coordinates`, in degrees clockwise from true
 * north (0 = north, 90 = east). Combine with a device compass heading to draw
 * a qibla pointer.
 */
export function qiblaDirection(coordinates: Coordinates): number {
  const coords = new adhan.Coordinates(
    coordinates.latitude,
    coordinates.longitude,
  );
  return adhan.Qibla(coords);
}
