import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRUST_POLICY,
  applyConfirmation,
  isStale,
  markMosqueVerified,
  trustLevelOf,
} from '../src/trust.js';
import type { TimeCandidate } from '../src/types.js';

function makeCandidate(overrides: Partial<TimeCandidate> = {}): TimeCandidate {
  return {
    id: 'c1',
    mosqueId: 'osm:node/1',
    times: { iqama: { fajr: '05:30' }, provenance: { method: 'html' } },
    status: 'candidate',
    createdAt: '2026-06-01T00:00:00Z',
    confirms: 0,
    disputes: 0,
    ...overrides,
  };
}

describe('applyConfirmation', () => {
  it('promotes a candidate to crowd-confirmed at the threshold', () => {
    let c = makeCandidate();
    for (let i = 0; i < DEFAULT_TRUST_POLICY.confirmThreshold; i++) {
      c = applyConfirmation(c, { vote: 'confirm', at: '2026-06-10T00:00:00Z' });
    }
    expect(c.status).toBe('crowd-confirmed');
    expect(c.confirms).toBe(3);
    expect(c.times.confirmations).toBe(3);
    expect(c.lastConfirmedAt).toBe('2026-06-10T00:00:00Z');
    expect(trustLevelOf(c)).toBe('crowd-confirmed');
  });

  it('does not mutate the input candidate', () => {
    const original = makeCandidate();
    const next = applyConfirmation(original, { vote: 'confirm' });
    expect(original.confirms).toBe(0);
    expect(next.confirms).toBe(1);
  });

  it('rejects a candidate once disputes dominate', () => {
    let c = makeCandidate();
    for (let i = 0; i < DEFAULT_TRUST_POLICY.rejectThreshold; i++) {
      c = applyConfirmation(c, { vote: 'dispute' });
    }
    expect(c.status).toBe('rejected');
    expect(trustLevelOf(c)).toBe('unverified');
  });

  it('does not change the status of mosque-verified times on a vote', () => {
    const verified = markMosqueVerified(makeCandidate());
    const after = applyConfirmation(verified, { vote: 'dispute' });
    expect(after.status).toBe('mosque-verified');
    expect(after.disputes).toBe(1);
  });
});

describe('markMosqueVerified', () => {
  it('sets the verified flag and top trust level', () => {
    const c = markMosqueVerified(makeCandidate());
    expect(c.status).toBe('mosque-verified');
    expect(c.times.verified).toBe(true);
    expect(trustLevelOf(c)).toBe('mosque-verified');
  });
});

describe('isStale', () => {
  const now = new Date('2026-06-20T00:00:00Z');

  it('treats never-confirmed times as stale', () => {
    expect(isStale({}, now)).toBe(true);
  });

  it('is false within the freshness window and true beyond it', () => {
    expect(
      isStale({ lastConfirmedAt: '2026-06-01T00:00:00Z' }, now),
    ).toBe(false);
    expect(
      isStale({ lastConfirmedAt: '2026-01-01T00:00:00Z' }, now),
    ).toBe(true);
  });

  it('never marks mosque-verified times stale', () => {
    expect(
      isStale({ verified: true, updatedAt: '2020-01-01T00:00:00Z' }, now),
    ).toBe(false);
  });
});
