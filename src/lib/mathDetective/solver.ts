/**
 * Math Detective — case assembly + uniqueness solver (REQUIREMENTS §5.1).
 *
 * Builder invariants enforced here:
 *  (a) the full constraint set matches exactly one suspect — the culprit;
 *  (b) every strict prefix of clues leaves at least two candidates;
 *  (c) every clue eliminates at least one currently-live suspect.
 * Pinpoint constraints (unique badge / map square / step average) are only
 * placed in the final slot, so no clue can solve the case early.
 *
 * Determinism: identical seed + tier + mode yields an identical case.
 */
import { mulberry32, pickFrom, pickInt, shuffled } from "@/lib/games/shared/rng";
import { SKILL_REGISTRY, TIERS, TIER_META, tierIndex, tierSkills } from "./skills";
import { makeSuspects, STATION_GENERATORS } from "./generate";
import {
  createCaseNarrative,
  selectCaseSetting,
  verifyCaseNarrative,
} from "./narrative";
import type {
  CaseMode,
  CaseRun,
  CaseVerification,
  DifficultyTier,
  GeneratedEvidence,
  Suspect,
  SuspectAttrs,
} from "./types";

const MAX_ATTEMPTS = 20;
const DEBUG_BUILD =
  typeof process !== "undefined" && process.env?.MD_DEBUG_BUILD === "1";

const CASE_TITLES: readonly string[] = [
  "The Case of the Missing Trophy",
  "The Case of the Vanishing Cupcakes",
  "The Case of the Borrowed Bicycle",
  "The Case of the Locked Supply Closet",
  "The Case of the Mixed-Up Medals",
];

/**
 * Attrs that uniquely identify a suspect — final-slot only. stepsAvg is
 * NOT pinpoint: the stats generator gives a live twin the culprit's value,
 * so its constraint keeps two suspects alive and works only in non-final
 * slots (the builder rejects it as the last clue, which is correct).
 */
const PINPOINT_ATTRS: ReadonlySet<string> = new Set(["badgeNo", "gridCell"]);

function clueCount(tier: DifficultyTier, mode: CaseMode): number {
  const meta = TIER_META[tier];
  return mode === "mini" ? meta.miniClues : meta.fullClues;
}

