import { describe, expect, it } from "vitest";
import {
  authoredNarrativeCorpus,
  compatibleSettingsForTier,
  getCaseSetting,
  narrativeTexts,
  narrativeWordCount,
  NARRATIVE_SETTING_FLOOR,
  scanNarrativeCorpus,
  selectCaseSetting,
  verifyCaseNarrative,
} from "@/lib/mathDetective/narrative";
import { generateCase } from "@/lib/mathDetective/solver";
import { TIERS } from "@/lib/mathDetective/skills";

describe("mathDetective authored narrative contract (GAME-245)", () => {
  it("selects the same setting and authored copy for the same seed", () => {
    const first = generateCase({ seed: 245, tier: "D3", mode: "full" });
    const second = generateCase({ seed: 245, tier: "D3", mode: "full" });

    expect(first.narrative).toEqual(second.narrative);
    expect(first.intro).toBe(second.intro);
    expect(first.narrative.settingId).toBe(selectCaseSetting(245, "D3", "full").id);
    expect(first.narrative.chapterBeats).toHaveLength(first.evidences.length);
  });

  it("keeps every generated station inside the selected setting contract", () => {
    for (const tier of TIERS) {
      expect(compatibleSettingsForTier(tier)).toHaveLength(NARRATIVE_SETTING_FLOOR);
      for (let seed = 0; seed < 80; seed += 1) {
        const run = generateCase({ seed: seed * 17 + 3, tier, mode: "full" });
        const setting = getCaseSetting(run.narrative.settingId);
        expect(setting.compatibleTiers).toContain(tier);
        for (const evidence of run.evidences) {
          expect(setting.compatibleSkills).toContain(evidence.skillId);
          expect(run.narrative.stationFamilies[evidence.skillId]).toBeTypeOf("string");
          expect(run.narrative.cluePhrases[evidence.id]?.text).toBeTypeOf("string");
        }
        expect(verifyCaseNarrative(run.narrative, tier, run.suspects, run.evidences)).toEqual([]);
      }
    }
  });

  it("keeps D1-D2 authored sentences short and provenance-labeled", () => {
    for (const tier of ["D1", "D2"] as const) {
      for (let seed = 0; seed < 60; seed += 1) {
        const run = generateCase({ seed, tier, mode: "full" });
        for (const text of narrativeTexts(run.narrative)) {
          expect(narrativeWordCount(text.text)).toBeLessThanOrEqual(12);
          expect(text.provenance).toEqual({
            source: "original-authored",
            owner: "Math Detective content bank",
            reviewed: false,
          });
        }
      }
    }
  });

  it("scans the complete corpus and catches seeded banned-copy violations", () => {
    expect(scanNarrativeCorpus(authoredNarrativeCorpus())).toEqual([]);
    expect(scanNarrativeCorpus(["Hurry, this is your last chance: you lost."])).toEqual([
      { text: "Hurry, this is your last chance: you lost.", token: "hurry" },
      { text: "Hurry, this is your last chance: you lost.", token: "you lost" },
      { text: "Hurry, this is your last chance: you lost.", token: "last chance" },
    ]);
    expect(scanNarrativeCorpus(["A benchmark leaderboard is better than this."])).toEqual([
      { text: "A benchmark leaderboard is better than this.", token: "better than" },
      { text: "A benchmark leaderboard is better than this.", token: "leaderboard" },
      { text: "A benchmark leaderboard is better than this.", token: "benchmark" },
    ]);
  });

  it("keeps narrative data display-only", () => {
    const run = generateCase({ seed: 19, tier: "D2", mode: "mini" });
    expect(run.narrative).not.toHaveProperty("culpritId");
    expect(run.narrative).not.toHaveProperty("test");
    expect(JSON.stringify(run.narrative)).not.toContain("culpritId");
    expect(JSON.stringify(run.narrative)).not.toContain('"test"');
  });
});
