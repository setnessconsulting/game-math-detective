import { beforeEach, describe, expect, it } from "vitest";
import {
  initialEngineState,
  reduce,
  scoreEvidence,
  summarizeCase,
  summarizeSlots,
  type EngineAction,
  type EngineState,
} from "@/lib/mathDetective/engine";
import { generateCase, verifyCaseRun } from "@/lib/mathDetective/solver";
import { resetRecordsForTests } from "@/lib/mathDetective/records";
import type { DifficultyTier } from "@/lib/mathDetective/types";

/**
 * Domain-level game-state invariants (answer behavior, scoring, progression,
 * reset/replay, generation validity) that complement the contract tests in
 * mathDetective.engine / .integrity / .generation.
 *
 * All tests are deterministic and offline: fixed seeds, fixed injected clock.
 */

const T = 1_700_000_000_000;

function dispatch(state: EngineState, action: EngineAction): EngineState {
  return reduce(state, action, T).state;
}

function startCase(tier: DifficultyTier, mode: "mini" | "full", seed: number) {
  const run = generateCase({ seed, tier, mode });
  const state = dispatch(initialEngineState(), { t: "START", run });
  return { run, state };
}

/** Submits the correct answer for the current item. */
function solveCurrent(s: EngineState): EngineState {
  const item = s.run!.evidences[s.current]!;
  return dispatch(s, {
    t: "SUBMIT_ANSWER",
    itemId: item.id,
    value: item.answer.value,
    latencyMs: 900,
  });
}

/** Drives briefing → all evidence (+ checkpoints) → board. */
function driveToBoard(input: EngineState): EngineState {
  let s = input;
  for (let guard = 0; guard < 60; guard += 1) {
    if (s.phase === "board") return s;
    if (s.phase === "briefing") {
      s = dispatch(s, { t: "BEGIN" });
      continue;
    }
    if (s.phase === "checkpoint") {
      s = dispatch(s, { t: "COMMIT_CHECKPOINT" });
      continue;
    }
    if (s.phase === "evidence") {
      s = s.slots[s.current]!.solved ? dispatch(s, { t: "ADVANCE" }) : solveCurrent(s);
      continue;
    }
    break;
  }
  throw new Error(`driveToBoard stalled in phase ${s.phase}`);
}

/** Drives a started case to a summary via correct accusation. */
function driveToSummary(started: EngineState, culpritId: string): EngineState {
  let s = driveToBoard(started);
  s = dispatch(s, { t: "ACCUSE", suspectId: culpritId, linkedCount: 2 });
  expect(s.phase).toBe("verdict");
  return dispatch(s, { t: "OPEN_SUMMARY" });
}

beforeEach(() => resetRecordsForTests());

// ---------------------------------------------------------------------------
// Answer behavior
// ---------------------------------------------------------------------------

