import tzlookup from 'tz-lookup';
import type { Coordinates } from '@salah/core';

/**
 * Offline timezone helpers. Prayer times are absolute instants; to show a
 * location's *local* wall-clock (important for travel to another timezone) we
 * resolve the IANA zone from coordinates and format the instant in that zone.
 */
export function tzForCoords(c: Coordinates): string | null {
  try {
    return tzlookup(c.latitude, c.longitude);
  } catch {
    return null;
  }
}

/** Format an instant in a given IANA timezone (falls back to device tz). */
export function formatTimeAt(date: Date, tz: string | null): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz ?? undefined,
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
}

/** A short timezone label like "EDT" for display, or '' if unavailable. */
export function tzAbbrev(date: Date, tz: string | null): string {
  if (!tz) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    }).formatToParts(date);
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}
