import { describe, expect, it } from 'vitest';
import {
  planJourneyPrayers,
  prayersDuringJourney,
  type JourneySample,
} from '../src/travel.js';

// A daytime drive on 2026-06-19, sampled at origin, midpoint, destination.
const samples: JourneySample[] = [
  {
    label: 'New York, NY',
    coordinates: { latitude: 40.7128, longitude: -74.006 },
    timeUtc: new Date('2026-06-19T13:00:00Z'), // 09:00 EDT
  },
  {
    label: 'Allentown, PA',
    coordinates: { latitude: 40.6084, longitude: -75.4902 },
    timeUtc: new Date('2026-06-19T16:30:00Z'),
  },
  {
    label: 'Pittsburgh, PA',
    coordinates: { latitude: 40.4406, longitude: -79.9959 },
    timeUtc: new Date('2026-06-19T22:00:00Z'), // ~18:00 EDT
  },
];

describe('planJourneyPrayers', () => {
  it('plans all five obligatory prayers', () => {
    const plan = planJourneyPrayers(samples, { method: 'NorthAmerica' });
    expect(plan.map((p) => p.prayer)).toEqual([
      'fajr',
      'dhuhr',
      'asr',
      'maghrib',
      'isha',
    ]);
  });

  it('locates mid-day prayers within the journey window at a sampled point', () => {
    const plan = planJourneyPrayers(samples, { method: 'NorthAmerica' });
    const dhuhr = plan.find((p) => p.prayer === 'dhuhr')!;
    expect(dhuhr.status).toBe('during-journey');
    const sampledCoords = samples.map((s) => s.coordinates);
    expect(sampledCoords).toContainEqual(dhuhr.coordinates);
  });

  it('marks Fajr as before the (daytime) journey', () => {
    const plan = planJourneyPrayers(samples, { method: 'NorthAmerica' });
    expect(plan.find((p) => p.prayer === 'fajr')!.status).toBe(
      'before-journey',
    );
  });

  it('prayersDuringJourney returns only in-window prayers', () => {
    const during = prayersDuringJourney(samples, { method: 'NorthAmerica' });
    expect(during.length).toBeGreaterThan(0);
    expect(during.every((p) => p.status === 'during-journey')).toBe(true);
  });

  it('throws when given no samples', () => {
    expect(() => planJourneyPrayers([])).toThrow();
  });
});