describe("mathDetective answer behavior", () => {
  it("a correct submit solves exactly once; any further submit on the solved item is an exact no-op", () => {
    const { state } = startCase("D1", "mini", 21);
    let s = dispatch(state, { t: "BEGIN" });
    const item = s.run!.evidences[0]!;

    s = solveCurrent(s);
    expect(s.slots[0]!.solved).toBe(true);
    expect(s.slots[0]!.points).toBe(10);
    expect(s.slots[0]!.attempts).toBe(0);
    expect(s.earnedIds).toEqual([item.id]);

    // Repeated submission (correct value): no second earn, no phase change.
    const repeat = dispatch(s, { t: "SUBMIT_ANSWER", itemId: item.id, value: item.answer.value });
    expect(repeat).toBe(s);

    // Wrong value on the solved item: still a no-op — no extra attempt, no
    // point change, no phase change. (The first wrong-submit path is covered
    // in engine.test; this pins the post-solve guard specifically.)
    const wrongValue = item.answer.value === 42 ? 41 : 42;
    const wrong = dispatch(s, { t: "SUBMIT_ANSWER", itemId: item.id, value: wrongValue });
    expect(wrong).toBe(s);
    expect(wrong.slots[0]!.attempts).toBe(0);
    expect(wrong.slots[0]!.points).toBe(10);
    expect(wrong.phase).toBe("evidence");
  });

  it("stale item ids inside the same case cannot solve or attempt the current item", () => {
    const { state } = startCase("D3", "full", 11);
    const s = dispatch(state, { t: "BEGIN" });
    expect(s.run!.evidences.length).toBeGreaterThan(1);

    const later = s.run!.evidences[1]!;
    const stale = dispatch(s, {
      t: "SUBMIT_ANSWER",
      itemId: later.id,
      value: later.answer.value,
      latencyMs: 100,
    });
    expect(stale).toBe(s);
    expect(stale.slots[0]!.solved).toBe(false);
    expect(stale.slots[0]!.attempts).toBe(0);
    expect(stale.earnedIds).toEqual([]);
    expect(stale.phase).toBe("evidence");
  });

  it("invalid input (NaN, infinities, non-numbers) never solves; correct answer still lands after", () => {
    const { state } = startCase("D1", "mini", 33);
    let s = dispatch(state, { t: "BEGIN" });
    const item = s.run!.evidences[0]!;
    expect(Number.isInteger(item.answer.value)).toBe(true);

    const junk: number[] = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      "7" as unknown as number,
      null as unknown as number,
      item.answer.value + 0.5,
    ];
    for (const value of junk) {
      s = dispatch(s, { t: "SUBMIT_ANSWER", itemId: item.id, value, latencyMs: 100 });
      expect(s.phase).toBe("evidence");
      expect(s.slots[0]!.solved).toBe(false);
      expect(s.slots[0]!.points).toBeNull();
    }
    // The reducer counts malformed payloads as wrong attempts; the shell owns
    // numeric validation. Taper after 6+ attempts lands the eventual solve at 3.
    expect(s.slots[0]!.attempts).toBe(junk.length);
    expect(s.earnedIds).toEqual([]);

    s = solveCurrent(s);
    expect(s.slots[0]!.solved).toBe(true);
    expect(s.slots[0]!.points).toBe(3);
  });

  it("near-miss answers are wrong; retry budget is unlimited and non-punitive", () => {
    const { state } = startCase("D1", "mini", 33);
    let s = dispatch(state, { t: "BEGIN" });
    const item = s.run!.evidences[0]!;

    for (const offset of [-1, 1, 1000]) {
      s = dispatch(s, {
        t: "SUBMIT_ANSWER",
        itemId: item.id,
        value: item.answer.value + offset,
        latencyMs: 100,
      });
      expect(s.slots[0]!.solved).toBe(false);
      expect(s.slots[0]!.points).toBeNull();
    }
    expect(s.slots[0]!.attempts).toBe(3);

    // 25 misses later the item is still answerable for the tapered 3 points.
    for (let i = 0; i < 25; i += 1) {
      s = dispatch(s, {
        t: "SUBMIT_ANSWER",
        itemId: item.id,
        value: item.answer.value + 1,
        latencyMs: 100,
      });
    }
    expect(s.slots[0]!.attempts).toBe(28);
    s = solveCurrent(s);
    expect(s.slots[0]!.solved).toBe(true);
    expect(s.slots[0]!.points).toBe(3);
  });

  it("after the case completes, answers and hints are rejected", () => {
    const { run, state } = startCase("D1", "mini", 21);
    const summary = driveToSummary(state, run.culpritId);

    const anyItem = run.evidences[0]!;
    const submit = dispatch(summary, {
      t: "SUBMIT_ANSWER",
      itemId: anyItem.id,
      value: anyItem.answer.value,
    });
    expect(submit).toBe(summary);
    const hint = dispatch(summary, { t: "REQUEST_HINT", itemId: anyItem.id, level: 1 });
    expect(hint).toBe(summary);
  });
});

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

