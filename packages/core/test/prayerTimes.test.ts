import { describe, expect, it } from 'vitest';
import {
  asEntries,
  calculatePrayerTimes,
  getPrayerStatus,
} from '../src/prayerTimes.js';
import type { Coordinates } from '../src/types.js';

const NYC: Coordinates = { latitude: 40.7128, longitude: -74.006 };

describe('calculatePrayerTimes', () => {
  it('computes the six daily times for a location and date', () => {
    const result = calculatePrayerTimes(
      NYC,
      new Date('2026-06-19T12:00:00Z'),
      { method: 'NorthAmerica', madhab: 'shafi' },
    );
    expect(result.date).toBe('2026-06-19');
    expect(result.method).toBe('NorthAmerica');
    const order = asEntries(result).map(([, t]) => t.getTime());
    // Times must be strictly increasing across the day.
    for (let i = 1; i < order.length; i++) {
      expect(order[i]).toBeGreaterThan(order[i - 1]);
    }
  });

  it('places Hanafi Asr later than Shafi Asr (later shadow ratio)', () => {
    const date = new Date('2026-06-19T12:00:00Z');
    const shafi = calculatePrayerTimes(NYC, date, { madhab: 'shafi' });
    const hanafi = calculatePrayerTimes(NYC, date, { madhab: 'hanafi' });
    expect(hanafi.times.asr.getTime()).toBeGreaterThan(
      shafi.times.asr.getTime(),
    );
  });

  it('applies per-prayer minute adjustments', () => {
    const date = new Date('2026-06-19T12:00:00Z');
    const base = calculatePrayerTimes(NYC, date, {});
    const tuned = calculatePrayerTimes(NYC, date, {
      adjustments: { fajr: 10 },
    });
    const diffMin =
      (tuned.times.fajr.getTime() - base.times.fajr.getTime()) / 60000;
    expect(Math.round(diffMin)).toBe(10);
  });

  it('throws on an unknown calculation method', () => {
    expect(() =>
      // @ts-expect-error intentionally invalid
      calculatePrayerTimes(NYC, new Date(), { method: 'Nonexistent' }),
    ).toThrow();
  });
});

describe('getPrayerStatus', () => {
  it('reports the next prayer and minutes remaining', () => {
    // Pick an instant before Fajr so "next" is well-defined.
    const status = getPrayerStatus(NYC, new Date('2026-06-19T05:00:00Z'), {
      method: 'NorthAmerica',
    });
    expect(status.next).not.toBe('none');
    expect(status.nextTime).toBeInstanceOf(Date);
    expect(status.minutesToNext).toBeGreaterThanOrEqual(0);
  });

  it('rolls over to tomorrow’s Fajr after Isha', () => {
    // Late at night, local time, after Isha.
    const lateNight = new Date('2026-06-20T04:00:00Z'); // ~midnight EDT
    const status = getPrayerStatus(NYC, lateNight, { method: 'NorthAmerica' });
    expect(status.next).toBe('fajr');
    expect(status.nextTime!.getTime()).toBeGreaterThan(lateNight.getTime());
  });
});
