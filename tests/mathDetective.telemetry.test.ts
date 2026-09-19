import { beforeEach, describe, expect, it } from "vitest";
import {
  createBufferSink,
  MD_EVENT_FIELDS,
  type MdEvent,
  type MdEventName,
} from "@/lib/games/shared/telemetry";
import { generateCase } from "@/lib/mathDetective/solver";
import { TIER_META } from "@/lib/mathDetective/skills";
import { buildParentBriefRow, REVEAL_HEAVY_NOTE } from "@/lib/mathDetective/parentBrief";
import {
  initialEngineState,
  reduce,
  summarizeCase,
  type EngineAction,
  type EngineState,
} from "@/lib/mathDetective/engine";

// MD-11: telemetry contract + parent-brief itemization. Events stay inside
// the §10 allowlist; values are primitive, bounded, identifier-free.

const T = 1_700_000_000_000;

function playFullCase(seed: number, tier: "D1" | "D3" | "D5", sink: ReturnType<typeof createBufferSink>) {
  const run = generateCase({ seed, tier, mode: "full" });
  let s: EngineState = initialEngineState();
  const step = (action: EngineAction): void => {
    const { state: next, effects } = reduce(s, action, T);
    s = next;
    for (const eff of effects) {
      if (eff.kind === "telemetry") sink.emit(eff.event);
    }
  };
  step({ t: "START", run });
  for (let guard = 0; guard < 80; guard += 1) {
    if (s.phase === "board") {
      step({ t: "ACCUSE", suspectId: run.culpritId, linkedCount: 2 });
      continue;
    }
    if (s.phase === "verdict") {
      step({ t: "OPEN_SUMMARY" });
      break;
    }
    if (s.phase === "briefing") {
      step({ t: "BEGIN" });
      continue;
    }
    if (s.phase === "checkpoint") {
      step({ t: "COMMIT_CHECKPOINT" });
      continue;
    }
    if (s.phase === "evidence") {
      const slot = s.slots[s.current]!;
      if (!slot.solved) {
        step({ t: "SUBMIT_ANSWER", itemId: slot.itemId, value: run.evidences[s.current]!.answer.value, latencyMs: 6_000 });
      } else {
        step({ t: "ADVANCE" });
      }
      continue;
    }
    break;
  }
  return { state: s, run };
}

describe("mathDetective telemetry contract", () => {
  let sink: ReturnType<typeof createBufferSink>;
  beforeEach(() => {
    sink = createBufferSink(500);
  });

  it("a full case emits only allowlisted fields with primitive bounded values", () => {
    playFullCase(11, "D3", sink);
    expect(sink.events.length).toBeGreaterThan(5);
    const names = new Set(sink.events.map((e) => e.name));
    expect(names.has("mdetect.case_started")).toBe(true);
    expect(names.has("mdetect.evidence_presented")).toBe(true);
    expect(names.has("mdetect.evidence_answered")).toBe(true);
    expect(names.has("mdetect.accusation_made")).toBe(true);
    expect(names.has("mdetect.case_completed")).toBe(true);

    for (const event of sink.events) {
      const allowed = MD_EVENT_FIELDS[event.name as MdEventName]!;
      for (const key of Object.keys(event.data)) {
        expect(allowed, `${event.name} carried non-allowlisted field ${key}`).toContain(key);
      }
      for (const value of Object.values(event.data)) {
        expect(["string", "number", "boolean"].includes(typeof value) || value === null).toBe(true);
        if (typeof value === "string") {
          expect(value.length).toBeLessThanOrEqual(120); // bounded, no free text capture
        }
      }
    }
  });

  it("case_completed carries the minutes bucket and practiced skills", () => {
    playFullCase(7, "D1", sink);
    const completed = sink.events.find((e) => e.name === "mdetect.case_completed")!;
    expect(completed.data.outcome).toBe("closed");
    expect(typeof completed.data.independenceScore).toBe("number");
    expect(["<2m", "2-5m", "5-10m", ">10m"]).toContain(completed.data.minutesSpentBucket);
    expect(String(completed.data.skills).length).toBeGreaterThan(0);
  });

  it("hint and checkpoint events match the schema", () => {
    const run = generateCase({ seed: 21, tier: "D2", mode: "mini" });
    let s: EngineState = initialEngineState();
    const events: MdEvent[] = [];
    const step = (action: EngineAction): void => {
      const { state: next, effects } = reduce(s, action, T);
      s = next;
      events.push(...effects.filter((e) => e.kind === "telemetry").map((e) => (e as { event: MdEvent }).event));
    };
    step({ t: "START", run });
    step({ t: "BEGIN" });
    step({ t: "SUBMIT_ANSWER", itemId: run.evidences[0]!.id, value: -999, latencyMs: 1_000 });
    step({ t: "SUBMIT_ANSWER", itemId: run.evidences[0]!.id, value: -998, latencyMs: 1_000 });
    step({ t: "REQUEST_HINT", itemId: run.evidences[0]!.id, level: 1 });
    step({ t: "SUBMIT_ANSWER", itemId: run.evidences[0]!.id, value: run.evidences[0]!.answer.value, latencyMs: 1_000 });
    step({ t: "ADVANCE" });
    step({ t: "SUBMIT_ANSWER", itemId: run.evidences[1]!.id, value: run.evidences[1]!.answer.value, latencyMs: 1_000 });
    step({ t: "ADVANCE" });
    step({ t: "ACCUSE", suspectId: run.culpritId, linkedCount: 0 });
    step({ t: "OPEN_SUMMARY" });

    const hint = events.find((e) => e.name === "mdetect.hint_shown")!;
    expect(Object.keys(hint.data).every((k) => MD_EVENT_FIELDS["mdetect.hint_shown"].includes(k))).toBe(true);
    expect(hint.data.source).toBe("user");
    expect(hint.data.level).toBe(1);

    const answered = events.filter((e) => e.name === "mdetect.evidence_answered");
    expect(answered.length).toBe(4); // 2 misses + 2 solves across 2 mini clues
    expect(answered.every((e) => ["<5s", "5-15s", "15-45s", ">45s"].includes(String(e.data.latencyBucket)))).toBe(true);
  });
});

