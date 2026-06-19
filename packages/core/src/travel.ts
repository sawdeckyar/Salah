/**
 * Journey prayer planning — the "driving between cities" use case.
 *
 * Given a sampled route (a list of coordinate + estimated-time points, e.g.
 * from a routing engine or a few manual waypoints), this works out, for each
 * obligatory prayer, *roughly where you'll be when it comes in* and *what time
 * it is there*. The app then offers to find mosques near that spot so the
 * traveller can plan a stop.
 *
 * This is intentionally a transparent heuristic, not a routing engine: prayer
 * times shift with longitude/latitude, so we evaluate each prayer at every
 * route sample and pick the sample whose local prayer time best lines up with
 * when you're actually there.
 */
import { calculatePrayerTimes } from './prayerTimes.js';
import {
  IQAMA_PRAYERS,
  type Coordinates,
  type IqamaPrayer,
  type PrayerCalculationOptions,
} from './types.js';

/** A point along the planned route with an estimated time of being there. */
export interface JourneySample {
  coordinates: Coordinates;
  timeUtc: Date;
  /** Optional human label, e.g. a city or waypoint name. */
  label?: string;
}

export type PrayerJourneyStatus =
  | 'during-journey'
  | 'before-journey'
  | 'after-journey';

export interface JourneyPrayerPlan {
  prayer: IqamaPrayer;
  /** Absolute time of the prayer at the estimated location. */
  time: Date;
  /** Where you are estimated to be when the prayer comes in. */
  coordinates: Coordinates;
  label?: string;
  status: PrayerJourneyStatus;
}

function bestSampleForPrayer(
  prayer: IqamaPrayer,
  samples: JourneySample[],
  options: PrayerCalculationOptions,
): { time: Date; sample: JourneySample } {
  const window = {
    start: samples[0].timeUtc.getTime(),
    end: samples[samples.length - 1].timeUtc.getTime(),
  };

  const candidates = samples.map((sample) => {
    const time = calculatePrayerTimes(
      sample.coordinates,
      sample.timeUtc,
      options,
    ).times[prayer];
    return {
      sample,
      time,
      // How well the prayer's instant lines up with being at this sample.
      misalignment: Math.abs(time.getTime() - sample.timeUtc.getTime()),
      inWindow:
        time.getTime() >= window.start && time.getTime() <= window.end,
    };
  });

  const inWindow = candidates.filter((c) => c.inWindow);
  const pool = inWindow.length > 0 ? inWindow : candidates;
  pool.sort((a, b) => a.misalignment - b.misalignment);
  return { time: pool[0].time, sample: pool[0].sample };
}

/**
 * Plan the five obligatory prayers across a journey.
 *
 * @param samples  Route points, each with an ETA (`timeUtc`). Need at least
 *                 one; two or more (origin + destination, plus any stops)
 *                 gives a meaningful "during journey" window.
 * @param options  Calculation method / madhab applied at every location.
 */
export function planJourneyPrayers(
  samples: JourneySample[],
  options: PrayerCalculationOptions = {},
): JourneyPrayerPlan[] {
  if (samples.length === 0) {
    throw new Error('planJourneyPrayers requires at least one journey sample.');
  }
  const sorted = [...samples].sort(
    (a, b) => a.timeUtc.getTime() - b.timeUtc.getTime(),
  );
  const start = sorted[0].timeUtc.getTime();
  const end = sorted[sorted.length - 1].timeUtc.getTime();

  return IQAMA_PRAYERS.map((prayer) => {
    const { time, sample } = bestSampleForPrayer(prayer, sorted, options);
    const t = time.getTime();
    const status: PrayerJourneyStatus =
      t < start ? 'before-journey' : t > end ? 'after-journey' : 'during-journey';
    return {
      prayer,
      time,
      coordinates: sample.coordinates,
      label: sample.label,
      status,
    };
  });
}

/** Convenience: only the prayers that fall during the journey itself. */
export function prayersDuringJourney(
  samples: JourneySample[],
  options: PrayerCalculationOptions = {},
): JourneyPrayerPlan[] {
  return planJourneyPrayers(samples, options).filter(
    (p) => p.status === 'during-journey',
  );
}
