import { describe, expect, it, vi } from 'vitest';
import { geocodeCity, reverseGeocode } from '../src/geocoding.js';
import type { FetchLike } from '../src/http.js';

const searchPayload = [
  {
    place_id: 100,
    lat: '41.8781',
    lon: '-87.6298',
    display_name: 'Chicago, Cook County, Illinois, USA',
    address: { city: 'Chicago', country: 'United States' },
  },
];

describe('geocodeCity', () => {
  it('queries the search endpoint and maps results', async () => {
    const fetchMock: FetchLike = vi.fn(async (url) => {
      expect(url).toContain('/search?');
      expect(url).toContain('q=Chicago');
      return {
        ok: true,
        status: 200,
        json: async () => searchPayload,
        text: async () => '',
      };
    });
    const results = await geocodeCity('Chicago', {}, { fetch: fetchMock });
    expect(results).toHaveLength(1);
    expect(results[0].city).toBe('Chicago');
    expect(results[0].coordinates).toEqual({
      latitude: 41.8781,
      longitude: -87.6298,
    });
  });

  it('throws on a failed request', async () => {
    const fetchMock: FetchLike = async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => '',
    });
    await expect(
      geocodeCity('x', {}, { fetch: fetchMock }),
    ).rejects.toThrow(/500/);
  });
});

describe('reverseGeocode', () => {
  it('labels a coordinate', async () => {
    const fetchMock: FetchLike = async (url) => {
      expect(url).toContain('/reverse?');
      return {
        ok: true,
        status: 200,
        json: async () => searchPayload[0],
        text: async () => '',
      };
    };
    const result = await reverseGeocode(
      { latitude: 41.8781, longitude: -87.6298 },
      {},
      { fetch: fetchMock },
    );
    expect(result?.city).toBe('Chicago');
  });

  it('returns null for an error payload', async () => {
    const fetchMock: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ error: 'Unable to geocode' }),
      text: async () => '',
    });
    const result = await reverseGeocode(
      { latitude: 0, longitude: 0 },
      {},
      { fetch: fetchMock },
    );
    expect(result).toBeNull();
  });
});
