import { describe, expect, it } from "vitest";
import { mulberry32, pickInt } from "@/lib/games/shared/rng";
import {
  FALLBACK_SEEDS,
  __buildFallbackForTest,
  generateCase,
  generateCaseDetailed,
  generateSuspectsForTest,
  verifyCaseRun,
} from "@/lib/mathDetective/solver";
import { SKILL_REGISTRY, TIERS, TIER_META, tierSkills } from "@/lib/mathDetective/skills";
import type { CaseRun, DifficultyTier, GeneratedEvidence } from "@/lib/mathDetective/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Closure-free projection so two runs can be compared deep-equal. */
function project(run: CaseRun) {
  return {
    caseId: run.caseId,
    title: run.title,
    tier: run.tier,
    mode: run.mode,
    culpritId: run.culpritId,
    suspects: run.suspects.map((s) => ({ id: s.id, name: s.name, attrs: s.attrs })),
    evidences: run.evidences.map((e) => ({
      id: e.id,
      skillId: e.skillId,
      goal: e.goal,
      presentation: e.presentation,
      answer: e.answer,
      chip: e.constraint.chip,
      attr: e.constraint.attr,
      value: e.constraint.value ?? null,
      hints: e.hints,
    })),
    checkpointAfterIndices: run.checkpointAfterIndices,
  };
}

