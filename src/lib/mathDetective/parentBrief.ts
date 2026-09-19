/**
 * Math Detective — parent-brief itemization contract (REQUIREMENTS §11,
 * story MD-11). Builds one per-case brief row from the engine summary and
 * slots.
 *
 * The row is the account-side rendering seam: the free site never persists
 * or transmits it; an in-app build can bind this structure to the parent
 * brief later without engine changes. Fields stay aggregate — no answer
 * text, no identifiers, no free-text capture.
 */
import type { CaseSummaryModel, SlotState } from "./engine";

export interface ParentBriefRow {
  /** Human game label, e.g. "Games — Math Detective". */
  gameLabel: string;
  tierRank: string;
  mode: "mini" | "full";
  /** Human skill labels from the registry (parent-readable). */
  skills: string[];
  evidenceAttempted: number;
  evidenceCorrect: number;
  hintsByLevel: { l1: number; l2: number; l3: number; l4: number };
  accusationAttempts: number;
  independenceScore: number;
  /** Teaching-tone coaching sentence (never shaming). */
  coaching: string;
  /** Set when the case was completed reveal-heavy (§11 honesty rule). */
  honestyNote: string | null;
}

export const REVEAL_HEAVY_NOTE =
  "Solved with step-by-step reveals \u2014 ready for a slightly easier case next time.";

export interface ParentBriefArgs {
  tierRank: string;
  mode: "mini" | "full";
  summary: CaseSummaryModel;
  accusationAttempts: number;
  slots: readonly SlotState[];
}

export function buildParentBriefRow(args: ParentBriefArgs): ParentBriefRow {
  const { summary } = args;
  const hintsByLevel = { l1: 0, l2: 0, l3: 0, l4: 0 };
  for (const slot of args.slots) {
    for (const level of slot.hintsUsed) {
      if (level === 1) hintsByLevel.l1 += 1;
      else if (level === 2) hintsByLevel.l2 += 1;
      else if (level === 3) hintsByLevel.l3 += 1;
      else if (level === 4) hintsByLevel.l4 += 1;
    }
  }
  return {
    gameLabel: "Games \u2014 Math Detective",
    tierRank: args.tierRank,
    mode: args.mode,
    skills: summary.skills,
    evidenceAttempted: summary.evidenceTotal,
    evidenceCorrect: summary.evidenceSolved,
    hintsByLevel,
    accusationAttempts: args.accusationAttempts,
    independenceScore: summary.independenceScore,
    coaching: summary.coaching,
    honestyNote: summary.l4SharePct > 60 ? REVEAL_HEAVY_NOTE : null,
  };
}
