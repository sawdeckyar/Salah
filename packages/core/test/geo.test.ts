import { describe, expect, it } from 'vitest';
import {
  boundingBox,
  haversineMeters,
  sortByDistance,
} from '../src/geo.js';
import { qiblaDirection } from '../src/qibla.js';
import type { Coordinates } from '../src/types.js';

const NYC: Coordinates = { latitude: 40.7128, longitude: -74.006 };
const LA: Coordinates = { latitude: 34.0522, longitude: -118.2437 };

describe('haversineMeters', () => {
  it('matches the known NYC↔LA great-circle distance (~3936 km)', () => {
    const km = haversineMeters(NYC, LA) / 1000;
    expect(km).toBeGreaterThan(3900);
    expect(km).toBeLessThan(3970);
  });

  it('is zero for identical points', () => {
    expect(haversineMeters(NYC, NYC)).toBe(0);
  });
});

describe('boundingBox', () => {
  it('contains the center and clamps latitude', () => {
    const box = boundingBox(NYC, 5000);
    expect(box.south).toBeLessThan(NYC.latitude);
    expect(box.north).toBeGreaterThan(NYC.latitude);
    expect(box.west).toBeLessThan(NYC.longitude);
    expect(box.east).toBeGreaterThan(NYC.longitude);
  });

  it('clamps near the poles without exceeding ±90', () => {
    const box = boundingBox({ latitude: 89.99, longitude: 0 }, 100_000);
    expect(box.north).toBeLessThanOrEqual(90);
    expect(box.south).toBeGreaterThanOrEqual(-90);
  });
});

describe('sortByDistance', () => {
  it('orders items by ascending distance and annotates them', () => {
    const items = [
      { location: LA },
      { location: { latitude: 40.73, longitude: -74.0 } }, // near NYC
    ];
    const sorted = sortByDistance(NYC, items);
    expect(sorted[0].distanceMeters).toBeLessThan(sorted[1].distanceMeters);
    expect(sorted[0].location).toEqual(items[1].location);
  });
});

describe('qiblaDirection', () => {
  it('points roughly north-east from New York (~58°)', () => {
    const bearing = qiblaDirection(NYC);
    expect(bearing).toBeGreaterThan(50);
    expect(bearing).toBeLessThan(70);
  });
});