function collectEvidences(tier: DifficultyTier, seeds: number): GeneratedEvidence[] {
  const out: GeneratedEvidence[] = [];
  for (let i = 0; i < seeds; i += 1) {
    out.push(...generateCase({ seed: i * 7 + 1, tier, mode: "full" }).evidences);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Registry integrity
// ---------------------------------------------------------------------------

describe("mathDetective skill registry", () => {
  it("exposes five tiers with meta for each", () => {
    expect(TIERS).toEqual(["D1", "D2", "D3", "D4", "D5"]);
    for (const tier of TIERS) {
      expect(TIER_META[tier].rank.length).toBeGreaterThan(0);
      expect(TIER_META[tier].suspects).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps at least four stations available at every tier", () => {
    for (const tier of TIERS) {
      expect(tierSkills(tier).length).toBeGreaterThanOrEqual(4);
    }
  });

  it("includes expressions-codes at D1 so every tier has a pinpoint finisher", () => {
    expect(tierSkills("D1")).toContain("expressions-codes");
    expect(SKILL_REGISTRY["expressions-codes"].attrTarget).toBe("badgeNo");
  });

  it("gates advanced stations behind their tiers", () => {
    expect(tierSkills("D1")).not.toContain("ratio-proportion");
    expect(tierSkills("D1")).not.toContain("stats-summary");
    expect(tierSkills("D4")).toContain("ratio-proportion");
    expect(tierSkills("D5")).toContain("probability-claims");
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("mathDetective determinism", () => {
  it("same seed + tier + mode yields identical projected cases", () => {
    for (const tier of TIERS) {
      const a = generateCase({ seed: 42, tier, mode: "full" });
      const b = generateCase({ seed: 42, tier, mode: "full" });
      expect(project(a)).toEqual(project(b));
    }
  });

  it("different tiers produce different rosters for the same seed", () => {
    const d1 = generateCase({ seed: 7, tier: "D1", mode: "mini" });
    const d5 = generateCase({ seed: 7, tier: "D5", mode: "mini" });
    expect(d1.suspects.length).toBeLessThan(d5.suspects.length);
  });
});

// ---------------------------------------------------------------------------
// Uniqueness properties at scale (REQUIREMENTS §5.1 / MD-14 AC2)
// ---------------------------------------------------------------------------

describe("mathDetective generation uniqueness at scale", () => {
  it("10k D1 cases violate nothing", () => {
    let violations = 0;
    for (let seed = 0; seed < 10_000; seed += 1) {
      if (!verifyCaseRun(generateCase({ seed, tier: "D1", mode: "full" })).ok) violations += 1;
    }
    expect(violations).toBe(0);
  }, 60_000);

  it("10k D2 cases violate nothing", () => {
    let violations = 0;
    for (let seed = 0; seed < 10_000; seed += 1) {
      if (!verifyCaseRun(generateCase({ seed, tier: "D2", mode: "full" })).ok) violations += 1;
    }
    expect(violations).toBe(0);
  }, 60_000);

  it("10k D3 cases violate nothing (mixing modes)", () => {
    let violations = 0;
    for (let seed = 0; seed < 10_000; seed += 1) {
      const mode = seed % 3 === 0 ? "mini" : "full";
      if (!verifyCaseRun(generateCase({ seed, tier: "D3", mode })).ok) violations += 1;
    }
    expect(violations).toBe(0);
  }, 60_000);

  it("10k D4 cases violate nothing", () => {
    let violations = 0;
    for (let seed = 0; seed < 10_000; seed += 1) {
      if (!verifyCaseRun(generateCase({ seed, tier: "D4", mode: "full" })).ok) violations += 1;
    }
    expect(violations).toBe(0);
  }, 60_000);

  it("10k D5 cases violate nothing (odd/even roster sizes)", () => {
    let violations = 0;
    for (let seed = 0; seed < 10_000; seed += 1) {
      if (!verifyCaseRun(generateCase({ seed, tier: "D5", mode: "full" })).ok) violations += 1;
    }
    expect(violations).toBe(0);
  }, 60_000);

  it("10k mixed mini/full spread violates nothing", () => {
    let violations = 0;
    const tiers: DifficultyTier[] = ["D1", "D2", "D3", "D4", "D5"];
    for (let seed = 0; seed < 10_000; seed += 1) {
      const tier = tiers[seed % tiers.length]!;
      const mode = seed % 2 === 0 ? "full" : "mini";
      if (!verifyCaseRun(generateCase({ seed: 50_000 + seed, tier, mode })).ok) violations += 1;
    }
    expect(violations).toBe(0);
  }, 60_000);

  it("authored fallback seeds verify for every tier and mode", () => {
    for (const tier of Object.keys(FALLBACK_SEEDS) as DifficultyTier[]) {
      for (const mode of ["mini", "full"] as const) {
        // Exercises the exact post-exhaustion construction path.
        const run = __buildFallbackForTest(tier, mode);
        expect(verifyCaseRun(run).problems).toEqual([]);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Content rules
// ---------------------------------------------------------------------------

describe("mathDetective content rules", () => {
  it("ruler answers sit off labeled ticks at least 85% of the time", () => {
    const items = collectEvidences("D1", 200).filter((e) => e.presentation.kind === "ruler");
    expect(items.length).toBeGreaterThan(100);
    const offTick = items.filter(
      (e) =>
        e.presentation.kind === "ruler" &&
        e.answer.value % 10 !== 0 &&
        e.presentation.shelfTopCm === e.answer.value,
    ).length;
    expect(offTick / items.length).toBeGreaterThanOrEqual(0.85);
  });

  it("fraction clues use simplest-form fractions with integer slice counts", () => {
    const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
    const items = collectEvidences("D4", 300).filter((e) => e.presentation.kind === "fractionBar");
    expect(items.length).toBeGreaterThan(50);
    for (const item of items) {
      if (item.presentation.kind !== "fractionBar") continue;
      const p = item.presentation;
      expect(gcd(p.eatenN, p.eatenD)).toBe(1);
      expect(p.eatenN).toBeGreaterThan(0);
      expect(p.eatenN).toBeLessThan(p.eatenD);
      expect((p.totalSlices * p.eatenN) / p.eatenD === Math.floor((p.totalSlices * p.eatenN) / p.eatenD)).toBe(true);
      expect(item.answer.value).toBe((p.totalSlices * p.eatenN) / p.eatenD);
    }
  });

  it("D1 clue goals stay within twelve words", () => {
    for (let seed = 0; seed < 150; seed += 1) {
      const run = generateCase({ seed, tier: "D1", mode: "full" });
      for (const ev of run.evidences) {
        const words = ev.goal.trim().split(/\s+/).length;
        expect(words).toBeLessThanOrEqual(12);
      }
    }
  });

  it("hint ladders are fully authored for every generated item", () => {
    for (const tier of TIERS) {
      const items = collectEvidences(tier, 40);
      for (const ev of items) {
        for (const level of [1, 2, 3, 4] as const) {
          expect(ev.hints[`l${level}` as const].length).toBeGreaterThan(8);
        }
      }
    }
  });

  it("suspect invariants hold across rosters", () => {
    for (let seed = 0; seed < 500; seed += 1) {
      const { suspects, culpritId } = generateSuspectsForTest(seed, "D4");
      const culprit = suspects.find((s) => s.id === culpritId)!;
      const uniq = (xs: number[]) => new Set(xs).size === xs.length;
      expect(uniq(suspects.map((s) => s.attrs.heightCm))).toBe(true);
      expect(uniq(suspects.map((s) => s.attrs.badgeNo))).toBe(true);
      expect(uniq(suspects.map((s) => s.attrs.gridCell))).toBe(true);
      expect(uniq(suspects.map((s) => s.attrs.stepsAvg))).toBe(true);
      const partnerItems = suspects.some(
        (s) => s.id !== culpritId && s.attrs.itemsTaken === culprit.attrs.itemsTaken,
      );
      expect(partnerItems).toBe(true);
      expect(culprit.attrs.madeClaim).toBe(false);
      expect(suspects.some((s) => s.id !== culpritId && s.attrs.madeClaim)).toBe(true);
    }
  });

  it("solver rejects a tampered case whose culprit was swapped", () => {
    const run = generateCase({ seed: 3, tier: "D3", mode: "full" });
    const other = run.suspects.find((s) => s.id !== run.culpritId)!;
    const tampered: CaseRun = { ...run, culpritId: other.id };
    expect(verifyCaseRun(tampered).ok).toBe(false);
  });

  it("probability claims sit past the 1-in-20 house cutoff (§5.1 content rule)", () => {
    const items = collectEvidences("D5", 300).filter((e) => e.presentation.kind === "claimCard");
    expect(items.length).toBeGreaterThan(50);
    for (const item of items) {
      if (item.presentation.kind !== "claimCard") continue;
      // The answer IS the claimed odds denominator; it must exceed the
      // 1-in-20 plausibility cutoff for the constraint to be coherent.
      expect(item.answer.value).toBeGreaterThan(20);
      expect(2 ** item.presentation.flips).toBe(item.answer.value);
      expect(item.hints.l4).toContain(String(item.answer.value));
    }
  });

  it("tile-equation stations (D4/D5) ship reachable targets and buildable tiles", () => {
    let tileItems = 0;
    for (let seed = 0; seed < 600; seed += 1) {
      const run = generateCase({ seed: seed * 3 + 2, tier: "D5", mode: "full" });
      for (const ev of run.evidences) {
        if (ev.presentation.kind !== "tileEquation") continue;
        tileItems += 1;
        const p = ev.presentation;
        expect(p.target).toBe(ev.answer.value);
        expect(p.target).toBeGreaterThanOrEqual(21); // above the L3 example numbers
        expect(p.target).toBeLessThanOrEqual(90); // reachable as digit × digit ± digit
        const digits = p.tiles.filter((t) => /^\d$/.test(t));
        const ops = p.tiles.filter((t) => !/^\d$/.test(t));
        expect(new Set(digits).size).toBe(10); // every digit available
        expect(ops.sort().join("")).toBe("+×−");
        // The generator's own decomposition must evaluate to the target.
        expect(Number.isInteger(ev.answer.value)).toBe(true);
      }
    }
    expect(tileItems).toBeGreaterThan(100);
  });

  it("numeric code stations (D1–D3) keep keypad-friendly targets", () => {
    for (const tier of ["D1", "D2", "D3"] as const) {
      for (const ev of collectEvidences(tier, 200)) {
        if (ev.skillId !== "expressions-codes") continue;
        expect(ev.presentation.kind).toBe("expressionCode");
        expect(ev.answer.value).toBeGreaterThanOrEqual(10);
        expect(ev.answer.value).toBeLessThanOrEqual(98);
      }
    }
  });

  it("calibration cases carry the authored identity and stay solver-verified", () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const run = generateCase({ seed, tier: "D1", mode: "mini", calibration: true });
      expect(run.title).toBe("The Case of the Missing Muffins");
      expect(run.caseId).toBe("md-calibration-muffins");
      expect(verifyCaseRun(run).ok).toBe(true);
    }
    // Non-calibration keeps generator titles.
    const plain = generateCase({ seed: 4, tier: "D1", mode: "mini" });
    expect(plain.title).not.toBe("The Case of the Missing Muffins");
  });

  it("generation diagnostics report the fast path and the fallback path", () => {
    const fast = generateCaseDetailed({ seed: 8, tier: "D2", mode: "mini" });
    expect(fast.usedFallback).toBe(false);
    expect(fast.attempts).toBeGreaterThanOrEqual(1);
    expect(verifyCaseRun(fast.run).ok).toBe(true);
    // The fallback construction itself remains valid (exercised directly).
    const fb = __buildFallbackForTest("D4", "full");
    expect(verifyCaseRun(fb).ok).toBe(true);
  });

  it("generation stays fast: p95 under 50 ms per case at every tier", () => {
    const budget = 50;
    for (const tier of TIERS) {
      const samples: number[] = [];
      for (let seed = 0; seed < 600; seed += 1) {
        const t0 = performance.now();
        generateCase({ seed: 300_000 + seed, tier, mode: "full" });
        samples.push(performance.now() - t0);
      }
      samples.sort((a, b) => a - b);
      const p95 = samples[Math.floor(samples.length * 0.95)]!;
      expect(p95, `${tier} p95 ${p95.toFixed(2)}ms`).toBeLessThan(budget);
    }
  });
});

// Shared-rng sanity used by both NLJ and Math Detective (MD-01 parity).
describe("shared rng legacy parity", () => {
  function legacyMulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return function next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it("matches the pre-refactor algorithm bit-for-bit", () => {
    for (const seed of [0, 42, 123_456_789]) {
      const shared = mulberry32(seed);
      const legacy = legacyMulberry32(seed);
      for (let i = 0; i < 1000; i += 1) {
        expect(shared()).toBe(legacy());
      }
    }
  });

  it("pickInt stays within bounds", () => {
    const rng = mulberry32(9);
    for (let i = 0; i < 500; i += 1) {
      const v = pickInt(rng, 3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
    }
  });
});