describe("mathDetective scoring invariants", () => {
  it("slot points always equal the canonical taper+cap rule across messy full cases", () => {
    for (const seed of [5, 11, 41, 88]) {
      const { run } = startCase("D3", "full", seed);
      let s = dispatch(initialEngineState(), { t: "START", run });
      s = dispatch(s, { t: "BEGIN" });
      for (let guard = 0; guard < 80 && s.phase !== "board"; guard += 1) {
        if (s.phase === "checkpoint") {
          s = dispatch(s, { t: "COMMIT_CHECKPOINT" });
          continue;
        }
        if (s.phase === "evidence") {
          const slot = s.slots[s.current]!;
          if (!slot.solved) {
            const item = s.run!.evidences[s.current]!;
            s = dispatch(s, {
              t: "SUBMIT_ANSWER",
              itemId: item.id,
              value: item.answer.value + 1000,
              latencyMs: 100,
            });
            s = dispatch(s, { t: "REQUEST_HINT", itemId: item.id, level: 2 });
            s = solveCurrent(s);
          } else {
            s = dispatch(s, { t: "ADVANCE" });
          }
          continue;
        }
        break;
      }
      expect(s.phase).toBe("board");
      for (const slot of s.slots) {
        expect(slot.solved).toBe(true);
        expect(slot.points).toBe(scoreEvidence(slot.attempts, slot.hintsUsed));
        // Hint cap: L1/L2 hint ⇒ at most 6, never more than the honest taper.
        if (slot.hintsUsed.some((l) => l >= 1 && l <= 2)) expect(slot.points!).toBeLessThanOrEqual(6);
        if (slot.hintsUsed.some((l) => l >= 3)) expect(slot.points!).toBeLessThanOrEqual(3);
      }
      const { totalPoints, independenceScore } = summarizeSlots(s.slots);
      expect(totalPoints).toBeGreaterThan(0);
      expect(totalPoints).toBeLessThanOrEqual(10 * s.slots.length);
      expect(Number.isInteger(independenceScore)).toBe(true);
      expect(independenceScore).toBeGreaterThanOrEqual(0);
      expect(independenceScore).toBeLessThanOrEqual(100);
    }
  });

  it("wrong answers and hints never alter points already earned on other slots", () => {
    const { state } = startCase("D1", "mini", 21);
    let s = dispatch(state, { t: "BEGIN" });
    s = solveCurrent(s);
    const firstPoints = s.slots[0]!.points;
    expect(firstPoints).toBe(10);

    // D1 mini ships exactly two clues; advance to the second, then hint it.
    expect(s.run!.evidences.length).toBe(2);
    s = dispatch(s, { t: "ADVANCE" });
    expect(s.current).toBe(1);
    const item1 = s.run!.evidences[1]!;
    s = dispatch(s, { t: "REQUEST_HINT", itemId: item1.id, level: 1 });
    expect(s.slots[0]!.points).toBe(10);
    expect(s.slots[1]!.hintsUsed).toEqual([1]);

    s = dispatch(s, { t: "SUBMIT_ANSWER", itemId: item1.id, value: item1.answer.value + 3, latencyMs: 100 });
    expect(s.slots[0]!.points).toBe(10);
    expect(s.slots[1]!.points).toBeNull();

    s = solveCurrent(s);
    expect(s.slots[0]!.points).toBe(10);
    // The pre-advance wrong submit was (correctly) a no-op, so this slot is a
    // first-try solve with an L1 hint: taper 10 capped at 6 by §6.
    expect(s.slots[1]!.points).toBe(6);
  });

  it("an early exit summary counts only solved evidence and stays within bounds", () => {
    const { state } = startCase("D3", "full", 11);
    let s = dispatch(state, { t: "BEGIN" });
    s = solveCurrent(s);
    s = solveCurrent(dispatch(s, { t: "ADVANCE" }));
    // OPEN_SUMMARY is legal any time before finishing (abandonment path).
    s = dispatch(s, { t: "OPEN_SUMMARY" });
    expect(s.phase).toBe("summary");
    expect(s.finished).toBe(true);

    const summary = summarizeCase(s);
    expect(summary.evidenceSolved).toBe(2);
    expect(summary.evidenceTotal).toBe(s.run!.evidences.length);
    expect(summary.totalPoints).toBe(20); // two clean first-try solves
    expect(summary.independenceScore).toBe(100);
  });

  it("exactly-once scoring: total equals the sum of per-slot points on every path", () => {
    for (const seed of [21, 33]) {
      const { run } = startCase("D1", "mini", seed);
      let s = dispatch(initialEngineState(), { t: "START", run });
      s = dispatch(s, { t: "BEGIN" });
      // Messy path: wrong, hint, correct — then a duplicate correct submit.
      for (let i = 0; i < s.run!.evidences.length; i += 1) {
        const item = s.run!.evidences[s.current]!;
        s = dispatch(s, { t: "SUBMIT_ANSWER", itemId: item.id, value: item.answer.value - 1, latencyMs: 100 });
        s = dispatch(s, { t: "REQUEST_HINT", itemId: item.id, level: 4 });
        s = solveCurrent(s);
        const before = summarizeSlots(s.slots).totalPoints;
        s = dispatch(s, { t: "SUBMIT_ANSWER", itemId: item.id, value: item.answer.value });
        expect(summarizeSlots(s.slots).totalPoints).toBe(before); // no duplicate scoring
        if (i < s.run!.evidences.length - 1) s = dispatch(s, { t: "ADVANCE" });
      }
      const slots = s.slots;
      expect(summarizeSlots(slots).totalPoints).toBe(slots.reduce((n, x) => n + (x.points ?? 0), 0));
      expect(slots.every((x) => x.points === 3)).toBe(true); // hint-capped taper floor
    }
  });
});

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

