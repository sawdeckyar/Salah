import { describe, expect, it } from 'vitest';
import { calculatePrayerTimes } from '../src/prayerTimes.js';
import { musafirInfo, QASR_PRAYERS } from '../src/musafir.js';

const NYC = { latitude: 40.7128, longitude: -74.006 };

describe('musafirInfo', () => {
  const today = calculatePrayerTimes(NYC, new Date('2026-06-19T12:00:00Z'), {
    method: 'NorthAmerica',
  });
  const tomorrow = calculatePrayerTimes(NYC, new Date('2026-06-20T12:00:00Z'), {
    method: 'NorthAmerica',
  });

  it('lists the qasr prayers', () => {
    expect(QASR_PRAYERS).toEqual(['dhuhr', 'asr', 'isha']);
  });

  it('Dhuhr+Asr window runs from Dhuhr to Maghrib', () => {
    const info = musafirInfo(today);
    expect(info.dhuhrAsr.start).toEqual(today.times.dhuhr);
    expect(info.dhuhrAsr.end).toEqual(today.times.maghrib);
  });

  it('Maghrib+Isha window starts at Maghrib and ends at next Fajr when given', () => {
    const info = musafirInfo(today, tomorrow.times.fajr);
    expect(info.maghribIsha.start).toEqual(today.times.maghrib);
    expect(info.maghribIsha.end).toEqual(tomorrow.times.fajr);
    expect(info.maghribIsha.end!.getTime()).toBeGreaterThan(
      info.maghribIsha.start.getTime(),
    );
  });

  it('leaves Maghrib+Isha end undefined without next Fajr', () => {
    expect(musafirInfo(today).maghribIsha.end).toBeUndefined();
  });
});
