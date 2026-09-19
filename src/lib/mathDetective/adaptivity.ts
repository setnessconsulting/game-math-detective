/**
 * Math Detective — learner model seam (REQUIREMENTS §13.3, seam 4).
 *
 * Maps the placement signal {grade × third} onto difficulty tiers D1–D5
 * and applies bounded in-session adjustment from evidence outcomes.
 * Pure functions only; free site never persists any of it.
 */
import type { DifficultyTier, Third } from "./types";

export interface PlacementBand {
  grade: number;
  third: Third;
}

/** Locked mapping table — REQUIREMENTS §3. Enumerated exhaustively in tests. */
const TIER_MAP: Record<string, DifficultyTier> = {
  "1-early": "D1",
  "1-mid": "D1",
  "1-late": "D2",
  "2-early": "D2",
  "2-mid": "D2",
  "2-late": "D3",
  "3-early": "D3",
  "3-mid": "D3",
  "3-late": "D3",
  "4-early": "D3",
  "4-mid": "D3",
  "4-late": "D4",
  "5-early": "D4",
  "5-mid": "D4",
  "5-late": "D4",
  "6-early": "D4",
  "6-mid": "D4",
  "6-late": "D5",
  "7-early": "D5",
  "7-mid": "D5",
  "7-late": "D5",
  "8-early": "D5",
  "8-mid": "D5",
  "8-late": "D5",
};

/** Missing placement → default D2 with calibration-first content (A12). */
export function initialTier(band: PlacementBand | null | undefined): DifficultyTier {
  if (!band) return "D2";
  return TIER_MAP[`${band.grade}-${band.third}`] ?? "D2";
}

export interface EvidenceOutcome {
  /** Solved on the first attempt with no hints. */
  firstTryNoHint: boolean;
  /** Needed heavy support (L2+ hint or 3+ attempts or mash-flagged). */
  struggled: boolean;
}

const TIERS_ORDERED: DifficultyTier[] = ["D1", "D2", "D3", "D4", "D5"];

/**
 * Bounded adjustment: at most one tier step per session (REQUIREMENTS MD-05
 * AC2). Two strong solves in the last three nudge up; two struggles nudge
 * down. Manual rank override is enforced by callers, not here.
 */
export function adjustTier(
  current: { tier: DifficultyTier; sessionShift: number },
  recentOutcomes: readonly EvidenceOutcome[],
): { tier: DifficultyTier; sessionShift: number; reason: "flow" | "support" | "steady" } {
  const window = recentOutcomes.slice(-3);
  const good = window.filter((o) => o.firstTryNoHint).length;
  const rough = window.filter((o) => o.struggled).length;

  const idx = TIERS_ORDERED.indexOf(current.tier);

  if (good >= 2 && current.sessionShift < 1 && idx < TIERS_ORDERED.length - 1) {
    return { tier: TIERS_ORDERED[idx + 1]!, sessionShift: current.sessionShift + 1, reason: "flow" };
  }
  if (rough >= 2 && current.sessionShift > -1 && idx > 0) {
    return { tier: TIERS_ORDERED[idx - 1]!, sessionShift: current.sessionShift - 1, reason: "support" };
  }
  return { tier: current.tier, sessionShift: current.sessionShift, reason: "steady" };
}