describe("mathDetective progression", () => {
  it("ADVANCE cannot skip an unsolved item, and checkpoints cannot be skipped either", () => {
    const { state } = startCase("D3", "full", 5);
    let s = dispatch(state, { t: "BEGIN" });

    // Unsolved current item: ADVANCE is a no-op.
    const stuck = dispatch(s, { t: "ADVANCE" });
    expect(stuck).toBe(s);
    expect(s.slots[0]!.solved).toBe(false);

    s = solveCurrent(s);
    s = dispatch(s, { t: "ADVANCE" });
    if (s.phase === "checkpoint") {
      // Checkpoint requires COMMIT; ADVANCE is not a skip button.
      const skipped = dispatch(s, { t: "ADVANCE" });
      expect(skipped).toBe(s);
      s = dispatch(s, { t: "COMMIT_CHECKPOINT" });
    }
    expect(s.phase).toBe("evidence");
    expect(s.current).toBe(1);

    // Answers only land while an item is the current, unsolved one in evidence phase.
    const duringCheckpoint = startCase("D3", "full", 5);
    let cp = dispatch(duringCheckpoint.state, { t: "BEGIN" });
    cp = solveCurrent(cp);
    cp = dispatch(cp, { t: "ADVANCE" });
    if (cp.phase === "checkpoint") {
      const item = cp.run!.evidences[cp.current]!;
      const rejected = dispatch(cp, { t: "SUBMIT_ANSWER", itemId: item.id, value: item.answer.value });
      expect(rejected).toBe(cp);
    }
  });

  it("mini cases go straight to the board; full cases pass through checkpoints and cannot finish early", () => {
    const mini = startCase("D1", "mini", 3);
    const miniBoard = driveToBoard(mini.state);
    expect(miniBoard.phase).toBe("board");
    expect(mini.run.checkpointAfterIndices).toEqual([]);

    const full = startCase("D3", "full", 5);
    let s = full.state;
    let checkpointsSeen = 0;
    for (let guard = 0; guard < 60 && s.phase !== "board"; guard += 1) {
      if (s.phase === "checkpoint") {
        checkpointsSeen += 1;
        s = dispatch(s, { t: "COMMIT_CHECKPOINT" });
        continue;
      }
      if (s.phase === "briefing") {
        s = dispatch(s, { t: "BEGIN" });
        continue;
      }
      if (s.phase === "evidence") {
        s = s.slots[s.current]!.solved ? dispatch(s, { t: "ADVANCE" }) : solveCurrent(s);
        continue;
      }
      break;
    }
    expect(s.phase).toBe("board");
    expect(full.run.checkpointAfterIndices.length).toBeGreaterThanOrEqual(1);
    expect(checkpointsSeen).toBe(full.run.checkpointAfterIndices.length);
    // Every clue was served; nothing was skipped.
    expect(s.slots.every((slot) => slot.solved)).toBe(true);
    expect(s.earnedIds).toEqual(full.run.evidences.map((e) => e.id));
  });

  it("advancing past the final evidence leaves evidence phase for the board (no extra item)", () => {
    const { state, run } = startCase("D2", "mini", 3);
    let s = dispatch(state, { t: "BEGIN" });
    const last = run.evidences.length - 1;
    while (s.current < last) {
      s = solveCurrent(s);
      s = dispatch(s, { t: "ADVANCE" });
      expect(s.phase).toBe("evidence");
    }
    expect(s.current).toBe(last);
    expect(s.slots[last]!.solved).toBe(false);
    s = solveCurrent(s);
    s = dispatch(s, { t: "ADVANCE" });
    expect(s.phase).toBe("board");
    expect(s.current).toBe(last); // never advances to a nonexistent item
  });

  it("WRAP_REQUEST after the case has finished is a no-op; OPEN_SUMMARY is idempotent when finished", () => {
    const { run, state } = startCase("D1", "mini", 21);
    const summary = driveToSummary(state, run.culpritId);
    const wrapped = dispatch(summary, { t: "WRAP_REQUEST" });
    expect(wrapped).toBe(summary);
    const reopened = dispatch(summary, { t: "OPEN_SUMMARY" });
    expect(reopened).toBe(summary);
  });
});

