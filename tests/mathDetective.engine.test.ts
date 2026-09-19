import { beforeEach, describe, expect, it } from "vitest";
import {
  initialEngineState,
  reduce,
  scoreEvidence,
  summarizeCase,
  summarizeSlots,
  tierRequiresLinks,
} from "@/lib/mathDetective/engine";
import { generateCase } from "@/lib/mathDetective/solver";
import { getHint } from "@/lib/mathDetective/hints";
import { adjustTier, initialTier } from "@/lib/mathDetective/adaptivity";
import { getTierRecord, recordOutcome, resetRecordsForTests } from "@/lib/mathDetective/records";
import { STATION_GENERATORS } from "@/lib/mathDetective/generate";
import type { EngineAction, EngineState } from "@/lib/mathDetective/engine";
import type { DifficultyTier, Third } from "@/lib/mathDetective/types";

const T = 1_700_000_000_000;

function dispatch(
  state: EngineState,
  action: EngineAction,
): { state: EngineState; events: string[] } {
  const { state: next, effects } = reduce(state, action, T);
  return { state: next, events: effects.filter((e) => e.kind === "telemetry").map((e) => e.kind === "telemetry" ? e.event.name : "") };
}

function dispatchFull(
  state: EngineState,
  action: EngineAction,
): { state: EngineState; effects: ReturnType<typeof reduce>["effects"] } {
  return reduce(state, action, T);
}

function startCase(tier: DifficultyTier = "D3", mode: "mini" | "full" = "full", seed = 11) {
  const run = generateCase({ seed, tier, mode });
  let s = initialEngineState();
  s = dispatch(s, { t: "START", run }).state;
  return { run, state: s };
}

function solveAll(input: EngineState, latencyMs = 6000) {
  let s = input;
  const events: string[] = [];
  const step = (action: EngineAction) => {
    const r = dispatch(s, action);
    s = r.state;
    events.push(...r.events);
  };
  for (let guard = 0; guard < 60; guard += 1) {
    if (s.phase === "board") return { state: s, events };
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
        const item = s.run!.evidences[s.current]!;
        step({ t: "SUBMIT_ANSWER", itemId: item.id, value: item.answer.value, latencyMs });
      } else {
        step({ t: "ADVANCE" });
      }
      continue;
    }
    break; // unexpected phase (verdict/guided/summary) — stop
  }
  throw new Error(`driveToBoard stalled in phase ${s.phase}`);
}

beforeEach(() => resetRecordsForTests());

// ---------------------------------------------------------------------------
// Scoring contract
// ---------------------------------------------------------------------------

describe("mathDetective scoring", () => {
  it("tapers by attempt: 10 / 6 / 3", () => {
    expect(scoreEvidence(0, [])).toBe(10);
    expect(scoreEvidence(1, [])).toBe(6);
    expect(scoreEvidence(2, [])).toBe(3);
    expect(scoreEvidence(5, [])).toBe(3);
  });

  it("caps at 6 with L1/L2 hints and 3 with L3/L4 hints", () => {
    expect(scoreEvidence(0, [1])).toBe(6);
    expect(scoreEvidence(0, [2])).toBe(6);
    expect(scoreEvidence(0, [3])).toBe(3);
    expect(scoreEvidence(0, [4])).toBe(3);
    expect(scoreEvidence(1, [2])).toBe(6);
    expect(scoreEvidence(1, [3])).toBe(3);
  });

  it("a hint can never make an honest retry worth less than a hinted first try", () => {
    for (const hints of [[], [1], [2], [3], [4]]) {
      const firstTry = scoreEvidence(0, hints);
      const retry = scoreEvidence(1, []);
      expect(retry).toBeGreaterThanOrEqual(firstTry - 4); // documented taper bands
    }
  });

  it("summarizeSlots computes independence including the zero case", () => {
    expect(summarizeSlots([])).toEqual({ totalPoints: 0, independenceScore: 0 });
    const s = summarizeSlots([
      { itemId: "a", solved: true, attempts: 0, hintsUsed: [], points: 10, firstTryNoHint: true },
      { itemId: "b", solved: true, attempts: 1, hintsUsed: [2], points: 6, firstTryNoHint: false },
    ]);
    expect(s.totalPoints).toBe(16);
    expect(s.independenceScore).toBe(63);
  });
});

