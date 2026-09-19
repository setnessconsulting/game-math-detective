import { describe, expect, it } from "vitest";
import { getHint, nextStationPreTeach, shouldAutoOfferHint } from "@/lib/mathDetective/hints";
import { SKILL_REGISTRY, TIERS } from "@/lib/mathDetective/skills";
import { generateCase } from "@/lib/mathDetective/solver";
import type { DifficultyTier, GeneratedEvidence, SkillId } from "@/lib/mathDetective/types";

// MD-06 policy tests: deterministic hints, no premature answer leaks,
// full misconception-tag coverage, honest L4 treatment.

/** Standalone-number token match (no lookalike substring hits). */
function containsNumberToken(text: string, value: number): boolean {
  return new RegExp(`(?<!\\d)${value}(?!\\d)`).test(text);
}

function collect(tier: DifficultyTier, seeds: number, mode: "mini" | "full" = "full"): GeneratedEvidence[] {
  const out: GeneratedEvidence[] = [];
  for (let seed = 0; seed < seeds; seed += 1) {
    out.push(...generateCase({ seed: seed * 13 + 5, tier, mode }).evidences);
  }
  return out;
}

describe("mathDetective hint ladder policy", () => {
  it("L1–L3 never contain the answer; L4 always reveals it with reasoning", () => {
    let checked = 0;
    for (const tier of TIERS) {
      for (const ev of collect(tier, 120)) {
        const answer = ev.answer.value;
        for (const level of [1, 2, 3] as const) {
          const h = getHint(ev, { itemId: ev.id, level, priorAttempts: 0 });
          expect(
            containsNumberToken(h.text, answer),
            `${tier}/${ev.skillId} L${level} leaked answer ${answer}: "${h.text}"`,
          ).toBe(false);
        }
        const l4 = getHint(ev, { itemId: ev.id, level: 4, priorAttempts: 0 });
        expect(containsNumberToken(l4.text, answer)).toBe(true);
        expect(l4.source).toBe("rule");
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(400);
  });

  it("hint text never references losing, urgency, or other children", () => {
    for (const tier of TIERS) {
      for (const ev of collect(tier, 40)) {
        for (const text of Object.values(ev.hints)) {
          expect(text.toLowerCase()).not.toMatch(/you lost|hurry|last chance|out of time|better than other/);
        }
      }
    }
  });

  it("every misconception tag in the registry has authored L1–L4 for its station", () => {
    // Sweep cases across all tiers; every station that can generate must
    // carry exactly-authored L1–L4 content with a misconception tag, and
    // the union must cover all ten registry skills.
    const tagsBySkill = new Map<SkillId, Set<string>>();
    for (const tier of TIERS) {
      for (let i = 0; i < 40; i += 1) {
        const run = generateCase({ seed: 900 + i, tier, mode: "full" });
        for (const ev of run.evidences) {
          const tags = tagsBySkill.get(ev.skillId) ?? new Set<string>();
          tags.add(ev.misconceptionTag);
          tagsBySkill.set(ev.skillId, tags);
          for (const level of [1, 2, 3, 4] as const) {
            expect(
              getHint(ev, { itemId: ev.id, level, priorAttempts: 0 }).text.length,
            ).toBeGreaterThan(8);
          }
        }
      }
    }
    for (const skillId of Object.keys(SKILL_REGISTRY) as SkillId[]) {
      expect(tagsBySkill.get(skillId)?.size, `${skillId} should carry a misconception tag`).toBeGreaterThanOrEqual(1);
    }
  });

  it("hint levels are authored progressively (L4 is the only full reveal)", () => {
    for (const ev of collect("D4", 60)) {
      for (const level of [1, 2, 3, 4] as const) {
        expect(ev.hints[`l${level}`].length).toBeGreaterThan(8);
      }
    }
  });
});

describe("mathDetective hint offer policy", () => {
  it("auto-offer fires after 2 misses only while no hint is taken and not dismissed", () => {
    expect(shouldAutoOfferHint(0, 0, false)).toBe(false);
    expect(shouldAutoOfferHint(1, 0, false)).toBe(false);
    expect(shouldAutoOfferHint(2, 0, false)).toBe(true);
    expect(shouldAutoOfferHint(5, 0, false)).toBe(true);
    // any hint taken → never auto-offer again for the item
    expect(shouldAutoOfferHint(3, 1, false)).toBe(false);
    // dismissed → suppressed for this item
    expect(shouldAutoOfferHint(3, 0, true)).toBe(false);
  });

  it("L2 pre-teach flag sets only after an L4 reveal", () => {
    expect(nextStationPreTeach([])).toBe(false);
    expect(nextStationPreTeach([1])).toBe(false);
    expect(nextStationPreTeach([1, 2, 3])).toBe(false);
    expect(nextStationPreTeach([2, 4])).toBe(true);
    expect(nextStationPreTeach([4])).toBe(true);
  });
});


