/**
 * Math Detective — seam-contract types (REQUIREMENTS §13.3).
 *
 * Generation output is pure data: rendering, scoring, hints, and the
 * engine consume payloads only. New stations never require engine edits.
 */

// ---------------------------------------------------------------------------
// Tiers & skills
// ---------------------------------------------------------------------------

export type DifficultyTier = "D1" | "D2" | "D3" | "D4" | "D5";

export type SkillId =
  | "measure-length"
  | "time-elapsed"
  | "data-tables"
  | "money-receipts"
  | "fractions-parts"
  | "grid-coordinates"
  | "expressions-codes"
  | "ratio-proportion"
  | "stats-summary"
  | "probability-claims";

export type CaseMode = "mini" | "full";

/** Placement third reused conceptually from assessment (early/mid/late). */
export type Third = "early" | "mid" | "late";

// ---------------------------------------------------------------------------
// Suspects
// ---------------------------------------------------------------------------

/**
 * Unified attribute space. Every station constrains exactly one attribute,
 * so any skill combination can drive the same deduction board.
 */
export interface SuspectAttrs {
  heightCm: number;
  /** Minutes after school end when the suspect arrived near the scene area. */
  arriveMin: number;
  /** Minutes after school end when the suspect left the area. */
  leaveMin: number;
  walletCents: number;
  spendCents: number;
  itemsTaken: number;
  badgeNo: number;
  /** Two-digit rowCol code of the club-room map square, e.g. 34 = row 3, col 4. */
  gridCell: number;
  stepsAvg: number;
  madeClaim: boolean;
}

export interface Suspect {
  id: string;
  name: string;
  initial: string;
  icon: string;
  attrs: SuspectAttrs;
}

// ---------------------------------------------------------------------------
// Constraints — the shared deduction vocabulary
// ---------------------------------------------------------------------------

export type AttrKey = keyof SuspectAttrs;
export type ConstraintKind = "threshold" | "equals" | "window";

export interface Constraint {
  id: string;
  /** Short kid-facing chip text, e.g. "At least 130 cm tall". */
  chip: string;
  /** Full sentence for the case file / board rows. */
  sentence: string;
  kind: ConstraintKind;
  attr: AttrKey | "scene-window";
  op?: ">=" | "<=";
  value?: number | boolean;
  /** For window constraints: scene minute referenced by the clue. */
  sceneMin?: number;
  /** Predicate over one suspect's attributes. Always true for the culprit. */
  test(attrs: SuspectAttrs): boolean;
}

// ---------------------------------------------------------------------------
// Presentations & evidence payloads
// ---------------------------------------------------------------------------

export type PresentationPayload =
  | { kind: "ruler"; shelfTopCm: number }
  | {
      kind: "clockPair";
      startH: number;
      startM: number;
      endH: number;
      endM: number;
      startLabel: string;
      endLabel: string;
    }
  | {
      kind: "dataTable";
      title: string;
      unitNoun: string;
      rows: { label: string; value: number | null }[];
      total: number;
    }
  | { kind: "receipt"; place: string; lines: { label: string; unitCents: number; qty: number }[] }
  | {
      kind: "fractionBar";
      totalSlices: number;
      eatenN: number;
      eatenD: number;
      label: string;
    }
  | { kind: "gridMap"; rows: number; cols: number; markedRow: number; markedCol: number; witnessText: string }
  | {
      kind: "expressionCode";
      a: number;
      b: number;
      c: number;
      firstOp: "×" | "+";
      secondOp: "−" | "+";
      label: string;
    }
  /**
   * Constructed-response variant (benchmark gap G2): the child builds ANY
   * valid expression from digit/operator tiles that evaluates to `target`.
   * Multi-solution by design; the engine still submits a numeric answer.
   */
  | { kind: "tileEquation"; target: number; tiles: string[] }
  | { kind: "statList"; unit: string; readings: number[] }
  | {
      kind: "recipeScale";
      baseServings: number;
      targetServings: number;
      ingredient: string;
      amountPerBase: number;
      unit: string;
    }
  | { kind: "claimCard"; claim: string; flips: number };

export interface AnswerPayload {
  type: "number";
  value: number;
  unit: string;
}

export interface HintSet {
  l1: string;
  l2: string;
  l3: string;
  l4: string;
}

export interface GeneratedEvidence {
  id: string;
  skillId: SkillId;
  /** What the item asks; ≤12 words at D1–D2 (copy rule, UX §12). */
  goal: string;
  presentation: PresentationPayload;
  answer: AnswerPayload;
  constraint: Constraint;
  hints: HintSet;
  misconceptionTag: string;
}

// ---------------------------------------------------------------------------
// Case assembly
// ---------------------------------------------------------------------------

export interface CaseRun {
  caseId: string;
  title: string;
  intro: string;
  tier: DifficultyTier;
  mode: CaseMode;
  suspects: Suspect[];
  culpritId: string;
  evidences: GeneratedEvidence[];
  /** Evidence indices after which a checkpoint runs (full mode only). */
  checkpointAfterIndices: number[];
}

export interface CaseVerification {
  ok: boolean;
  problems: string[];
}
