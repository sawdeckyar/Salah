/**
 * Musāfir (traveller) helper — informational qaṣr/jam‘ guidance.
 *
 * When travelling beyond the distance of a journey (commonly cited as ~77 km /
 * 48 mi) many travellers shorten (qaṣr) the 4-rak‘ah prayers to 2 and combine
 * (jam‘) Dhuhr+Asr and Maghrib+Isha. Exact rulings vary by madhab and situation,
 * so this module only surfaces the time WINDOWS in which a combined pair is
 * valid; it is guidance to display, not a fatwa.
 */
import type { PrayerTimesResult } from './types.js';

/** Prayers that are shortened to 2 rak‘ah under qaṣr. */
export const QASR_PRAYERS = ['dhuhr', 'asr', 'isha'] as const;

export interface CombineWindow {
  /** Earliest time the combined pair may be prayed. */
  start: Date;
  /** Latest time the combined pair may be prayed, if known. */
  end?: Date;
}

export interface MusafirInfo {
  qasrPrayers: readonly ('dhuhr' | 'asr' | 'isha')[];
  /** Dhuhr & Asr combined: from Dhuhr until Maghrib. */
  dhuhrAsr: CombineWindow;
  /** Maghrib & Isha combined: from Maghrib until the next Fajr (if provided). */
  maghribIsha: CombineWindow;
}

/**
 * Compute the combine windows for a day's prayer times.
 *
 * @param times     The day's computed prayer times.
 * @param nextFajr  Tomorrow's Fajr, used as the end of the Maghrib+Isha window.
 */
export function musafirInfo(
  times: PrayerTimesResult,
  nextFajr?: Date,
): MusafirInfo {
  return {
    qasrPrayers: QASR_PRAYERS,
    dhuhrAsr: { start: times.times.dhuhr, end: times.times.maghrib },
    maghribIsha: { start: times.times.maghrib, end: nextFajr },
  };
}