function buildAttempt(
  rng: () => number,
  tier: DifficultyTier,
  mode: CaseMode,
  seed: number,
): CaseRun | null {
  const { suspects, culpritId } = makeSuspects(rng, tier, mode);
  const culprit = suspects.find((s) => s.id === culpritId)!;
  const K = clueCount(tier, mode);
  const setting = selectCaseSetting(seed, tier, mode);
  const skills = tierSkills(tier).filter((skillId) => setting.compatibleSkills.includes(skillId));
  const attrsById = new Map(suspects.map((s) => [s.id, s.attrs]));

  interface SlotCandidate {
    ev: GeneratedEvidence;
    attr: string;
    removed: number;
    survivors: string[];
    /** Culprit-attr refinements this candidate depends on (committed on descent). */
    appliedAttrs: SuspectAttrs;
  }

  /** All valid candidates for one slot, least-eliminating first. */
  function slotOptions(
    pos: number,
    live: string[],
    usedAttrs: Set<string>,
  ): SlotCandidate[] {
    const isFinal = pos === K - 1;
    const shuffledSkills = shuffled(rng, skills);
    const orderedSkills = [
      ...shuffledSkills.filter((id) => !usedAttrs.has(SKILL_REGISTRY[id].attrTarget)),
      ...shuffledSkills.filter((id) => usedAttrs.has(SKILL_REGISTRY[id].attrTarget)),
    ];
    const out: SlotCandidate[] = [];
    for (const skillId of orderedSkills) {
      const def = SKILL_REGISTRY[skillId];
      const isPinpoint = PINPOINT_ATTRS.has(def.attrTarget);
      if (isPinpoint && !isFinal) continue;
      for (let retry = 0; retry < 4; retry += 1) {
        // Generators may refine culprit attrs; run them against a TRIAL CLONE
        // so abandoned DFS branches cannot corrupt committed state.
        const trialCulprit: Suspect = { ...culprit, attrs: { ...culprit.attrs } };
        let candidate: GeneratedEvidence;
        try {
          candidate = STATION_GENERATORS[skillId]({
            rng,
            tier,
            suspects,
            culprit: trialCulprit,
            liveAttrs: live.map((id) =>
              id === culprit.id ? trialCulprit.attrs : attrsById.get(id)!,
            ),
          });
        } catch (e) {
          if (DEBUG_BUILD) console.log(`[md] pos${pos} ${skillId} threw`, e);
          break;
        }
        candidate.id = `ev-${pos}-${skillId}`;
        const survivors = live.filter((id) =>
          candidate.constraint.test(
            id === culprit.id ? trialCulprit.attrs : attrsById.get(id)!,
          ),
        );
        const removed = live.length - survivors.length;
        const culpritSurvives = survivors.includes(culpritId);
        const valid =
          removed >= 1 &&
          culpritSurvives &&
          (!isFinal ? survivors.length >= 2 : survivors.length === 1);
        if (DEBUG_BUILD) {
          console.log(
            `[md] pos${pos} final=${isFinal} ${skillId} live=${live.length} removed=${removed} survivors=${survivors.length} → ${valid ? "ok" : "reject"}`,
          );
        }
        if (valid) {
          out.push({
            ev: candidate,
            attr: def.attrTarget,
            removed,
            survivors,
            appliedAttrs: trialCulprit.attrs,
          });
          break; // first valid draw stands in for this skill
        }
      }
    }
    // Least-eliminating first; ties prefer unused attributes.
    return out.sort((a, b) => {
      const ua = usedAttrs.has(a.attr) ? 1 : 0;
      const ub = usedAttrs.has(b.attr) ? 1 : 0;
      return ua !== ub ? ua - ub : a.removed - b.removed;
    });
  }

  /** Depth-first fill with backtracking; commits/restores culprit mutations. */
  function fill(
    pos: number,
    live: string[],
    usedAttrs: Set<string>,
    acc: GeneratedEvidence[],
  ): GeneratedEvidence[] | null {
    if (pos === K) return live.length === 1 && live[0] === culpritId ? acc : null;
    const snapshot: SuspectAttrs = { ...culprit.attrs };
    for (const cand of slotOptions(pos, live, usedAttrs)) {
      Object.assign(culprit.attrs, cand.appliedAttrs);
      const nextUsed = new Set(usedAttrs);
      nextUsed.add(cand.attr);
      const result = fill(pos + 1, cand.survivors, nextUsed, [...acc, cand.ev]);
      if (result) return result;
      Object.assign(culprit.attrs, snapshot); // undo branch mutations
    }
    Object.assign(culprit.attrs, snapshot);
    return null;
  }

  const evidences = fill(0, suspects.map((s) => s.id), new Set(), []);
  if (!evidences) return null;

  const narrative = createCaseNarrative({
    seed,
    tier,
    mode,
    setting,
    suspects,
    evidences,
  });

  const checkpointAfterIndices: number[] = [];
  if (mode === "full" && K >= 3) {
    const chapterSize = Math.ceil(K / 3);
    for (let i = chapterSize - 1; i < K - 1; i += chapterSize) {
      checkpointAfterIndices.push(i);
    }
  }

  return {
    caseId: `md-${seed}-${tier}-${mode}`,
    title: pickFrom(rng, CASE_TITLES),
    intro: `${suspects.length} suspects. Solve each clue to earn evidence, then name the culprit.`,
    narrative,
    tier,
    mode,
    suspects,
    culpritId,
    evidences,
    checkpointAfterIndices,
  };
}

/**
 * Verify the three builder properties plus culprit containment.
 * Pure and exported for tests.
 */
export function verifyCaseRun(run: CaseRun): CaseVerification {
  const problems: string[] = [];
  problems.push(...verifyCaseNarrative(run.narrative, run.tier, run.suspects, run.evidences));
  const attrsById = new Map(run.suspects.map((s) => [s.id, s.attrs]));
  let live = run.suspects.map((s) => s.id);

  run.evidences.forEach((ev, idx) => {
    const next = live.filter((id) => ev.constraint.test(attrsById.get(id)!));
    const removed = live.length - next.length;
    if (removed < 1) problems.push(`clue ${idx} (${ev.skillId}) eliminates nobody`);
    if (!next.includes(run.culpritId)) problems.push(`clue ${idx} eliminates the culprit`);
    if (idx < run.evidences.length - 1 && next.length < 2) {
      problems.push(`prefix ${idx} solves the case early`);
    }
    live = next;
  });

  if (live.length !== 1 || live[0] !== run.culpritId) {
    problems.push(`final set is [${live.join(",")}] not [${run.culpritId}]`);
  }
  return { ok: problems.length === 0, problems };
}

function attemptSeed(seed: number, tier: DifficultyTier, mode: CaseMode, attempt: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ tier.length, 2654435761) >>> 0;
  h = Math.imul(h ^ mode.length + attempt * 31, 2246822519) >>> 0;
  h = Math.imul(h ^ attempt + 1, 3266489917) >>> 0;
  return h >>> 0;
}

/**
 * Deterministic fallback seeds — validated per-tier/mode by
 * tests/mathDetective.generation.test.ts so the "authored seed case"
 * path from REQUIREMENTS §5.1 stays provably solvable.
 */
