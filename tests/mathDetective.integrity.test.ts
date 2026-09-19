import { beforeEach, describe, expect, it } from "vitest";
import {
  initialEngineState,
  reduce,
  summarizeCase,
  type EngineAction,
  type EngineState,
} from "@/lib/mathDetective/engine";
import { generateCase } from "@/lib/mathDetective/solver";
import {
  clearResume,
  resetResumeForTests,
  saveResume,
  takeResume,
} from "@/lib/mathDetective/resume";
import { projectCase } from "@/lib/mathDetective/golden/project";

const T = 1_700_000_000_000;

function dispatch(state: EngineState, action: EngineAction): EngineState {
  return reduce(state, action, T).state;
}

function start(tier: "D1" | "D3" = "D3", seed = 11, mode: "mini" | "full" = "full") {
  const run = generateCase({ seed, tier, mode });
  let s = initialEngineState();
  s = dispatch(s, { t: "START", run });
  return { run, state: s };
}

function solveCurrent(s: EngineState): EngineState {
  const item = s.run!.evidences[s.current]!;
  return dispatch(s, {
    t: "SUBMIT_ANSWER",
    itemId: item.id,
    value: item.answer.value,
    latencyMs: 900,
  });
}

beforeEach(() => resetResumeForTests());

describe("mathDetective integrity regressions (GAME-136)", () => {
  it("evidence is revealed (earned) exactly once per item", () => {
    const { state, run } = start("D3", 5);
    let s = dispatch(state, { t: "BEGIN" });
    const item = run.evidences[0]!;
    s = dispatch(s, {
      t: "SUBMIT_ANSWER",
      itemId: item.id,
      value: item.answer.value,
      latencyMs: 500,
    });
    expect(s.earnedIds).toEqual([item.id]);
    expect(s.slots[0]!.solved).toBe(true);
    // Second correct submit for the same solved item is a no-op.
    const again = dispatch(s, {
      t: "SUBMIT_ANSWER",
      itemId: item.id,
      value: item.answer.value,
      latencyMs: 500,
    });
    expect(again.earnedIds).toEqual([item.id]);
    expect(again.slots[0]!.points).toBe(s.slots[0]!.points);
    expect(again.aliveIds).toEqual(s.aliveIds);
  });

  it("solving a clue once then advancing does not double-earn that clue", () => {
    const { state, run } = start("D3", 9);
    let s = dispatch(state, { t: "BEGIN" });
    const firstId = run.evidences[0]!.id;
    s = solveCurrent(s);
    expect(s.earnedIds).toEqual([firstId]);
    expect(s.slots[0]!.solved).toBe(true);
    const points = s.slots[0]!.points;
    const aliveAfterEarn = [...s.aliveIds];

    s = dispatch(s, { t: "ADVANCE" });
    // Whether we land on checkpoint or the next evidence, the first clue stays earned once.
    expect(s.earnedIds.filter((id) => id === firstId)).toHaveLength(1);
    expect(s.slots[0]!.points).toBe(points);
    expect(s.aliveIds).toEqual(aliveAfterEarn);

    // Re-submitting the already-earned item id cannot append a duplicate earn.
    const resubmit = dispatch(s, {
      t: "SUBMIT_ANSWER",
      itemId: firstId,
      value: run.evidences[0]!.answer.value,
      latencyMs: 100,
    });
    expect(resubmit.earnedIds.filter((id) => id === firstId)).toHaveLength(1);
    expect(resubmit.slots[0]!.points).toBe(points);
  });

  it("wrong accusation does not corrupt aliveIds, earned evidence, or links", () => {
    const { state, run } = start("D3", 21);
    let s = dispatch(state, { t: "BEGIN" });
    // Solve all evidence to reach the board.
    for (let guard = 0; guard < 60; guard += 1) {
      if (s.phase === "board") break;
      if (s.phase === "checkpoint") {
        s = dispatch(s, { t: "COMMIT_CHECKPOINT" });
        continue;
      }
      if (s.phase === "evidence") {
        if (!s.slots[s.current]!.solved) s = solveCurrent(s);
        else s = dispatch(s, { t: "ADVANCE" });
        continue;
      }
      break;
    }
    expect(s.phase).toBe("board");
    const snapshot = {
      aliveIds: [...s.aliveIds],
      earnedIds: [...s.earnedIds],
      links: { ...s.links },
      slots: s.slots.map((x) => ({ ...x, hintsUsed: [...x.hintsUsed] })),
    };
    const wrong = run.suspects.find((x) => x.id !== run.culpritId)!;
    s = dispatch(s, { t: "ACCUSE", suspectId: wrong.id, linkedCount: 2 });
    expect(s.phase).toBe("verdict");
    expect(s.outcome).toBeNull();
    expect(s.aliveIds).toEqual(snapshot.aliveIds);
    expect(s.earnedIds).toEqual(snapshot.earnedIds);
    expect(s.links).toEqual(snapshot.links);
    expect(s.slots).toEqual(snapshot.slots);
    s = dispatch(s, { t: "RETRY_FROM_VERDICT" });
    expect(s.phase).toBe("board");
    expect(s.aliveIds).toEqual(snapshot.aliveIds);
    expect(s.earnedIds).toEqual(snapshot.earnedIds);
  });

  it("reload/resume reconstructs the same authoritative engine state", () => {
    const { state, run } = start("D3", 33, "mini");
    let s = dispatch(state, { t: "BEGIN" });
    s = solveCurrent(s);
    saveResume(run, s);
    const snap = takeResume();
    expect(snap).not.toBeNull();
    expect(snap!.engine.phase).toBe(s.phase);
    expect(snap!.engine.current).toBe(s.current);
    expect(snap!.engine.earnedIds).toEqual(s.earnedIds);
    expect(snap!.engine.aliveIds).toEqual(s.aliveIds);
    expect(projectCase(snap!.run)).toEqual(projectCase(run));
    // Resumed state continues from the same slot without re-earning.
    let resumed = snap!.engine;
    if (!resumed.slots[resumed.current]!.solved) {
      resumed = solveCurrent(resumed);
    } else {
      resumed = dispatch(resumed, { t: "ADVANCE" });
    }
    expect(resumed.earnedIds[0]).toBe(run.evidences[0]!.id);
    clearResume();
  });

  it("stale callbacks cannot advance a subsequent case/session", () => {
    const first = start("D3", 7, "mini");
    const s1 = dispatch(first.state, { t: "BEGIN" });
    const staleItemId = first.run.evidences[0]!.id;
    const staleValue = first.run.evidences[0]!.answer.value;

    // Start a different case (new session).
    const second = start("D3", 99, "mini");
    let s2 = dispatch(second.state, { t: "BEGIN" });
    expect(s2.run!.caseId).not.toBe(first.run.caseId);

    // Stale submit for previous case item id must not solve the new current item.
    const afterStale = dispatch(s2, {
      t: "SUBMIT_ANSWER",
      itemId: staleItemId,
      value: staleValue,
      latencyMs: 100,
    });
    expect(afterStale.slots[0]!.solved).toBe(false);
    expect(afterStale.earnedIds).toEqual([]);
    expect(afterStale.phase).toBe("evidence");

    // Correct current-case submit still works.
    s2 = solveCurrent(afterStale);
    expect(s2.slots[0]!.solved).toBe(true);
    expect(s2.earnedIds).toEqual([second.run.evidences[0]!.id]);
    void s1;
  });

  it("scoring remains deterministic for identical action traces", () => {
    const replay = (seed: number) => {
      const run = generateCase({ seed, tier: "D2", mode: "full" });
      let s = initialEngineState();
      s = dispatch(s, { t: "START", run });
      s = dispatch(s, { t: "BEGIN" });
      for (let guard = 0; guard < 80; guard += 1) {
        if (s.phase === "board") break;
        if (s.phase === "checkpoint") {
          s = dispatch(s, { t: "COMMIT_CHECKPOINT" });
          continue;
        }
        if (s.phase === "evidence") {
          const slot = s.slots[s.current]!;
          const item = s.run!.evidences[s.current]!;
          if (!slot.solved) {
            s = dispatch(s, {
              t: "SUBMIT_ANSWER",
              itemId: item.id,
              value: item.answer.value + 5,
              latencyMs: 400,
            });
            s = dispatch(s, { t: "REQUEST_HINT", itemId: item.id, level: 2 });
            s = dispatch(s, {
              t: "SUBMIT_ANSWER",
              itemId: item.id,
              value: item.answer.value,
              latencyMs: 900,
            });
          } else {
            s = dispatch(s, { t: "ADVANCE" });
          }
          continue;
        }
        break;
      }
      s = dispatch(s, { t: "ACCUSE", suspectId: run.culpritId, linkedCount: 2 });
      s = dispatch(s, { t: "OPEN_SUMMARY" });
      return {
        summary: summarizeCase(s),
        slots: s.slots.map((x) => ({
          itemId: x.itemId,
          attempts: x.attempts,
          hintsUsed: [...x.hintsUsed],
          points: x.points,
        })),
        earnedIds: [...s.earnedIds],
      };
    };
    expect(replay(88)).toEqual(replay(88));
    expect(replay(88)).not.toEqual(replay(89));
  });
});


