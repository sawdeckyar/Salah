import { Alert, Linking, Platform } from 'react-native';
import type { Coordinates } from '@salah/core';

function appleUrl(c: Coordinates, label?: string): string {
  const q = label ? `&q=${encodeURIComponent(label)}` : '';
  return `http://maps.apple.com/?daddr=${c.latitude},${c.longitude}&dirflg=d${q}`;
}

function googleUrl(c: Coordinates): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`;
}

function open(url: string) {
  Linking.openURL(url).catch(() => {});
}

/**
 * Ask which maps app to use, then open turn-by-turn directions. Apple Maps is
 * offered on iOS; Google Maps on both (opens the app if installed, else web).
 */
export function openDirections(c: Coordinates, label?: string): void {
  const buttons: { text: string; onPress?: () => void; style?: 'cancel' }[] = [];
  if (Platform.OS === 'ios') {
    buttons.push({ text: 'Apple Maps', onPress: () => open(appleUrl(c, label)) });
  }
  buttons.push({ text: 'Google Maps', onPress: () => open(googleUrl(c)) });
  buttons.push({ text: 'Cancel', style: 'cancel' });

  // On Android there's only Google here — just open it directly.
  if (Platform.OS !== 'ios') {
    open(googleUrl(c));
    return;
  }
  Alert.alert('Directions', label ?? 'Open directions in…', buttons);
}
