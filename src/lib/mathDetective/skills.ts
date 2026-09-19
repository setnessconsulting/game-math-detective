/**
 * Math Detective — skill registry (REQUIREMENTS §3, seam 1).
 *
 * Single source of truth consumed by problem generation. Each station maps
 * to Common Core cluster alignment targets and constrains exactly one
 * suspect attribute, which is what lets one engine span grades 1–8.
 */
import type { AttrKey, DifficultyTier, SkillId } from "./types";

export interface SkillDef {
  id: SkillId;
  /** Human label for parent-brief rows and summary chips. */
  label: string;
  /** First tier index (0-based over TIERS) that includes this station. */
  minTierIndex: number;
  /** Alignment targets — cluster intent, not verbatim standard text. */
  ccss: string[];
  /** The one attribute this station constrains. */
  attrTarget: AttrKey | "scene-window";
}

export const TIERS: readonly DifficultyTier[] = ["D1", "D2", "D3", "D4", "D5"];

/**
 * Tier configuration. Invariant: fullClues ≤ suspects − 1, because every
 * clue must eliminate at least one still-live suspect while proper prefixes
 * keep ≥ 2 candidates (REQUIREMENTS §5.1 b/c). Counts co-designed 2026-08-25;
 * supersedes the provisional suspect/clue splits sketched in §3.
 */
export const TIER_META: Record<
  DifficultyTier,
  { rank: string; detail: string; suspects: number; fullClues: number; miniClues: number }
> = {
  D1: { rank: "Cadet", detail: "Grades 1–2 · whole numbers, half hours, picture tables", suspects: 4, fullClues: 3, miniClues: 2 },
  D2: { rank: "Junior Agent", detail: "Grades 2–4 · two-digit math, five-minute clocks, coins", suspects: 5, fullClues: 4, miniClues: 2 },
  D3: { rank: "Agent", detail: "Grades 3–5 · facts to 10, fractions, map grids", suspects: 5, fullClues: 4, miniClues: 3 },
  D4: { rank: "Specialist", detail: "Grades 5–7 · decimals-ready arithmetic, ratios, data", suspects: 6, fullClues: 5, miniClues: 3 },
  D5: { rank: "Inspector", detail: "Grades 6–8 · multi-step expressions, statistics, claims", suspects: 6, fullClues: 5, miniClues: 3 },
};

export const SKILL_REGISTRY: Record<SkillId, SkillDef> = {
  "measure-length": {
    id: "measure-length",
    label: "Measurement",
    minTierIndex: 0,
    ccss: ["1.MD.A.2", "2.MD.A.1", "3.MD.B.4"],
    attrTarget: "heightCm",
  },
  "time-elapsed": {
    id: "time-elapsed",
    label: "Elapsed time",
    minTierIndex: 0,
    ccss: ["2.MD.C.7", "3.MD.A.1", "4.MD.A.2"],
    attrTarget: "scene-window",
  },
  "data-tables": {
    id: "data-tables",
    label: "Reading tables",
    minTierIndex: 0,
    ccss: ["1.MD.C.4", "2.MD.D.10", "3.MD.B.3", "5.MD.B.2"],
    attrTarget: "itemsTaken",
  },
  "expressions-codes": {
    id: "expressions-codes",
    label: "Expressions & codes",
    minTierIndex: 0,
    ccss: ["1.OA.B.3", "3.OA.C.7", "4.OA.A.3", "6.EE.A.2"],
    attrTarget: "badgeNo",
  },
  "money-receipts": {
    id: "money-receipts",
    label: "Money math",
    minTierIndex: 1,
    ccss: ["2.MD.C.8", "4.MD.A.2", "5.NBT.B.7"],
    attrTarget: "spendCents",
  },
  "fractions-parts": {
    id: "fractions-parts",
    label: "Fractions",
    minTierIndex: 2,
    ccss: ["3.NF.A.1", "4.NF.A.1", "5.NF.A.1"],
    attrTarget: "itemsTaken",
  },
  "grid-coordinates": {
    id: "grid-coordinates",
    label: "Map coordinates",
    minTierIndex: 2,
    ccss: ["5.G.A.1", "6.NS.C.6"],
    attrTarget: "gridCell",
  },
  "ratio-proportion": {
    id: "ratio-proportion",
    label: "Ratios & recipes",
    minTierIndex: 3,
    ccss: ["6.RP.A.1", "6.RP.A.3", "7.RP.A.2"],
    attrTarget: "walletCents",
  },
  "stats-summary": {
    id: "stats-summary",
    label: "Statistics",
    minTierIndex: 3,
    ccss: ["6.SP.A.2", "6.SP.B.5", "8.SP.A.1"],
    attrTarget: "stepsAvg",
  },
  "probability-claims": {
    id: "probability-claims",
    label: "Probability checks",
    minTierIndex: 4,
    ccss: ["7.SP.C.5", "7.SP.C.7"],
    attrTarget: "madeClaim",
  },
};

export function tierIndex(tier: DifficultyTier): number {
  return TIERS.indexOf(tier);
}

/** Skills available at a tier, in registry order. Every tier keeps ≥4. */
export function tierSkills(tier: DifficultyTier): SkillId[] {
  const idx = tierIndex(tier);
  return (Object.keys(SKILL_REGISTRY) as SkillId[]).filter(
    (id) => SKILL_REGISTRY[id].minTierIndex <= idx,
  );
}