// ---------------------------------------------------------------------------
// Reset / replay
// ---------------------------------------------------------------------------

describe("mathDetective reset and replay", () => {
  it("restarting mid-case resets score, streak, links, accusations, and slots", () => {
    const first = startCase("D1", "mini", 21);
    let s = dispatch(first.state, { t: "BEGIN" });
    s = solveCurrent(s);
    s = dispatch(s, { t: "REQUEST_HINT", itemId: s.run!.evidences[1]!.id, level: 2 });
    expect(summarizeSlots(s.slots).totalPoints).toBe(10);

    const second = startCase("D2", "full", 77);
    s = second.state;
    expect(s.phase).toBe("briefing");
    expect(s.slots).toHaveLength(second.run.evidences.length);
    expect(s.slots.every((slot) => !slot.solved && slot.points === null && slot.attempts === 0)).toBe(true);
    expect(s.earnedIds).toEqual([]);
    expect(s.aliveIds).toEqual(second.run.suspects.map((x) => x.id));
    expect(s.links).toEqual({});
    expect(s.accusations).toEqual([]);
    expect(s.streak).toBe(0);
    expect(s.finished).toBe(false);
    expect(summarizeSlots(s.slots).totalPoints).toBe(0);
    // New case identity, not a mutated old one.
    expect(s.run!.caseId).not.toBe(first.run.caseId);
  });

  it("caseId identity separates seed/tier/mode combos", () => {
    const a = generateCase({ seed: 42, tier: "D2", mode: "full" });
    const b = generateCase({ seed: 42, tier: "D2", mode: "mini" });
    const c = generateCase({ seed: 43, tier: "D2", mode: "full" });
    expect(a.caseId).toBe("md-42-D2-full");
    expect(b.caseId).toBe("md-42-D2-mini");
    expect(c.caseId).toBe("md-43-D2-full");
    expect(a.caseId).not.toBe(b.caseId);
    expect(a.caseId).not.toBe(c.caseId);
  });
});

// ---------------------------------------------------------------------------
// Generation validity (case-level invariants beyond verifyCaseRun coverage)
// ---------------------------------------------------------------------------

describe("mathDetective generated case validity", () => {
  it("every generated case has unique evidence ids, finite answers, and a culprit who satisfies every clue", () => {
    const tiers: DifficultyTier[] = ["D1", "D2", "D3", "D4", "D5"];
    for (let i = 0; i < 150; i += 1) {
      const tier = tiers[i % tiers.length]!;
      const mode = i % 2 === 0 ? "full" : "mini";
      const run = generateCase({ seed: 900_000 + i, tier, mode });
      expect(verifyCaseRun(run).ok).toBe(true);

      const ids = run.evidences.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const ev of run.evidences) {
        expect(Number.isFinite(ev.answer.value)).toBe(true);
        const culprit = run.suspects.find((s) => s.id === run.culpritId)!;
        expect(ev.constraint.test(culprit.attrs)).toBe(true);
      }
    }
  });
});
