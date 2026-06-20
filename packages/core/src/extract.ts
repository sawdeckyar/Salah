/**
 * Extraction framework: turn a mosque web page into candidate `MosqueTimes`.
 *
 * Mosque sites are wildly heterogeneous, so extraction is layered: try the most
 * reliable method first (platform widget → structured HTML → PDF → LLM/vision)
 * and fall back. Each method is an `Extractor`. This module defines the
 * interface, a runner, and the time-normalization helpers extractors share.
 * Concrete extractors live in `./extractors/`.
 *
 * The network and any LLM calls live OUTSIDE the core — a host fetches the page
 * (or screenshots/PDFs) and feeds the content in. That keeps the core pure and
 * testable, and keeps model/provider choices at the edge.
 */
import type {
  ExtractionMethod,
  IqamaPrayer,
  JumuahService,
  MosqueTimes,
  Prayer,
  TimeCandidate,
} from './types.js';

export interface ExtractorInput {
  /** Raw page content (HTML or plain text). */
  content: string;
  contentType?: 'html' | 'text';
  /** Page URL, recorded as provenance. */
  url?: string;
}

export interface ExtractedTimes {
  times: MosqueTimes;
  /** Raw matched fragments, for debugging/audit. */
  raw?: Record<string, string>;
}

export interface Extractor {
  name: string;
  method: ExtractionMethod;
  /** Cheap check for whether this extractor is worth running on the input. */
  canHandle(input: ExtractorInput): boolean;
  /** Attempt extraction; return null if nothing usable was found. */
  extract(input: ExtractorInput): ExtractedTimes | null;
}

// ---------------------------------------------------------------------------
// Shared helpers (exported for reuse by extractors and for testing)
// ---------------------------------------------------------------------------

/** Strip HTML tags and decode the handful of entities that matter for times. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

export const PRAYER_KEYWORDS: Record<Prayer, RegExp> = {
  fajr: /\b(fajr|fajar|subh|sehri end|dawn)\b/i,
  sunrise: /\b(sunrise|shuruq|ishraq)\b/i,
  dhuhr: /\b(dhuhr|duhr|zuhr|zohar|dhuhar|luhar)\b/i,
  asr: /\b(asr|asar)\b/i,
  maghrib: /\b(maghrib|magrib|maghreb)\b/i,
  isha: /\b(isha|esha|ishaa|isha'a)\b/i,
};

const JUMUAH_KEYWORD = /\b(jumu['’]?ah|jumuah|jummah|jum['’]?a|friday|juma)\b/i;

const TIME_TOKEN = /\b(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?/gi;

/**
 * Normalize a clock token to 24-hour `HH:mm`. If no am/pm is present, infer it
 * from the prayer (Fajr → AM, the rest → PM), which is correct for the vast
 * majority of iqama timetables. Returns null for out-of-range values.
 */
export function normalizeTime(
  hourStr: string,
  minuteStr: string,
  meridiem: string | undefined,
  prayer?: Prayer,
): string | null {
  let h = Number.parseInt(hourStr, 10);
  const m = Number.parseInt(minuteStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m) || m > 59) return null;

  const mer = meridiem?.toLowerCase().replace(/\./g, '');
  if (mer === 'pm') {
    if (h < 12) h += 12;
  } else if (mer === 'am') {
    if (h === 12) h = 0;
  } else if (prayer) {
    // No meridiem: infer from the prayer's natural time of day.
    if (prayer === 'fajr' || prayer === 'sunrise') {
      if (h === 12) h = 0; // 12:xx at dawn means 00:xx
    } else if (h >= 1 && h <= 11) {
      h += 12; // afternoon/evening prayers
    }
  }
  if (h > 23 || h < 0) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Pull every clock token out of a string as raw [hour, minute, meridiem]. */
export function findTimeTokens(
  line: string,
): { hour: string; minute: string; meridiem?: string }[] {
  const out: { hour: string; minute: string; meridiem?: string }[] = [];
  for (const match of line.matchAll(TIME_TOKEN)) {
    out.push({ hour: match[1], minute: match[2], meridiem: match[3] });
  }
  return out;
}

export function isIqamaPrayer(p: Prayer): p is IqamaPrayer {
  return p !== 'sunrise';
}

export const JUMUAH_REGEX = JUMUAH_KEYWORD;

// ---------------------------------------------------------------------------
// Runner + candidate construction
// ---------------------------------------------------------------------------

/**
 * Run extractors in order and return the first usable result, or null. Order
 * matters: pass higher-precision extractors (widget → html → …) first.
 */
export function runExtractors(
  input: ExtractorInput,
  extractors: Extractor[],
): ExtractedTimes | null {
  for (const extractor of extractors) {
    if (!extractor.canHandle(input)) continue;
    const result = extractor.extract(input);
    if (result && hasAnyTimes(result.times)) return result;
  }
  return null;
}

function hasAnyTimes(times: MosqueTimes): boolean {
  const hasIqama = !!times.iqama && Object.keys(times.iqama).length > 0;
  const hasJumuah = !!times.jumuah && times.jumuah.length > 0;
  return hasIqama || hasJumuah;
}

/**
 * Wrap an extraction as a fresh `candidate` for the trust ladder. The host
 * supplies a unique `id` and the `mosqueId` it was extracted for.
 */
export function candidateFromExtraction(
  id: string,
  mosqueId: string,
  extracted: ExtractedTimes,
  now: Date = new Date(),
): TimeCandidate {
  return {
    id,
    mosqueId,
    times: extracted.times,
    status: 'candidate',
    createdAt: now.toISOString(),
    confirms: 0,
    disputes: 0,
  };
}

export type { JumuahService };