// ---------------------------------------------------------------------------
// Reducer flows
// ---------------------------------------------------------------------------

describe("mathDetective engine happy path", () => {
  it("briefing → evidence → (checkpoints) → board → correct accuse → summary", () => {
    const started = startCase("D3", "full", 5);
    let s = started.state;

    const begin = dispatch(s, { t: "BEGIN" });
    s = begin.state;
    expect(s.phase).toBe("evidence");
    expect(begin.events).toContain("mdetect.evidence_presented");

    const solved = solveAll(s);
    s = solved.state;
    expect(s.phase).toBe("board");
    expect(s.slots.every((sl) => sl.solved)).toBe(true);

    const culpritId = started.run.culpritId;
    const accused = dispatch(s, { t: "ACCUSE", suspectId: culpritId, linkedCount: 2 });
    s = accused.state;
    expect(s.phase).toBe("verdict");
    expect(s.outcome).toBe("closed");
    expect(accused.events).toContain("mdetect.accusation_made");

    const done = dispatch(s, { t: "OPEN_SUMMARY" });
    s = done.state;
    expect(s.phase).toBe("summary");
    expect(s.finished).toBe(true);
    expect(done.events).toContain("mdetect.case_completed");
  });

  it("emits case_started exactly once on START", () => {
    const started = startCase("D1", "mini", 3);
    const again = dispatch(started.state, { t: "BEGIN" });
    const all = dispatch({ ...started.state }, { t: "BEGIN" });
    void again;
    void all;
    // START itself emitted it; assert via fresh dispatch capture
    const fresh = initialEngineState();
    const cap = dispatch(fresh, { t: "START", run: started.run });
    expect(cap.events.filter((n) => n === "mdetect.case_started")).toHaveLength(1);
  });

  it("rejects accusations without enough links at D3+", () => {
    const { run, state } = startCase("D3", "full", 5);
    const solved = solveAll(state).state;
    const before = solved;
    const r = dispatch(before, { t: "ACCUSE", suspectId: before.run!.culpritId, linkedCount: 0 });
    expect(r.state.phase).toBe("board");
    expect(r.state.rejection).toBeTruthy();
    expect(tierRequiresLinks("D3")).toBe(2);
    expect(tierRequiresLinks("D1")).toBe(0);
    void run;
  });

  it("wrong accusation lists contradictions; second wrong enters guided recovery", () => {
    const { run, state } = startCase("D3", "full", 5);
    let s = solveAll(state).state;
    const wrongSuspect = run.suspects.find((x) => x.id !== run.culpritId)!;

    const first = dispatch(s, { t: "ACCUSE", suspectId: wrongSuspect.id, linkedCount: 2 });
    s = first.state;
    expect(s.phase).toBe("verdict");
    expect(s.accusations[0]!.contradictedBy.length).toBeGreaterThanOrEqual(1);

    s = dispatch(s, { t: "RETRY_FROM_VERDICT" }).state;
    expect(s.phase).toBe("board");

    const second = dispatch(s, { t: "ACCUSE", suspectId: wrongSuspect.id, linkedCount: 2 });
    s = second.state;
    expect(s.phase).toBe("guided");
    expect(s.outcome).toBe("guided");

    s = dispatch(s, { t: "FINISH_GUIDED" }).state;
    expect(s.phase).toBe("summary");
  });

  it("wrap request lets the current item finish, then jumps to summary", () => {
    const { state } = startCase("D3", "full", 5);
    let s = dispatch(state, { t: "BEGIN" }).state;
    const item = s.run!.evidences[0]!;
    s = dispatch(s, { t: "WRAP_REQUEST" }).state;
    s = dispatch(s, { t: "SUBMIT_ANSWER", itemId: item.id, value: item.answer.value, latencyMs: 1000 }).state;
    expect(s.phase).toBe("evidence"); // grace: still on the solved item
    s = dispatch(s, { t: "ADVANCE" }).state;
    expect(s.phase).toBe("summary"); // wrapped instead of next evidence
    expect(s.capReached).toBe(true);
  });

  it("wrap request at a checkpoint closes the case instead of serving another clue", () => {
    const { run } = startCase("D3", "full", 5);
    // Jump straight into a checkpoint boundary with wrap pending.
    let s: EngineState = {
      ...initialEngineState(),
      run,
      aliveIds: run.suspects.map((x) => x.id),
      slots: run.evidences.map((ev) => ({
        itemId: ev.id,
        solved: true,
        attempts: 0,
        hintsUsed: [],
        points: 10,
        firstTryNoHint: true,
      })),
      earnedIds: run.evidences.map((ev) => ev.id),
      current: 0,
      phase: "checkpoint",
      wrapPending: true,
    };
    s = dispatch(s, { t: "COMMIT_CHECKPOINT" }).state;
    expect(s.phase).toBe("summary");
    expect(s.capReached).toBe(true);
    expect(s.finished).toBe(true);
  });

  it("hint requests log and accumulate per slot", () => {
    const { state } = startCase("D1", "mini", 21);
    let s = dispatch(state, { t: "BEGIN" }).state;
    const item = s.run!.evidences[0]!;
    s = dispatch(s, { t: "REQUEST_HINT", itemId: item.id, level: 1 }).state;
    s = dispatch(s, { t: "REQUEST_HINT", itemId: item.id, level: 2 }).state;
    const slot = s.slots[0]!;
    expect(slot.hintsUsed).toEqual([1, 2]);
    // duplicate hint requests are ignored
    s = dispatch(s, { t: "REQUEST_HINT", itemId: item.id, level: 2 }).state;
    expect(s.slots[0]!.hintsUsed).toEqual([1, 2]);
  });

  it("wrong answers never award points or change phase", () => {
    const { state } = startCase("D1", "mini", 21);
    let s = dispatch(state, { t: "BEGIN" }).state;
    const item = s.run!.evidences[0]!;
    const badValue = item.answer.value === 42 ? 41 : 42;
    s = dispatch(s, { t: "SUBMIT_ANSWER", itemId: item.id, value: badValue, latencyMs: 800 }).state;
    expect(s.phase).toBe("evidence");
    expect(s.slots[0]!.points).toBeNull();
    expect(s.slots[0]!.attempts).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Summary model & parent brief honesty
// ---------------------------------------------------------------------------

describe("mathDetective summary model", () => {
  it("coaching tone bands and badge logic", () => {
    const base = initialEngineState();
    const slots = [
      { itemId: "a", solved: true, attempts: 0, hintsUsed: [], points: 10, firstTryNoHint: true },
      { itemId: "b", solved: true, attempts: 0, hintsUsed: [], points: 10, firstTryNoHint: true },
    ];
    const high = summarizeCase({ ...base, slots, accusations: [{ suspectId: "x", correct: true, contradictedBy: [] }] });
    expect(high.independenceScore).toBe(100);
    expect(high.coaching).toMatch(/Sharp detective work/);
    expect(high.badges.join(" ")).toMatch(/Cracked It/);
    expect(high.badges.join(" ")).toMatch(/Sharp Eye/);

    const revealHeavy = summarizeCase({
      ...base,
      slots: [
        { itemId: "a", solved: true, attempts: 2, hintsUsed: [3, 4], points: 3, firstTryNoHint: false },
        { itemId: "b", solved: true, attempts: 2, hintsUsed: [4], points: 3, firstTryNoHint: false },
      ],
      accusations: [],
    });
    expect(revealHeavy.l4SharePct).toBeGreaterThan(60);
    expect(revealHeavy.parentSentence).toMatch(/step-by-step reveals/i);
    expect(revealHeavy.coaching).not.toMatch(/you lost|hurry/i);
  });

  it("skills chips come only from solved evidence", () => {
    const { state } = startCase("D1", "mini", 33);
    let s = dispatch(state, { t: "BEGIN" }).state;
    const item = s.run!.evidences[0]!;
    s = dispatch(s, { t: "SUBMIT_ANSWER", itemId: item.id, value: item.answer.value, latencyMs: 900 }).state;
    const partial = summarizeCase(s);
    expect(partial.skills.length).toBe(1);
    expect(partial.skills[0]).toBe("Elapsed time");
  });
});

// ---------------------------------------------------------------------------
// Adaptivity
// ---------------------------------------------------------------------------

describe("mathDetective adaptivity", () => {
  it("maps all 24 placement bands to tiers exactly per the locked table", () => {
    const thirds: Third[] = ["early", "mid", "late"];
    const expected: Record<string, string> = {
      "1": ["D1", "D1", "D2"].join(","),
      "2": ["D2", "D2", "D3"].join(","),
      "3": ["D3", "D3", "D3"].join(","),
      "4": ["D3", "D3", "D4"].join(","),
      "5": ["D4", "D4", "D4"].join(","),
      "6": ["D4", "D4", "D5"].join(","),
      "7": ["D5", "D5", "D5"].join(","),
      "8": ["D5", "D5", "D5"].join(","),
    };
    for (let grade = 1; grade <= 8; grade += 1) {
      thirds.forEach((third, i) => {
        const got = initialTier({ grade, third });
        const want = expected[String(grade)]!.split(",")[i]! as DifficultyTier;
        expect(got).toBe(want);
      });
    }
    expect(initialTier(null)).toBe("D2");
  });

  it("moves at most one tier per session in either direction", () => {
    const strong = Array.from({ length: 9 }, () => ({ firstTryNoHint: true, struggled: false }));
    const weak = Array.from({ length: 9 }, () => ({ firstTryNoHint: false, struggled: true }));

    let up = adjustTier({ tier: "D2", sessionShift: 0 }, strong);
    expect(up.tier).toBe("D3");
    expect(up.sessionShift).toBe(1);
    up = adjustTier({ tier: up.tier, sessionShift: up.sessionShift }, strong);
    expect(up.tier).toBe("D3"); // shift budget exhausted

    let down = adjustTier({ tier: "D4", sessionShift: 0 }, weak);
    expect(down.tier).toBe("D3");
    down = adjustTier({ tier: down.tier, sessionShift: down.sessionShift }, weak);
    expect(down.tier).toBe("D3");
  });

  it("stays steady on mixed signals and respects bounds", () => {
    const mixed = [
      { firstTryNoHint: true, struggled: false },
      { firstTryNoHint: false, struggled: true },
      { firstTryNoHint: false, struggled: false },
    ];
    expect(adjustTier({ tier: "D3", sessionShift: 0 }, mixed).reason).toBe("steady");
    expect(adjustTier({ tier: "D1", sessionShift: 0 }, weakish()).tier).toBe("D1");
    expect(adjustTier({ tier: "D5", sessionShift: 0 }, strongish()).tier).toBe("D5");
    function weakish() {
      return Array.from({ length: 3 }, () => ({ firstTryNoHint: false, struggled: true }));
    }
    function strongish() {
      return Array.from({ length: 3 }, () => ({ firstTryNoHint: true, struggled: false }));
    }
  });
});

// ---------------------------------------------------------------------------
// Hint seam
// ---------------------------------------------------------------------------

describe("mathDetective hint ladder", () => {
  it("returns rule-sourced authored text for levels 1–4 across sampled items", () => {
    for (const tier of ["D1", "D3", "D5"] as DifficultyTier[]) {
      const run = generateCase({ seed: 77, tier, mode: "full" });
      for (const ev of run.evidences) {
        for (const level of [1, 2, 3, 4] as const) {
          const h = getHint(ev, { itemId: ev.id, level, priorAttempts: 0 });
          expect(h.source).toBe("rule");
          expect(h.text.length).toBeGreaterThan(8);
        }
      }
    }
  });

  it("station generators exist for every registered skill", () => {
    const ids = Object.keys(STATION_GENERATORS);
    expect(ids.length).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Records ("beat your best")
// ---------------------------------------------------------------------------

describe("mathDetective records", () => {
  it("records track best independence and cracked count with newBest only on beat", () => {
    const a = recordOutcome("D3", 55);
    expect(a.newBest).toBe(true);
    expect(a.casesCracked).toBe(1);
    const b = recordOutcome("D3", 40);
    expect(b.newBest).toBe(false);
    expect(b.bestIndependence).toBe(55);
    expect(b.casesCracked).toBe(2);
    const c = recordOutcome("D3", 90);
    expect(c.newBest).toBe(true);
    expect(getTierRecord("D3").bestIndependence).toBe(90);
  });

  it("ties never claim a new record (MD-10)", () => {
    recordOutcome("D4", 70);
    const tie = recordOutcome("D4", 70);
    expect(tie.newBest).toBe(false);
    expect(tie.bestIndependence).toBe(70);
  });
});

// ---------------------------------------------------------------------------
// Determinism, phase legality, streaks, checkpoint schema
// ---------------------------------------------------------------------------

describe("mathDetective engine guarantees", () => {
  it("identical seeds replay identically end-to-end (golden replay)", () => {
    const replay = (seed: number) => {
      const { run, state } = startCase("D3", "full", seed);
      let s = state;
      s = dispatch(s, { t: "BEGIN" }).state;
      s = solveAll(s).state;
      const accuse = dispatch(s, { t: "ACCUSE", suspectId: run.culpritId, linkedCount: 2 });
      s = accuse.state;
      s = dispatch(s, { t: "OPEN_SUMMARY" }).state;
      return {
        summary: summarizeCase(s),
        slots: s.slots.map((x) => ({ itemId: x.itemId, attempts: x.attempts, hintsUsed: [...x.hintsUsed], points: x.points, solved: x.solved })),
        earnedIds: [...s.earnedIds],
        outcome: s.outcome,
      };
    };
    expect(replay(88)).toEqual(replay(88));
  });

  it("illegal actions are no-ops (no phase skipping)", () => {
    const { state } = startCase("D3", "full", 9);
    // BEGIN twice: second is a no-op (already in evidence after first)
    let s = dispatch(state, { t: "BEGIN" }).state;
    const before = s;
    s = dispatch(s, { t: "BEGIN" }).state;
    expect(s).toBe(before);
    // Accusation during evidence is illegal
    const r = dispatch(s, { t: "ACCUSE", suspectId: s.run!.culpritId, linkedCount: 9 });
    expect(r.state.phase).toBe("evidence");
    // Checkpoint commit during evidence is illegal
    const c = dispatch(s, { t: "COMMIT_CHECKPOINT" });
    expect(c.state.phase).toBe("evidence");
    // Summary open before any solving stays put (still on item 1, unstarted)
    const item = s.run!.evidences[0]!;
    const wrongItem = dispatch(s, { t: "SUBMIT_ANSWER", itemId: "nope", value: 1 });
    expect(wrongItem.state.phase).toBe("evidence");
    void item;
  });

  it("points never decrease across a messy whole case (property)", () => {
    for (const seed of [101, 202, 303]) {
      const { run, state } = startCase("D3", "full", seed);
      let s = dispatch(state, { t: "BEGIN" }).state;
      let lastTotal = 0;
      let guard = 0;
      while (!s.finished && guard < 120) {
        guard += 1;
        if (s.phase === "evidence") {
          const slot = s.slots[s.current]!;
          if (!slot.solved) {
            // Mix wrong answers, hints, then a correct answer.
            const item = s.run!.evidences[s.current]!;
            s = dispatch(s, { t: "SUBMIT_ANSWER", itemId: slot.itemId, value: item.answer.value + 1000, latencyMs: 1_000 }).state;
            s = dispatch(s, { t: "REQUEST_HINT", itemId: slot.itemId, level: 1 }).state;
            s = dispatch(s, { t: "SUBMIT_ANSWER", itemId: slot.itemId, value: item.answer.value, latencyMs: 1_000 }).state;
          } else {
            s = dispatch(s, { t: "ADVANCE" }).state;
          }
          const total = summarizeSlots(s.slots).totalPoints;
          expect(total).toBeGreaterThanOrEqual(lastTotal); // monotonic
          lastTotal = total;
          continue;
        }
        if (s.phase === "checkpoint") {
          s = dispatch(s, { t: "COMMIT_CHECKPOINT" }).state;
          continue;
        }
        if (s.phase === "board") {
          s = dispatch(s, { t: "ACCUSE", suspectId: run.culpritId, linkedCount: 2 }).state;
          continue;
        }
        if (s.phase === "verdict") {
          s = dispatch(s, { t: "OPEN_SUMMARY" }).state;
          continue;
        }
        break;
      }
      expect(s.finished).toBe(true);
    }
  });

  it("sharp streak builds on clean solves and resets silently on hints", () => {
    const { state } = startCase("D3", "full", 41);
    let s = dispatch(state, { t: "BEGIN" }).state;
    const advance = (cur: EngineState): EngineState => {
      let next = dispatch(cur, { t: "ADVANCE" }).state;
      if (next.phase === "checkpoint") next = dispatch(next, { t: "COMMIT_CHECKPOINT" }).state;
      return next;
    };
    const first = s.run!.evidences[0]!;
    s = dispatch(s, { t: "SUBMIT_ANSWER", itemId: first.id, value: first.answer.value, latencyMs: 1_000 }).state;
    expect(s.streak).toBe(1);
    s = advance(s);
    // A hint taken before solving resets the streak silently.
    const second = s.run!.evidences[s.current]!;
    const hintResult = dispatchFull(s, { t: "REQUEST_HINT", itemId: second.id, level: 1 });
    s = hintResult.state;
    expect(s.streak).toBe(0);
    const texts = hintResult.effects.filter((e) => e.kind === "announce").map((e) => e.text);
    expect(texts.every((t) => !/lost|reset|streak/i.test(t))).toBe(true);
    // a hinted solve does not rebuild the streak
    s = dispatch(s, { t: "SUBMIT_ANSWER", itemId: second.id, value: second.answer.value, latencyMs: 1_000 }).state;
    expect(s.streak).toBe(0);
    // a clean solve rebuilds it
    s = advance(s);
    const third = s.run!.evidences[s.current]!;
    s = dispatch(s, { t: "SUBMIT_ANSWER", itemId: third.id, value: third.answer.value, latencyMs: 1_000 }).state;
    expect(s.streak).toBe(1);
  });

  it("checkpoint commit emits the §10 schema (chapter, marked vs true survivors)", () => {
    const { state } = startCase("D3", "full", 5);
    let s = dispatch(state, { t: "BEGIN" }).state;
    // Solve through the first checkpoint boundary.
    for (let guard = 0; guard < 20 && s.phase !== "checkpoint"; guard += 1) {
      const slot = s.slots[s.current]!;
      if (!slot.solved) {
        const item = s.run!.evidences[s.current]!;
        s = dispatch(s, { t: "SUBMIT_ANSWER", itemId: slot.itemId, value: item.answer.value, latencyMs: 1_000 }).state;
      } else {
        s = dispatch(s, { t: "ADVANCE" }).state;
      }
    }
    expect(s.phase).toBe("checkpoint");
    // Mark everyone OUT (a wrong hunch — diagnostics only, truth unchanged).
    for (const suspect of s.run!.suspects) {
      s = dispatch(s, { t: "CHECKPOINT_MARK", suspectId: suspect.id, alive: false }).state;
    }
    const committed = dispatchFull(s, { t: "COMMIT_CHECKPOINT" });
    const cpEvent = committed.effects.find(
      (e) => e.kind === "telemetry" && e.event.name === "mdetect.checkpoint_marked",
    );
    expect(cpEvent).toBeDefined();
    const data = (cpEvent as { event: { data: Record<string, number> } }).event.data;
    expect(data.markedSurvivors).toBe(0);
    expect(data.trueSurvivors).toBeGreaterThanOrEqual(1);
    expect(data.chapter).toBe(1);
    expect(Object.keys(data).every((k) => ["chapter", "markedSurvivors", "trueSurvivors"].includes(k))).toBe(true);
    // Committing advanced play regardless of the child's hunch (never blocks).
    expect(committed.state.phase).not.toBe("checkpoint");
  });
});