export const FALLBACK_SEEDS: Record<DifficultyTier, Record<CaseMode, number>> = {
  D1: { mini: 1, full: 5 },
  D2: { mini: 1, full: 4 },
  D3: { mini: 1, full: 4 },
  D4: { mini: 1, full: 2 },
  D5: { mini: 1, full: 1 },
};

export interface GenerateCaseArgs {
  seed: number;
  tier: DifficultyTier;
  mode: CaseMode;
  /**
   * First-run calibration case (A12 / UX §3): authored title + intro over a
   * D1-shaped mini case so the tutorial IS the first Quick Case.
   */
  calibration?: boolean;
}

export interface GenerateCaseResult {
  run: CaseRun;
  /** True when the retry budget was exhausted and the authored fallback fired. */
  usedFallback: boolean;
  attempts: number;
}

function applyCalibration(run: CaseRun): CaseRun {
  const intro = "Two clues. Practice the loop, then name the culprit.";
  return {
    ...run,
    caseId: "md-calibration-muffins",
    title: "The Case of the Missing Muffins",
    intro,
    narrative: {
      ...run.narrative,
      briefing: { ...run.narrative.briefing, text: intro },
    },
  };
}

/**
 * Generate one solver-verified case; deterministic for a given seed, with
 * generation diagnostics so the shell can log `mdetect.error{fallback-used}`.
 */
export function generateCaseDetailed(args: GenerateCaseArgs): GenerateCaseResult {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const rng = mulberry32(attemptSeed(args.seed, args.tier, args.mode, attempt));
    try {
      const run = buildAttempt(rng, args.tier, args.mode, args.seed);
      if (run && verifyCaseRun(run).ok) {
        return { run: args.calibration ? applyCalibration(run) : run, usedFallback: false, attempts: attempt + 1 };
      }
    } catch {
      // generation hiccup → next attempt
    }
  }
  // Authored-by-construction fallback: fixed seeds proven valid by tests.
  const fbSeed = FALLBACK_SEEDS[args.tier][args.mode];
  const rng = mulberry32(attemptSeed(fbSeed, args.tier, args.mode, MAX_ATTEMPTS));
  const run = buildAttempt(rng, args.tier, args.mode, fbSeed);
  if (!run || !verifyCaseRun(run).ok) {
    throw new Error(`mdetect generation failure: tier ${args.tier} mode ${args.mode}`);
  }
  return {
    run: args.calibration ? applyCalibration(run) : run,
    usedFallback: true,
    attempts: MAX_ATTEMPTS,
  };
}

/** Generate one solver-verified case; deterministic for a given seed. */
export function generateCase(args: GenerateCaseArgs): CaseRun {
  return generateCaseDetailed(args).run;
}

/** Convenience for callers that want a fresh random case. */
export function generateRandomCase(
  tier: DifficultyTier,
  mode: CaseMode,
  rand: () => number = Math.random,
): CaseRun {
  return generateCase({ seed: Math.floor(rand() * 1_000_000), tier, mode });
}

/**
 * Test hook: run one raw build attempt so tests can surface the exact
 * generator exception or rejection without the retry loop masking it.
 */
export function __buildAttemptForTest(
  seed: number,
  tier: DifficultyTier,
  mode: CaseMode,
): { run: CaseRun | null; error: string | null; verification: CaseVerification | null } {
  const rng = mulberry32(attemptSeed(seed, tier, mode, 0));
  try {
    const run = buildAttempt(rng, tier, mode, seed);
    return { run, error: null, verification: run ? verifyCaseRun(run) : null };
  } catch (e) {
    return { run: null, error: e instanceof Error ? e.message : String(e), verification: null };
  }
}

/**
 * Test hook: construct the authored fallback path directly (the exact
 * construction used when all random attempts fail).
 */
export function __buildFallbackForTest(tier: DifficultyTier, mode: CaseMode): CaseRun {
  const fbSeed = FALLBACK_SEEDS[tier][mode];
  const rng = mulberry32(attemptSeed(fbSeed, tier, mode, MAX_ATTEMPTS));
  const run = buildAttempt(rng, tier, mode, fbSeed);
  if (!run || !verifyCaseRun(run).ok) {
    throw new Error(`fallback construction invalid: tier ${tier} mode ${mode}`);
  }
  return run;
}

// Exposed for tests that need roster/attr guarantees directly.
export function generateSuspectsForTest(
  seed: number,
  tier: DifficultyTier,
): { suspects: Suspect[]; culpritId: string } {
  return makeSuspects(mulberry32(seed), tier, "full");
}

// Re-exports used by UI/tests without reaching into internals.
export { TIERS, tierIndex, pickInt };
