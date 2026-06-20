/**
 * Shared domain types for the Salah core engine.
 *
 * These types are deliberately platform-agnostic (no React, no DOM, no
 * Node-specific globals) so the same logic powers a React Native app, a web
 * PWA, or a backend service without modification.
 */

/** A geographic point in decimal degrees (WGS-84). */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** The five obligatory daily prayers plus sunrise (end of Fajr window). */
export type Prayer = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

/** Prayers that have a congregational (iqama / jamā‘ah) time. Sunrise excluded. */
export type IqamaPrayer = Exclude<Prayer, 'sunrise'>;

export const DAILY_PRAYERS: Prayer[] = [
  'fajr',
  'sunrise',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
];

export const IQAMA_PRAYERS: IqamaPrayer[] = [
  'fajr',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
];

/**
 * Supported astronomical calculation methods. These map 1:1 onto the
 * `adhan` library's CalculationMethod factories.
 */
export type CalculationMethodName =
  | 'MuslimWorldLeague'
  | 'NorthAmerica'
  | 'Egyptian'
  | 'Karachi'
  | 'UmmAlQura'
  | 'Dubai'
  | 'Qatar'
  | 'Kuwait'
  | 'MoonsightingCommittee'
  | 'Singapore'
  | 'Turkey'
  | 'Tehran';

/** Juristic school affecting the Asr time calculation. */
export type Madhab = 'shafi' | 'hanafi';

/** High-latitude twilight resolution rule (relevant above ~48° latitude). */
export type HighLatitudeRule =
  | 'middleofthenight'
  | 'seventhofthenight'
  | 'twilightangle';

export interface PrayerCalculationOptions {
  method?: CalculationMethodName;
  madhab?: Madhab;
  highLatitudeRule?: HighLatitudeRule;
  /** Per-prayer fine-tuning in minutes (e.g. { fajr: -2, isha: 3 }). */
  adjustments?: Partial<Record<Prayer, number>>;
}

/** Computed astronomical (adhan) times for a single day at one location. */
export interface PrayerTimesResult {
  /** Local calendar date the times were computed for, as `YYYY-MM-DD`. */
  date: string;
  coordinates: Coordinates;
  method: CalculationMethodName;
  madhab: Madhab;
  /** Each prayer's instant as an absolute `Date` (UTC instant). */
  times: Record<Prayer, Date>;
}

/** The "current" and "next" prayer relative to a moment in time. */
export interface PrayerStatus {
  current: Prayer | 'none';
  next: Prayer | 'none';
  /** Absolute time of the next prayer, if any. */
  nextTime: Date | null;
  /** Whole minutes until the next prayer (>= 0), or null. */
  minutesToNext: number | null;
}

// ---------------------------------------------------------------------------
// Mosque + community time registry
// ---------------------------------------------------------------------------

export type MosqueSource = 'osm' | 'registry' | 'merged';

/** A Friday (Jumu‘ah) congregation slot. Mosques may host several. */
export interface JumuahService {
  /** e.g. "First Jumu‘ah", "Early", "Main". */
  label?: string;
  /** Khutbah start, local wall-clock `HH:mm` (24h). */
  khutbahTime: string;
  /** Optional iqama time if separate from khutbah start. */
  iqamaTime?: string;
  /** Language of the khutbah, e.g. "English", "Arabic", "Urdu". */
  language?: string;
}

/**
 * Community-maintained, mosque-specific congregation times — the data that is
 * otherwise scattered across individual mosque websites. Times are local
 * wall-clock strings ("HH:mm", 24h) because iqama is set by the mosque, not
 * computed astronomically.
 */
export interface MosqueTimes {
  /** Congregational iqama times by prayer. */
  iqama?: Partial<Record<IqamaPrayer, string>>;
  /** One or more Friday services. */
  jumuah?: JumuahService[];
  notes?: string;
  /** ISO-8601 timestamp of the last community update. */
  updatedAt?: string;
  /** Attribution / who submitted the times. */
  contributor?: string;
  /** Whether a maintainer or the mosque has confirmed the times. */
  verified?: boolean;
  /** Where these times came from and how (see DATA_INGESTION.md). */
  provenance?: TimeProvenance;
  /** Net community confirmations (positive minus disputes). */
  confirmations?: number;
  /** ISO-8601 timestamp of the most recent positive confirmation. */
  lastConfirmedAt?: string;
}

