import { Linking, Platform } from 'react-native';
import type { Coordinates } from '@salah/core';

/** Open turn-by-turn directions to a coordinate in the OS maps app. */
export function openDirections(c: Coordinates, label?: string): void {
  const lat = c.latitude;
  const lng = c.longitude;
  const q = label ? encodeURIComponent(label) : '';
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d${q ? `&q=${q}` : ''}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  Linking.openURL(url).catch(() => {});
}
