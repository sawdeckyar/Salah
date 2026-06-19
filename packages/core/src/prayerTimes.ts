/**
 * Astronomical prayer-time calculation, wrapping the `adhan` library behind a
 * small, typed, dependency-free-feeling surface.
 *
 * These are the *adhan* (call-to-prayer) times, computed from latitude,
 * longitude, date and a calculation method. They are deterministic and work
 * fully offline — no network required. Mosque-specific *iqama* times come from
 * the community registry instead (see registry.ts).
 */
import * as adhan from 'adhan';
import {
  DAILY_PRAYERS,
  type CalculationMethodName,
  type Coordinates,
  type Madhab,
  type Prayer,
  type PrayerCalculationOptions,
  type PrayerStatus,
  type PrayerTimesResult,
} from './types.js';

const METHOD_FACTORIES: Record<CalculationMethodName, () => adhan.CalculationParameters> = {
  MuslimWorldLeague: adhan.CalculationMethod.MuslimWorldLeague,
  NorthAmerica: adhan.CalculationMethod.NorthAmerica,
  Egyptian: adhan.CalculationMethod.Egyptian,
  Karachi: adhan.CalculationMethod.Karachi,
  UmmAlQura: adhan.CalculationMethod.UmmAlQura,
  Dubai: adhan.CalculationMethod.Dubai,
  Qatar: adhan.CalculationMethod.Qatar,
  Kuwait: adhan.CalculationMethod.Kuwait,
  MoonsightingCommittee: adhan.CalculationMethod.MoonsightingCommittee,
  Singapore: adhan.CalculationMethod.Singapore,
  Turkey: adhan.CalculationMethod.Turkey,
  Tehran: adhan.CalculationMethod.Tehran,
};

const DEFAULT_METHOD: CalculationMethodName = 'MuslimWorldLeague';
const DEFAULT_MADHAB: Madhab = 'shafi';

function buildParams(opts: PrayerCalculationOptions): adhan.CalculationParameters {
  const method = opts.method ?? DEFAULT_METHOD;
  const factory = METHOD_FACTORIES[method];
  if (!factory) {
    throw new Error(`Unknown calculation method: ${method}`);
  }
  const params = factory();
  params.madhab =
    (opts.madhab ?? DEFAULT_MADHAB) === 'hanafi'
      ? adhan.Madhab.Hanafi
      : adhan.Madhab.Shafi;

  if (opts.highLatitudeRule) {
    params.highLatitudeRule = opts.highLatitudeRule;
  }
  if (opts.adjustments) {
    for (const [prayer, minutes] of Object.entries(opts.adjustments)) {
      if (typeof minutes === 'number') {
        params.adjustments[prayer as Prayer] = minutes;
      }
    }
  }
  return params;
}

function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Compute the day's prayer times for a location.
 *
 * @param coordinates  Where to compute for.
 * @param date         Any instant on the target calendar day (defaults to now).
 * @param options      Calculation method, madhab, adjustments.
 */
export function calculatePrayerTimes(
  coordinates: Coordinates,
  date: Date = new Date(),
  options: PrayerCalculationOptions = {},
): PrayerTimesResult {
  const params = buildParams(options);
  const coords = new adhan.Coordinates(
    coordinates.latitude,
    coordinates.longitude,
  );
  const pt = new adhan.PrayerTimes(coords, date, params);

  const times = {
    fajr: pt.fajr,
    sunrise: pt.sunrise,
    dhuhr: pt.dhuhr,
    asr: pt.asr,
    maghrib: pt.maghrib,
    isha: pt.isha,
  } as Record<Prayer, Date>;

  return {
    date: localDateString(date),
    coordinates,
    method: options.method ?? DEFAULT_METHOD,
    madhab: options.madhab ?? DEFAULT_MADHAB,
    times,
  };
}

/**
 * Determine the current and next prayer relative to `now`, spanning the day
 * boundary (after Isha, the next prayer is tomorrow's Fajr).
 */
export function getPrayerStatus(
  coordinates: Coordinates,
  now: Date = new Date(),
  options: PrayerCalculationOptions = {},
): PrayerStatus {
  const params = buildParams(options);
  const coords = new adhan.Coordinates(
    coordinates.latitude,
    coordinates.longitude,
  );
  const today = new adhan.PrayerTimes(coords, now, params);

  const currentRaw = today.currentPrayer(now) as Prayer | 'none';
  let nextRaw = today.nextPrayer(now) as Prayer | 'none';
  let nextTime: Date | null =
    nextRaw === 'none' ? null : today.timeForPrayer(nextRaw);

  // After Isha, `nextPrayer` returns 'none' — roll over to tomorrow's Fajr.
  if (nextRaw === 'none' || nextTime === null) {
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const next = new adhan.PrayerTimes(coords, tomorrow, params);
    nextRaw = 'fajr';
    nextTime = next.fajr;
  }

  const minutesToNext =
    nextTime === null
      ? null
      : Math.max(0, Math.round((nextTime.getTime() - now.getTime()) / 60000));

  return {
    current: currentRaw,
    next: nextRaw,
    nextTime,
    minutesToNext,
  };
}

/** Ordered list of prayers as `[name, time]` pairs for easy rendering. */
export function asEntries(result: PrayerTimesResult): [Prayer, Date][] {
  return DAILY_PRAYERS.map((p) => [p, result.times[p]]);
}
