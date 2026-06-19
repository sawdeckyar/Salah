import { describe, expect, it } from 'vitest';
import {
  buildRegistryIndex,
  mergeMosquesWithRegistry,
  validateMosqueTimes,
} from '../src/registry.js';
import type { Mosque, RegistryEntry } from '../src/types.js';

const origin = { latitude: 40.7128, longitude: -74.006 };

const osmMosques: Mosque[] = [
  {
    id: 'osm:node/1',
    source: 'osm',
    name: 'Masjid Manhattan',
    location: { latitude: 40.713, longitude: -74.0 },
  },
  {
    id: 'osm:way/2',
    source: 'osm',
    name: 'Downtown Islamic Center',
    location: { latitude: 40.72, longitude: -74.01 },
  },
];

const entries: RegistryEntry[] = [
  {
    id: 'e1',
    osmId: 'node/1',
    contact: { website: 'https://masjidmanhattan.test' },
    times: {
      iqama: { fajr: '05:30', dhuhr: '13:15', asr: '18:30' },
      jumuah: [{ label: 'First', khutbahTime: '13:00', language: 'English' }],
      verified: true,
    },
  },
  {
    // Standalone mosque OSM does not know about, near the origin.
    id: 'e2',
    name: 'Community Musalla',
    location: { latitude: 40.715, longitude: -74.003 },
    times: { iqama: { maghrib: '20:45' } },
  },
  {
    // Standalone mosque far away — should be excluded by radius.
    id: 'e3',
    name: 'Faraway Mosque',
    location: { latitude: 34.0522, longitude: -118.2437 },
    times: { iqama: { isha: '21:00' } },
  },
];

describe('buildRegistryIndex', () => {
  it('separates OSM-linked entries from standalone ones and normalizes ids', () => {
    const index = buildRegistryIndex(entries);
    expect(index.byOsmId.has('node/1')).toBe(true);
    expect(index.standalone.map((m) => m.name)).toEqual([
      'Community Musalla',
      'Faraway Mosque',
    ]);
  });

  it('normalizes assorted osmId formats', () => {
    const index = buildRegistryIndex([
      { id: 'a', osmId: 'osm:way/42', times: { iqama: { fajr: '05:00' } } },
      {
        id: 'b',
        osmId: 'https://www.openstreetmap.org/relation/99',
        times: { iqama: { fajr: '05:00' } },
      },
    ]);
    expect(index.byOsmId.has('way/42')).toBe(true);
    expect(index.byOsmId.has('relation/99')).toBe(true);
  });
});

describe('mergeMosquesWithRegistry', () => {
  it('overlays community times onto matching OSM mosques', () => {
    const index = buildRegistryIndex(entries);
    const merged = mergeMosquesWithRegistry(osmMosques, index);
    const manhattan = merged.find((m) => m.id === 'osm:node/1')!;
    expect(manhattan.source).toBe('merged');
    expect(manhattan.times?.iqama?.fajr).toBe('05:30');
    expect(manhattan.times?.jumuah?.[0].khutbahTime).toBe('13:00');
    expect(manhattan.contact?.website).toBe('https://masjidmanhattan.test');
  });

  it('includes nearby standalone mosques and sorts everything by distance', () => {
    const index = buildRegistryIndex(entries);
    const merged = mergeMosquesWithRegistry(osmMosques, index, origin);
    const ids = merged.map((m) => m.id);
    expect(ids).toContain('reg:e2'); // nearby standalone included
    expect(ids).not.toContain('reg:e3'); // far standalone excluded
    // Sorted ascending by distance.
    for (let i = 1; i < merged.length; i++) {
      expect(merged[i].distanceMeters!).toBeGreaterThanOrEqual(
        merged[i - 1].distanceMeters!,
      );
    }
  });

  it('leaves unmatched OSM mosques untouched', () => {
    const index = buildRegistryIndex(entries);
    const merged = mergeMosquesWithRegistry(osmMosques, index);
    const idc = merged.find((m) => m.id === 'osm:way/2')!;
    expect(idc.source).toBe('osm');
    expect(idc.times).toBeUndefined();
  });
});

describe('validateMosqueTimes', () => {
  it('accepts well-formed times', () => {
    expect(
      validateMosqueTimes({
        iqama: { fajr: '05:30' },
        jumuah: [{ khutbahTime: '13:00', iqamaTime: '13:10' }],
      }),
    ).toEqual([]);
  });

  it('rejects bad time formats and empty submissions', () => {
    expect(validateMosqueTimes({ iqama: { fajr: '5:30' } }).length).toBe(1);
    expect(validateMosqueTimes({ jumuah: [{ khutbahTime: '25:00' }] }).length)
      .toBe(1);
    expect(validateMosqueTimes({}).length).toBe(1);
  });
});
