import { describe, expect, it } from 'vitest';
import {
  candidateFromExtraction,
  normalizeTime,
  runExtractors,
} from '../src/extract.js';
import { tableExtractor } from '../src/extractors/tableExtractor.js';

const HTML_TABLE = `
<table>
  <tr><th>Prayer</th><th>Begins</th><th>Iqama</th></tr>
  <tr><td>Fajr</td><td>5:12</td><td>5:30</td></tr>
  <tr><td>Dhuhr</td><td>1:05</td><td>1:15</td></tr>
  <tr><td>Asr</td><td>6:20</td><td>6:45</td></tr>
  <tr><td>Maghrib</td><td>8:31</td><td>8:35</td></tr>
  <tr><td>Isha</td><td>10:00</td><td>10:15</td></tr>
</table>
<p>Jumu'ah: 1:30 and 2:30</p>
`;

describe('normalizeTime', () => {
  it('converts 12h with meridiem to 24h', () => {
    expect(normalizeTime('1', '15', 'pm')).toBe('13:15');
    expect(normalizeTime('12', '00', 'am')).toBe('00:00');
    expect(normalizeTime('12', '30', 'pm')).toBe('12:30');
  });

  it('infers meridiem from the prayer when none is given', () => {
    expect(normalizeTime('5', '30', undefined, 'fajr')).toBe('05:30');
    expect(normalizeTime('1', '15', undefined, 'dhuhr')).toBe('13:15');
    expect(normalizeTime('6', '45', undefined, 'asr')).toBe('18:45');
  });

  it('rejects impossible values', () => {
    expect(normalizeTime('25', '00', undefined)).toBeNull();
    expect(normalizeTime('10', '75', undefined)).toBeNull();
  });
});

describe('tableExtractor', () => {
  it('handles pages with a prayer name and a time', () => {
    expect(
      tableExtractor.canHandle({ content: HTML_TABLE, contentType: 'html' }),
    ).toBe(true);
    expect(tableExtractor.canHandle({ content: 'no times here' })).toBe(false);
  });

  it('extracts iqama times (the last column) and Jumu’ah slots', () => {
    const result = tableExtractor.extract({
      content: HTML_TABLE,
      contentType: 'html',
      url: 'https://masjid.example/timetable',
    })!;
    expect(result.times.iqama).toEqual({
      fajr: '05:30',
      dhuhr: '13:15',
      asr: '18:45',
      maghrib: '20:35',
      isha: '22:15',
    });
    expect(result.times.jumuah?.map((j) => j.khutbahTime)).toEqual([
      '13:30',
      '14:30',
    ]);
    expect(result.times.provenance?.method).toBe('html');
    expect(result.times.provenance?.extractor).toBe('table-parser@1');
    expect(result.times.provenance?.sourceUrl).toBe(
      'https://masjid.example/timetable',
    );
    expect(result.times.provenance?.confidence).toBeGreaterThan(0.5);
  });

  it('returns null when no times are present', () => {
    expect(
      tableExtractor.extract({ content: 'Welcome to our masjid' }),
    ).toBeNull();
  });
});

describe('runExtractors + candidateFromExtraction', () => {
  it('returns the first usable extraction and wraps it as a candidate', () => {
    const extracted = runExtractors(
      { content: HTML_TABLE, contentType: 'html' },
      [tableExtractor],
    )!;
    expect(extracted).not.toBeNull();

    const candidate = candidateFromExtraction(
      'cand-1',
      'osm:node/1',
      extracted,
      new Date('2026-06-19T00:00:00Z'),
    );
    expect(candidate.status).toBe('candidate');
    expect(candidate.mosqueId).toBe('osm:node/1');
    expect(candidate.confirms).toBe(0);
    expect(candidate.disputes).toBe(0);
    expect(candidate.times.iqama?.fajr).toBe('05:30');
  });

  it('returns null when no extractor produces times', () => {
    expect(runExtractors({ content: 'nothing' }, [tableExtractor])).toBeNull();
  });
});