describe("mathDetective parent brief row", () => {
  it("itemizes skills, evidence, hints, accusations, independence + coaching", () => {
    const run = generateCase({ seed: 31, tier: "D3", mode: "full" });
    let s: EngineState = initialEngineState();
    const step = (action: EngineAction): void => {
      s = reduce(s, action, T).state;
    };
    step({ t: "START", run });
    step({ t: "BEGIN" });
    for (let guard = 0; guard < 20 && s.phase !== "board"; guard += 1) {
      if (s.phase === "checkpoint") {
        step({ t: "COMMIT_CHECKPOINT" });
        continue;
      }
      const slot = s.slots[s.current]!;
      if (!slot.solved) {
        step({ t: "REQUEST_HINT", itemId: slot.itemId, level: 1 });
        step({ t: "SUBMIT_ANSWER", itemId: slot.itemId, value: run.evidences[s.current]!.answer.value, latencyMs: 6_000 });
      } else {
        step({ t: "ADVANCE" });
      }
    }
    step({ t: "ACCUSE", suspectId: run.culpritId, linkedCount: 2 });
    step({ t: "OPEN_SUMMARY" });

    const row = buildParentBriefRow({
      tierRank: TIER_META.D3.rank,
      mode: run.mode,
      summary: summarizeCase(s),
      accusationAttempts: s.accusations.length,
      slots: s.slots,
    });
    expect(row.gameLabel).toContain("Math Detective");
    expect(row.tierRank).toBe("Agent");
    expect(row.evidenceCorrect).toBe(row.evidenceAttempted);
    expect(row.hintsByLevel.l1).toBe(run.evidences.length);
    expect(row.accusationAttempts).toBe(1);
    expect(row.skills.length).toBeGreaterThan(0);
    expect(row.coaching.length).toBeGreaterThan(0);
    expect(row.honestyNote).toBeNull(); // L1 only — not reveal-heavy
  });

  it("marks reveal-heavy completions with the honesty note", () => {
    const run = generateCase({ seed: 32, tier: "D3", mode: "mini" });
    let s: EngineState = initialEngineState();
    const step = (action: EngineAction): void => {
      s = reduce(s, action, T).state;
    };
    step({ t: "START", run });
    step({ t: "BEGIN" });
    for (const item of run.evidences) {
      step({ t: "REQUEST_HINT", itemId: item.id, level: 4 });
      step({ t: "SUBMIT_ANSWER", itemId: item.id, value: item.answer.value, latencyMs: 6_000 });
      step({ t: "ADVANCE" });
    }
    step({ t: "ACCUSE", suspectId: run.culpritId, linkedCount: 0 });
    step({ t: "OPEN_SUMMARY" });

    const row = buildParentBriefRow({
      tierRank: TIER_META.D3.rank,
      mode: run.mode,
      summary: summarizeCase(s),
      accusationAttempts: s.accusations.length,
      slots: s.slots,
    });
    expect(row.honestyNote).toBe(REVEAL_HEAVY_NOTE);
    expect(row.hintsByLevel.l4).toBe(run.evidences.length);
  });
});