// ---------------------------------------------------------------------------
// Provenance, candidates, and the trust ladder (data ingestion)
// ---------------------------------------------------------------------------

/**
 * How a set of times was obtained, in rough order of trustworthiness:
 *  - `widget`       structured data from a detected mosque-platform embed
 *  - `html`         parsed from an HTML table / structured markup
 *  - `pdf`          parsed from a PDF timetable
 *  - `llm`          extracted from free-text / images by a language/vision model
 *  - `crowd`        submitted directly by a community user
 *  - `mosque-admin` entered/verified by the mosque itself (highest trust)
 */
export type ExtractionMethod =
  | 'widget'
  | 'html'
  | 'pdf'
  | 'llm'
  | 'crowd'
  | 'mosque-admin';

/** Audit trail for a set of extracted/submitted times. */
export interface TimeProvenance {
  method: ExtractionMethod;
  /** Origin: a page URL, or `user:<id>` for crowd submissions. */
  sourceUrl?: string;
  /** Extractor/model identifier, e.g. `table-parser@1`, `claude-vision`. */
  extractor?: string;
  /** Extractor confidence in [0, 1]. */
  confidence?: number;
  /** ISO-8601 timestamp the source was fetched/observed. */
  observedAt?: string;
}

/** Position on the trust ladder for a candidate set of times. */
export type CandidateStatus =
  | 'candidate'
  | 'crowd-confirmed'
  | 'mosque-verified'
  | 'rejected';

/** A single user vote on a candidate's correctness. */
export interface ConfirmationEvent {
  vote: 'confirm' | 'dispute';
  /** Opaque user id, for dedupe/weighting. Optional. */
  userId?: string;
  /** ISO-8601 timestamp of the vote. Defaults to now when omitted. */
  at?: string;
}

/**
 * A proposed set of times for a mosque, moving up the trust ladder as the crowd
 * confirms it. Auto-extracted times enter as `candidate`; the mosque registry
 * surfaces the best candidate per mosque.
 */
export interface TimeCandidate {
  id: string;
  /** Mosque this candidate is for, e.g. `osm:node/123` or `reg:<id>`. */
  mosqueId: string;
  /** The proposed times (carrying their own provenance). */
  times: MosqueTimes;
  status: CandidateStatus;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  confirms: number;
  disputes: number;
  /** ISO-8601 timestamp of the most recent positive confirmation. */
  lastConfirmedAt?: string;
}

/** Human-facing trust level derived from a set of times. */
export type TrustLevel = 'unverified' | 'crowd-confirmed' | 'mosque-verified';

/** A mosque, from OSM, the registry, or a merge of both. */
export interface Mosque {
  /** Canonical id, e.g. `osm:node/123456` or `reg:uuid`. */
  id: string;
  source: MosqueSource;
  name: string;
  location: Coordinates;
  address?: string;
  city?: string;
  country?: string;
  contact?: {
    phone?: string;
    website?: string;
    email?: string;
  };
  /** Straight-line distance from the search origin, when applicable. */
  distanceMeters?: number;
  /** Community-provided congregation times, when known. */
  times?: MosqueTimes;
}

/**
 * A registry entry links community times to a mosque. It either references an
 * existing OSM feature (via `osmId`) or defines a standalone mosque (via
 * `location`) that OSM does not yet have.
 */
export interface RegistryEntry {
  /** Stable registry id. */
  id: string;
  /** OSM reference this entry annotates, e.g. `node/123456`. Optional. */
  osmId?: string;
  /** Required when there is no `osmId`: a self-contained mosque record. */
  name?: string;
  location?: Coordinates;
  address?: string;
  city?: string;
  country?: string;
  contact?: Mosque['contact'];
  times: MosqueTimes;
}

// ---------------------------------------------------------------------------
// Geocoding
// ---------------------------------------------------------------------------

export interface GeocodeResult {
  displayName: string;
  coordinates: Coordinates;
  city?: string;
  country?: string;
  /** Provider-specific identifier (e.g. Nominatim place_id). */
  providerId?: string;
}
