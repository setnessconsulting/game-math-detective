import { describe, expect, it } from "vitest";
import {
  GOLDEN_FIXTURE_SPECS,
  buildAllGoldenFixtures,
  buildGoldenFixture,
} from "@/lib/mathDetective/golden";
import { projectCase } from "@/lib/mathDetective/golden/project";
import { generateCase, verifyCaseRun } from "@/lib/mathDetective/solver";
import { TIERS } from "@/lib/mathDetective/skills";

describe("mathDetective golden fixtures (GAME-136)", () => {
  it("covers every D1–D5 tier with at least one full-mode fixture", () => {
    const fullTiers = GOLDEN_FIXTURE_SPECS.filter((s) => s.mode === "full").map((s) => s.tier);
    expect([...new Set(fullTiers)].sort()).toEqual([...TIERS]);
  });

  it("includes a mini-mode fixture", () => {
    expect(GOLDEN_FIXTURE_SPECS.some((s) => s.mode === "mini")).toBe(true);
  });

  it("each fixture regenerates identical projected identity from seed", () => {
    for (const spec of GOLDEN_FIXTURE_SPECS) {
      const a = generateCase({ seed: spec.seed, tier: spec.tier, mode: spec.mode });
      const b = generateCase({ seed: spec.seed, tier: spec.tier, mode: spec.mode });
      expect(projectCase(a)).toEqual(projectCase(b));
      expect(a.caseId).toBe(`md-${spec.seed}-${spec.tier}-${spec.mode}`);
    }
  });

  it("every golden fixture satisfies the uniqueness contract", () => {
    for (const fixture of buildAllGoldenFixtures()) {
      expect(fixture.uniquenessOk).toBe(true);
      expect(fixture.uniquenessProblems).toEqual([]);
      const run = generateCase({
        seed: fixture.spec.seed,
        tier: fixture.spec.tier,
        mode: fixture.spec.mode,
      });
      expect(verifyCaseRun(run).ok).toBe(true);
      // Final alive set after all clues is exactly the culprit.
      const last = fixture.eliminationSequence[fixture.eliminationSequence.length - 1]!;
      expect(last.aliveIds).toEqual([fixture.projected.culpritId]);
      // No early solve: every proper prefix keeps ≥2 alive.
      for (let i = 0; i < fixture.eliminationSequence.length - 1; i += 1) {
        expect(fixture.eliminationSequence[i]!.aliveIds.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("records suspects, evidence sequence, challenge answers, hints, accusation, scoring, verdict", () => {
    const fixture = buildGoldenFixture(GOLDEN_FIXTURE_SPECS[2]!); // D3-full
    expect(fixture.projected.suspects.length).toBeGreaterThanOrEqual(3);
    expect(fixture.projected.evidences.length).toBeGreaterThanOrEqual(2);
    expect(fixture.eliminationSequence.length).toBe(fixture.projected.evidences.length);
    expect(fixture.challengeTraces.length).toBe(fixture.projected.evidences.length);
    expect(fixture.hintProgression.length).toBe(fixture.projected.evidences.length);
    expect(fixture.accusation.retryReturnedToBoard).toBe(true);
    expect(fixture.accusation.secondWrongEnteredGuided).toBe(true);
    expect(fixture.accusation.contradictedBy.length).toBeGreaterThanOrEqual(1);
    expect(fixture.scoring.totalPoints).toBeGreaterThan(0);
    expect(fixture.finalVerdict.finished).toBe(true);
    expect(fixture.finalVerdict.outcome).toBe("closed");
    expect(fixture.finalVerdict.culpritId).toBe(fixture.projected.culpritId);
    expect(fixture.accusation.telemetryNames).toContain("mdetect.case_started");
    expect(fixture.accusation.telemetryNames).toContain("mdetect.accusation_made");
    expect(fixture.accusation.telemetryNames).toContain("mdetect.case_completed");
  });

  it("golden fixture scoring is deterministic across rebuilds", () => {
    const spec = GOLDEN_FIXTURE_SPECS[0]!;
    expect(buildGoldenFixture(spec).scoring).toEqual(buildGoldenFixture(spec).scoring);
    expect(buildGoldenFixture(spec).projected).toEqual(buildGoldenFixture(spec).projected);
  });
});


