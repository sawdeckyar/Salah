/**
 * TableExtractor — the first concrete extractor.
 *
 * Handles the common case of a prayer timetable rendered as an HTML table or
 * plain text: lines that pair a prayer name with one or more clock times, e.g.
 *
 *   Prayer    Begins   Iqama
 *   Fajr      5:12     5:30
 *   Dhuhr     1:05     1:15
 *   ...
 *   Jumu'ah            1:30, 2:30
 *
 * When a line has several times (begins + iqama columns), it keeps the LAST one
 * — the iqama/jama'ah time, which is what the registry wants. It is a heuristic,
 * not a parser for every site; lower-confidence and clearly attributed so the
 * crowd-confirmation layer can correct it.
 */
import {
  PRAYER_KEYWORDS,
  JUMUAH_REGEX,
  findTimeTokens,
  htmlToText,
  isIqamaPrayer,
  normalizeTime,
  type ExtractedTimes,
  type Extractor,
  type ExtractorInput,
} from '../extract.js';
import type {
  IqamaPrayer,
  JumuahService,
  MosqueTimes,
  Prayer,
} from '../types.js';

const ALL_PRAYERS = Object.keys(PRAYER_KEYWORDS) as Prayer[];

function toText(input: ExtractorInput): string {
  const looksLikeHtml =
    input.contentType === 'html' || /<\/?[a-z][\s\S]*>/i.test(input.content);
  return looksLikeHtml ? htmlToText(input.content) : input.content;
}

export const tableExtractor: Extractor = {
  name: 'table-parser@1',
  method: 'html',

  canHandle(input: ExtractorInput): boolean {
    const text = toText(input);
    const hasTime = /\b\d{1,2}:\d{2}\b/.test(text);
    const hasPrayer = ALL_PRAYERS.some((p) => PRAYER_KEYWORDS[p].test(text));
    return hasTime && hasPrayer;
  },

  extract(input: ExtractorInput): ExtractedTimes | null {
    const text = toText(input);
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const iqama: Partial<Record<IqamaPrayer, string>> = {};
    const raw: Record<string, string> = {};
    const jumuah: JumuahService[] = [];

    for (const line of lines) {
      // Daily prayers: a line naming exactly one prayer + at least one time.
      const named = ALL_PRAYERS.filter((p) => PRAYER_KEYWORDS[p].test(line));
      if (named.length === 1 && isIqamaPrayer(named[0])) {
        const prayer = named[0];
        const tokens = findTimeTokens(line);
        if (tokens.length > 0 && !(prayer in iqama)) {
          // Last time on the row = iqama column (begins comes first).
          const t = tokens[tokens.length - 1];
          const norm = normalizeTime(t.hour, t.minute, t.meridiem, prayer);
          if (norm) {
            iqama[prayer] = norm;
            raw[prayer] = line;
          }
        }
      }

      // Friday services: a line mentioning Jumu'ah → one slot per time on it.
      if (JUMUAH_REGEX.test(line)) {
        for (const t of findTimeTokens(line)) {
          const norm = normalizeTime(t.hour, t.minute, t.meridiem, 'dhuhr');
          if (norm) jumuah.push({ khutbahTime: norm });
        }
        if (jumuah.length) raw.jumuah = line;
      }
    }

    const times: MosqueTimes = {
      provenance: {
        method: 'html',
        extractor: tableExtractor.name,
        sourceUrl: input.url,
        confidence: scoreConfidence(iqama, jumuah),
        observedAt: new Date().toISOString(),
      },
    };
    if (Object.keys(iqama).length) times.iqama = iqama;
    if (jumuah.length) times.jumuah = dedupeJumuah(jumuah);

    if (!times.iqama && !times.jumuah) return null;
    return { times, raw };
  },
};

function scoreConfidence(
  iqama: Partial<Record<IqamaPrayer, string>>,
  jumuah: JumuahService[],
): number {
  // More prayers found → higher confidence, capped. Heuristic, deliberately
  // conservative so the crowd layer does the real trust-building.
  const found = Object.keys(iqama).length + (jumuah.length ? 1 : 0);
  return Math.min(0.8, 0.3 + found * 0.1);
}

function dedupeJumuah(services: JumuahService[]): JumuahService[] {
  const seen = new Set<string>();
  return services.filter((s) => {
    if (seen.has(s.khutbahTime)) return false;
    seen.add(s.khutbahTime);
    return true;
  });
}
