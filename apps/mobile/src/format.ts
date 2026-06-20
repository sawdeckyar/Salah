import type { Prayer } from '@salah/core';

/** Display an absolute time in the device's local timezone, e.g. "1:15 PM". */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Convert a wall-clock "HH:mm" (mosque-local iqama) into "h:mm AM/PM". */
export function formatHHmm(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number.parseInt(hStr, 10);
  const m = Number.parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const mer = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${mer}`;
}

/** Human distance: metres under 1 km, otherwise one-decimal km. */
export function formatDistance(meters?: number): string {
  if (meters == null) return '';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** "2h 13m" / "13m" countdown from a minute count. */
export function formatCountdown(minutes: number | null): string {
  if (minutes == null) return '—';
  if (minutes <= 0) return 'now';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const PRAYER_LABELS: Record<Prayer, string> = {
  fajr: 'Fajr',
  sunrise: 'Sunrise',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

export function prayerLabel(p: Prayer): string {
  return PRAYER_LABELS[p];
}
