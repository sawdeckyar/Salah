import { describe, expect, it, vi } from 'vitest';
import {
  buildOverpassQuery,
  elementToMosque,
  fetchNearbyMosques,
  parseOverpassResponse,
} from '../src/osm.js';
import type { FetchLike } from '../src/http.js';

const NYC = { latitude: 40.7128, longitude: -74.006 };

const SAMPLE = {
  elements: [
    {
      type: 'node',
      id: 1,
      lat: 40.713,
      lon: -74.0,
      tags: {
        name: 'Masjid Manhattan',
        'addr:housenumber': '12',
        'addr:street': 'Warren St',
        'addr:city': 'New York',
        'contact:phone': '+1-212-000-0000',
        website: 'https://example.org',
      },
    },
    {
      type: 'way',
      id: 2,
      center: { lat: 40.72, lon: -74.01 },
      tags: { 'name:en': 'Downtown Islamic Center' },
    },
    {
      // Missing coordinates → skipped.
      type: 'relation',
      id: 3,
      tags: { name: 'Ghost Mosque' },
    },
  ],
};

describe('buildOverpassQuery', () => {
  it('targets muslim places of worship with an around filter', () => {
    const q = buildOverpassQuery(NYC, 3000);
    expect(q).toContain('"religion"="muslim"');
    expect(q).toContain('"amenity"="place_of_worship"');
    expect(q).toContain('around:3000,40.7128,-74.006');
    expect(q).toContain('out center tags;');
  });
});

describe('elementToMosque', () => {
  it('maps tags into a structured mosque', () => {
    const m = elementToMosque(SAMPLE.elements[0] as never)!;
    expect(m.id).toBe('osm:node/1');
    expect(m.source).toBe('osm');
    expect(m.name).toBe('Masjid Manhattan');
    expect(m.address).toBe('12 Warren St, New York');
    expect(m.contact?.phone).toBe('+1-212-000-0000');
    expect(m.contact?.website).toBe('https://example.org');
  });

  it('falls back to name:en and returns null without coordinates', () => {
    expect(elementToMosque(SAMPLE.elements[1] as never)!.name).toBe(
      'Downtown Islamic Center',
    );
    expect(elementToMosque(SAMPLE.elements[2] as never)).toBeNull();
  });
});

describe('parseOverpassResponse', () => {
  it('parses valid elements and skips unusable ones', () => {
    const mosques = parseOverpassResponse(SAMPLE);
    expect(mosques.map((m) => m.id)).toEqual(['osm:node/1', 'osm:way/2']);
  });

  it('returns [] for malformed payloads', () => {
    expect(parseOverpassResponse(null)).toEqual([]);
    expect(parseOverpassResponse({})).toEqual([]);
  });
});

describe('fetchNearbyMosques', () => {
  it('POSTs the query and returns parsed, capped results', async () => {
    const fetchMock: FetchLike = vi.fn(async (url, init) => {
      expect(url).toContain('/api/interpreter');
      expect(init?.method).toBe('POST');
      expect(init?.body).toContain('data=');
      return {
        ok: true,
        status: 200,
        json: async () => SAMPLE,
        text: async () => JSON.stringify(SAMPLE),
      };
    });

    const result = await fetchNearbyMosques(
      NYC,
      { endpoint: 'https://overpass.test/api/interpreter', limit: 1 },
      { fetch: fetchMock },
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('osm:node/1');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('throws on a non-ok response', async () => {
    const fetchMock: FetchLike = async () => ({
      ok: false,
      status: 504,
      json: async () => ({}),
      text: async () => '',
    });
    await expect(
      fetchNearbyMosques(NYC, {}, { fetch: fetchMock }),
    ).rejects.toThrow(/504/);
  });
});
