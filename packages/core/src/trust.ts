/**
 * The trust ladder: how auto-extracted "candidate" times become trustworthy
 * through crowd confirmation, and how they go stale.
 *
 *   candidate ──(net confirms ≥ threshold)──▶ crowd-confirmed
 *       ▲                                          │
 *       └──────(net disputes ≥ threshold)──────────┘  (demote / reject)
 *
 *   mosque-verified sits above the crowd and is not demoted by votes.
 *
 * All functions are pure and immutable — they return new objects so the same
 * logic works in a React reducer, a backend handler, or a test.
 */
import type {
  ConfirmationEvent,
  MosqueTimes,
  TimeCandidate,
  TrustLevel,
} from './types.js';

export interface TrustPolicy {
  /** Net confirmations (confirms − disputes) to promote a candidate. */
  confirmThreshold: number;
  /** Net disputes (disputes − confirms) to reject/demote. */
  rejectThreshold: number;
  /**
   * Days after which crowd-confirmed times must be re-confirmed. Iqama times
   * drift seasonally (Maghrib tracks sunset), so confidence decays with age.
   */
  staleAfterDays: number;
}

export const DEFAULT_TRUST_POLICY: TrustPolicy = {
  confirmThreshold: 3,
  rejectThreshold: 3,
  staleAfterDays: 60,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Record a confirmation/dispute against a candidate and recompute its status.
 * Returns a new candidate; the input is not mutated.
 *
 * - `mosque-verified` candidates record votes but never change status.
 * - `candidate` → `crowd-confirmed` once net confirmations meet the threshold.
 * - `candidate`/`crowd-confirmed` → `rejected` once net disputes meet it.
 */
export function applyConfirmation(
  candidate: TimeCandidate,
  event: ConfirmationEvent,
  policy: TrustPolicy = DEFAULT_TRUST_POLICY,
): TimeCandidate {
  const at = event.at ?? new Date().toISOString();
  const confirms = candidate.confirms + (event.vote === 'confirm' ? 1 : 0);
  const disputes = candidate.disputes + (event.vote === 'dispute' ? 1 : 0);
  const lastConfirmedAt =
    event.vote === 'confirm' ? at : candidate.lastConfirmedAt;

  let status = candidate.status;
  if (status !== 'mosque-verified' && status !== 'rejected') {
    const net = confirms - disputes;
    if (disputes - confirms >= policy.rejectThreshold) {
      status = 'rejected';
    } else if (net >= policy.confirmThreshold) {
      status = 'crowd-confirmed';
    } else {
      // Not enough either way: a demoted crowd-confirmed falls back to candidate.
      status = 'candidate';
    }
  }

  const next: TimeCandidate = {
    ...candidate,
    confirms,
    disputes,
    status,
    times: {
      ...candidate.times,
      confirmations: confirms - disputes,
      ...(lastConfirmedAt ? { lastConfirmedAt } : {}),
    },
  };
  if (lastConfirmedAt) next.lastConfirmedAt = lastConfirmedAt;
  return next;
}

/** Promote a candidate to mosque-verified (e.g. after an imam claims it). */
export function markMosqueVerified(candidate: TimeCandidate): TimeCandidate {
  return {
    ...candidate,
    status: 'mosque-verified',
    times: { ...candidate.times, verified: true },
  };
}

/**
 * Whether crowd-confirmed times are stale and due for re-confirmation. Mosque-
 * verified times never go stale here (the mosque owns them). Times without a
 * confirmation timestamp fall back to `updatedAt`.
 */
export function isStale(
  times: Pick<MosqueTimes, 'lastConfirmedAt' | 'updatedAt' | 'verified'>,
  now: Date = new Date(),
  policy: TrustPolicy = DEFAULT_TRUST_POLICY,
): boolean {
  if (times.verified) return false;
  const ref = times.lastConfirmedAt ?? times.updatedAt;
  if (!ref) return true; // never confirmed → treat as stale
  const ageMs = now.getTime() - new Date(ref).getTime();
  return ageMs > policy.staleAfterDays * DAY_MS;
}

/** Map a candidate's status onto a user-facing trust level. */
export function trustLevelOf(candidate: TimeCandidate): TrustLevel {
  switch (candidate.status) {
    case 'mosque-verified':
      return 'mosque-verified';
    case 'crowd-confirmed':
      return 'crowd-confirmed';
    default:
      return 'unverified';
  }
}
