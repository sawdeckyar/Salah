import { describe, expect, it, vi } from 'vitest';
import {
  buildHalalQuery,
  fetchHalalPlaces,
  parseHalalResponse,
} from '../src/places.js';
import type { FetchLike } from '../src/http.js';

const NYC = { latitude: 40.7128, longitude: -74.006 };

const SAMPLE = {
  elements: [
    {
      type: 'node',
      id: 1,
      lat: 40.71,
      lon: -74.0,
      tags: {
        name: 'Halal Grill',
        amenity: 'restaurant',
        cuisine: 'turkish',
        'diet:halal': 'only',
        image: 'https://example.com/grill.jpg',
        website: 'https://grill.example',
        phone: '+1-212-555-0001',
      },
    },
    {
      type: 'way',
      id: 2,
      center: { lat: 40.72, lon: -74.01 },
      tags: { name: 'Corner Cafe', amenity: 'cafe', 'diet:halal': 'yes' },
    },
    { type: 'node', id: 3, lat: 40.7, lon: -74.0, tags: { amenity: 'restaurant' } }, // no name → skip
  ],
};

describe('buildHalalQuery', () => {
  it('queries diet:halal yes/only around a point', () => {
    const q = buildHalalQuery(NYC, 3000);
    expect(q).toContain('"diet:halal"="yes"');
    expect(q).toContain('"diet:halal"="only"');
    expect(q).toContain('around:3000,40.7128,-74.006');
  });
});

describe('parseHalalResponse', () => {
  it('parses named halal places and skips unnamed ones', () => {
    const places = parseHalalResponse(SAMPLE);
    expect(places.map((p) => p.id)).toEqual(['osm:node/1', 'osm:way/2']);
    expect(places[0]).toMatchObject({
      name: 'Halal Grill',
      kind: 'restaurant',
      cuisine: 'turkish',
      halal: 'only',
      imageUrl: 'https://example.com/grill.jpg',
      website: 'https://grill.example',
      phone: '+1-212-555-0001',
    });
    expect(places[1].kind).toBe('cafe');
  });

  it('returns [] for malformed input', () => {
    expect(parseHalalResponse(null)).toEqual([]);
  });
});

describe('fetchHalalPlaces', () => {
  it('POSTs and returns parsed, capped results', async () => {
    const fetchMock: FetchLike = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => SAMPLE,
      text: async () => '',
    }));
    const places = await fetchHalalPlaces(NYC, { limit: 1 }, { fetch: fetchMock });
    expect(places).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
