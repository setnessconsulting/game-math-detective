/**
 * Math Detective — AI-tutor intervention seam (REQUIREMENTS §13.3, seam 5).
 *
 * v1 ships the deterministic rule ladder; an LLM adapter may bind the same
 * contract in-app later. Free-site builds contain zero network calls here.
 */
import type { GeneratedEvidence } from "./types";

export type HintLevel = 1 | 2 | 3 | 4;

export interface HintRequest {
  itemId: string;
  level: HintLevel;
  priorAttempts: number;
}

export interface HintResponse {
  level: HintLevel;
  source: "rule";
  text: string;
}

export function getHint(item: GeneratedEvidence, req: HintRequest): HintResponse {
  const key = `l${req.level}` as const;
  return { level: req.level, source: "rule", text: item.hints[key] };
}

/**
 * Auto-offer policy (MD-06 AC2): after 2 consecutive misses with no hint
 * taken, offer L1 once; a dismissal suppresses re-offers for the item.
 */
export function shouldAutoOfferHint(
  priorAttempts: number,
  hintsUsedCount: number,
  dismissedForThisItem: boolean,
): boolean {
  return priorAttempts >= 2 && hintsUsedCount === 0 && !dismissedForThisItem;
}

/**
 * L2 pre-teach flag (MD-06 AC3): an L4 reveal on one station opens the next
 * station with the strategy hint pre-offered (dismissible, never twice in
 * a row).
 */
export function nextStationPreTeach(hintsUsed: readonly number[]): boolean {
  return hintsUsed.includes(4);
}
