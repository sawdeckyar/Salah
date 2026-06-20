import type { RegistryEntry } from '@salah/core';

/**
 * Bundled sample of the community mosque-times registry, mirroring
 * `data/mosque-times.seed.json` at the repo root.
 *
 * ⚠️ ILLUSTRATIVE ONLY — these iqama/Jumu‘ah times are examples to exercise the
 * registry merge, not confirmed timetables. In production this array is replaced
 * by data fetched from the Supabase-backed registry (see docs/DATA_INGESTION.md).
 */
export const registrySeed: RegistryEntry[] = [
  {
    id: 'seed-iccny',
    osmId: 'way/24181972',
    name: 'Islamic Cultural Center of New York',
    city: 'New York',
    country: 'United States',
    contact: { website: 'https://www.iccny.org' },
    times: {
      iqama: {
        fajr: '06:00',
        dhuhr: '13:30',
        asr: '18:45',
        maghrib: '20:35',
        isha: '22:15',
      },
      jumuah: [
        { label: 'First', khutbahTime: '13:00', language: 'Arabic' },
        { label: 'Second', khutbahTime: '14:15', language: 'English' },
      ],
      notes: 'Maghrib iqama tracks sunset; confirm seasonally.',
      contributor: 'seed',
      verified: false,
    },
  },
  {
    id: 'seed-standalone-musalla',
    name: 'Midtown Community Musalla',
    location: { latitude: 40.7549, longitude: -73.984 },
    city: 'New York',
    country: 'United States',
    address: 'Example office building prayer room',
    times: {
      iqama: { dhuhr: '13:15', asr: '18:30' },
      jumuah: [{ label: 'Main', khutbahTime: '13:15', language: 'English' }],
      notes: 'Small prayer space not in OpenStreetMap — registry-only entry.',
      contributor: 'seed',
      verified: false,
    },
  },
];
