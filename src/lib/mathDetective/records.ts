/**
 * Math Detective — personal score records ("beat your best").
 *
 * In-memory session store ONLY on the free site (GAMES_PLAN hook policy +
 * repo privacy contract): nothing here persists data or leaves the tab.
 * In-app builds bind an account-scoped store behind these functions later.
 */
import type { DifficultyTier } from "./types";

export interface TierRecord {
  bestIndependence: number;
  casesCracked: number;
}

const EMPTY: Readonly<TierRecord> = { bestIndependence: 0, casesCracked: 0 };

// Module scope = dies with the tab. Intentional.
const store = new Map<DifficultyTier, TierRecord>();

export function getTierRecord(tier: DifficultyTier): TierRecord {
  return store.get(tier) ?? { ...EMPTY };
}

export interface OutcomeResult extends TierRecord {
  newBest: boolean;
}

export function recordOutcome(tier: DifficultyTier, independenceScore: number): OutcomeResult {
  const prev = getTierRecord(tier);
  const next: TierRecord = {
    bestIndependence: Math.max(prev.bestIndependence, independenceScore),
    casesCracked: prev.casesCracked + 1,
  };
  store.set(tier, next);
  return { ...next, newBest: independenceScore > prev.bestIndependence };
}

/** Test hook: wipe session memory. */
export function resetRecordsForTests(): void {
  store.clear();
}
