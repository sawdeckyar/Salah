import { describe, expect, it } from 'vitest';
import { findNearbyMosques } from '../src/index.js';
import type { FetchLike } from '../src/http.js';
import type { RegistryEntry } from '../src/types.js';

const origin = { latitude: 40.7128, longitude: -74.006 };

const overpassPayload = {
  elements: [
    {
      type: 'node',
      id: 1,
      lat: 40.713,
      lon: -74.0,
      tags: { name: 'Masjid Manhattan' },
    },
  ],
};

const registry: RegistryEntry[] = [
  {
    id: 'e1',
    osmId: 'node/1',
    times: { iqama: { fajr: '05:30' }, verified: true },
  },
  {
    id: 'e2',
    name: 'Community Musalla',
    location: { latitude: 40.715, longitude: -74.003 },
    times: { iqama: { maghrib: '20:45' } },
  },
];

describe('findNearbyMosques (orchestration)', () => {
  it('combines OSM discovery with the community registry, sorted by distance', async () => {
    const fetchMock: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => overpassPayload,
      text: async () => '',
    });

    const mosques = await findNearbyMosques(
      origin,
      { registry, radiusMeters: 4000 },
      { fetch: fetchMock },
    );

    const ids = mosques.map((m) => m.id);
    expect(ids).toContain('osm:node/1');
    expect(ids).toContain('reg:e2');

    const manhattan = mosques.find((m) => m.id === 'osm:node/1')!;
    expect(manhattan.source).toBe('merged');
    expect(manhattan.times?.iqama?.fajr).toBe('05:30');

    // Every result carries a distance and they are sorted ascending.
    for (let i = 1; i < mosques.length; i++) {
      expect(mosques[i].distanceMeters!).toBeGreaterThanOrEqual(
        mosques[i - 1].distanceMeters!,
      );
    }
  });
});
