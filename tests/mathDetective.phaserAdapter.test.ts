import { beforeEach, describe, expect, it } from "vitest";
import { generateCase } from "@/lib/mathDetective/solver";
import { resetResumeForTests, takeResume } from "@/lib/mathDetective/resume";
import {
  PHASER_PINNED_VERSION,
  createFakePhaserRuntime,
  createMathDetectiveHostAdapter,
  isDeterministicFocusTarget,
  planFocusTransition,
  runFoundationHarness,
} from "@/lib/mathDetective/phaser";
import { projectScene } from "@/lib/mathDetective/scene";

const SESSION = "sess-md-138";
const NOW = 1_700_000_000_000;

beforeEach(() => resetResumeForTests());

describe("mathDetective Phaser host adapter (GAME-138)", () => {
  it("pins Phaser 4.x for the foundation runtime", () => {
    expect(PHASER_PINNED_VERSION.startsWith("4.")).toBe(true);
  });

  it("runs the foundation harness: briefing → station → challenge → clue → deduction", () => {
    const run = generateCase({ seed: 42, tier: "D3", mode: "mini" });
    const { steps, adapter } = runFoundationHarness(run, SESSION);
    expect(steps[0]!.sceneLocation).toBe("briefing");
    expect(steps.find((s) => s.name === "after-station-select")).toBeTruthy();
    expect(steps.find((s) => s.name === "after-open-challenge")!.overlay).toBe("challenge");
    const afterResult = steps.find((s) => s.name === "after-simulated-challenge-result")!;
    expect(afterResult.earnedIds.length).toBe(1);
    expect(afterResult.overlay).toBe("result");
    const afterReveal = steps.find((s) => s.name === "after-clue-reveal-complete")!;
    expect(afterReveal.overlay).toBe("none");
    const deduction = steps.find((s) => s.name === "deduction-state")!;
    expect(deduction.sceneLocation).toBe("deductionBoard");
    expect(adapter.getState().phase).toBe("board");
    expect(adapter.getScene().deduction.earnedConstraintIds.length).toBe(run.evidences.length);
    adapter.destroy();
  });

  it("drops stale generation intents after a new case starts", () => {
    const runtime = createFakePhaserRuntime();
    const adapter = createMathDetectiveHostAdapter({
      sessionId: SESSION,
      runtime,
      parent: {} as HTMLElement,
      now: () => NOW,
    });
    const runA = generateCase({ seed: 1, tier: "D2", mode: "mini" });
    adapter.startCase(runA);
    const genA = adapter.generation;
    adapter.handleIntent({
      t: "continue",
      sessionId: SESSION,
      generation: genA,
      caseId: runA.caseId,
    });

    const runB = generateCase({ seed: 2, tier: "D2", mode: "mini" });
    adapter.startCase(runB);
    const stale = adapter.handleIntent({
      t: "continue",
      sessionId: SESSION,
      generation: genA,
      caseId: runA.caseId,
    });
    expect(stale.accepted).toBe(false);
    expect(stale.reason).toMatch(/stale/);
    expect(adapter.getState().phase).toBe("briefing");
    expect(adapter.getState().run?.caseId).toBe(runB.caseId);
    adapter.destroy();
  });

  it("rejects duplicate clue reveal via presentationComplete and re-submit", () => {
    const runtime = createFakePhaserRuntime();
    const adapter = createMathDetectiveHostAdapter({
      sessionId: SESSION,
      runtime,
      parent: {} as HTMLElement,
      now: () => NOW,
    });
    const run = generateCase({ seed: 7, tier: "D3", mode: "mini" });
    adapter.startCase(run);
    adapter.handleIntent({
      t: "continue",
      sessionId: SESSION,
      generation: adapter.generation,
      caseId: run.caseId,
    });
    const id = run.evidences[0]!.id;
    adapter.simulateChallengeResult(id, true);
    expect(adapter.getState().earnedIds).toEqual([id]);
    adapter.handleIntent({
      t: "presentationComplete",
      token: "reveal",
      sessionId: SESSION,
      generation: adapter.generation,
      caseId: run.caseId,
    });
    adapter.handleIntent({
      t: "presentationComplete",
      token: "reveal-dup",
      sessionId: SESSION,
      generation: adapter.generation,
      caseId: run.caseId,
    });
    adapter.simulateChallengeResult(id, true);
    expect(adapter.getState().earnedIds).toEqual([id]);
    adapter.destroy();
  });

  it("teardown clears runtime and bumps generation so remount is fresh", () => {
    const runtime = createFakePhaserRuntime();
    const adapter = createMathDetectiveHostAdapter({
      sessionId: SESSION,
      runtime,
      parent: {} as HTMLElement,
      now: () => NOW,
    });
    const run = generateCase({ seed: 3, tier: "D1", mode: "mini" });
    adapter.startCase(run);
    const gen = adapter.generation;
    adapter.destroy();
    expect(runtime.destroyedCount).toBeGreaterThanOrEqual(1);
    expect(adapter.generation).toBeGreaterThan(gen);
    const rejected = adapter.handleIntent({
      t: "continue",
      sessionId: SESSION,
      generation: adapter.generation,
      caseId: run.caseId,
    });
    expect(rejected.accepted).toBe(false);
    expect(rejected.reason).toBe("destroyed");
  });

  it("reload/resume reconstructs scene from engine state", () => {
    const runtime = createFakePhaserRuntime();
    const adapter = createMathDetectiveHostAdapter({
      sessionId: SESSION,
      runtime,
      parent: {} as HTMLElement,
      now: () => NOW,
    });
    const run = generateCase({ seed: 11, tier: "D3", mode: "mini" });
    adapter.startCase(run);
    adapter.handleIntent({
      t: "continue",
      sessionId: SESSION,
      generation: adapter.generation,
      caseId: run.caseId,
    });
    adapter.simulateChallengeResult(run.evidences[0]!.id, true);
    const snap = takeResume();
    expect(snap).not.toBeNull();

    const runtime2 = createFakePhaserRuntime();
    const adapter2 = createMathDetectiveHostAdapter({
      sessionId: "sess-resume",
      runtime: runtime2,
      parent: {} as HTMLElement,
      now: () => NOW,
    });
    adapter2.restore(snap!.run, snap!.engine);
    expect(adapter2.getState().earnedIds).toEqual(snap!.engine.earnedIds);
    expect(adapter2.getScene().completedStationIds).toContain(run.evidences[0]!.id);
    adapter.destroy();
    adapter2.destroy();
  });

  it("out-of-order presentationComplete cannot advance authoritative state", () => {
    const runtime = createFakePhaserRuntime();
    const adapter = createMathDetectiveHostAdapter({
      sessionId: SESSION,
      runtime,
      parent: {} as HTMLElement,
      now: () => NOW,
    });
    const run = generateCase({ seed: 19, tier: "D2", mode: "mini" });
    adapter.startCase(run);
    const before = adapter.getState();
    adapter.handleIntent({
      t: "presentationComplete",
      token: "early",
      sessionId: SESSION,
      generation: adapter.generation,
      caseId: run.caseId,
    });
    expect(adapter.getState().phase).toBe(before.phase);
    expect(adapter.getState().earnedIds).toEqual([]);
    expect(adapter.getState().current).toBe(before.current);
    adapter.destroy();
  });

  it("duplicate accusation intents are dropped after the case settles", () => {
    const run = generateCase({ seed: 42, tier: "D3", mode: "mini" });
    const { adapter } = runFoundationHarness(run, "accuse-dup");
    expect(adapter.getState().phase).toBe("board");
    const culprit = run.culpritId;
    const first = adapter.handleIntent({
      t: "accuse",
      suspectId: culprit,
      linkedCount: 2,
      sessionId: "accuse-dup",
      generation: adapter.generation,
      caseId: run.caseId,
    });
    expect(first.accepted).toBe(true);
    expect(adapter.getState().phase).toBe("verdict");
    expect(adapter.getState().outcome).toBe("closed");
    expect(adapter.getState().accusations).toHaveLength(1);
    const second = adapter.handleIntent({
      t: "accuse",
      suspectId: culprit,
      linkedCount: 2,
      sessionId: "accuse-dup",
      generation: adapter.generation,
      caseId: run.caseId,
    });
    expect(second.accepted).toBe(false);
    expect(second.reason).toMatch(/accuse-already-settled/);
    expect(adapter.getState().outcome).toBe("closed");
    expect(adapter.getState().accusations).toHaveLength(1);
    adapter.destroy();
  });

  it("remount bumps generation and drops pre-remount intents", () => {
    const runtime = createFakePhaserRuntime();
    const adapter = createMathDetectiveHostAdapter({
      sessionId: SESSION,
      runtime,
      parent: {} as HTMLElement,
      now: () => NOW,
    });
    const run = generateCase({ seed: 11, tier: "D2", mode: "mini" });
    adapter.startCase(run);
    const genBefore = adapter.generation;
    const destroyedBefore = runtime.destroyedCount;
    adapter.remount({} as HTMLElement);
    expect(adapter.generation).toBe(genBefore + 1);
    expect(runtime.destroyedCount).toBe(destroyedBefore + 1);
    expect(runtime.lastScene?.casePhase).toBe("briefing");
    const stale = adapter.handleIntent({
      t: "continue",
      sessionId: SESSION,
      generation: genBefore,
      caseId: run.caseId,
    });
    expect(stale.accepted).toBe(false);
    expect(stale.reason).toMatch(/stale/);
    expect(adapter.getState().phase).toBe("briefing");
    const fresh = adapter.handleIntent({
      t: "continue",
      sessionId: SESSION,
      generation: adapter.generation,
      caseId: run.caseId,
    });
    expect(fresh.accepted).toBe(true);
    expect(adapter.getState().phase).toBe("evidence");
    adapter.destroy();
  });

  it("focus boundary restores to a deterministic world station target", () => {
    const run = generateCase({ seed: 5, tier: "D3", mode: "mini" });
    const state = createMathDetectiveHostAdapter({
      sessionId: SESSION,
      runtime: createFakePhaserRuntime(),
      now: () => NOW,
    });
    state.startCase(run);
    state.handleIntent({
      t: "continue",
      sessionId: SESSION,
      generation: state.generation,
      caseId: run.caseId,
    });
    const withChallenge = projectScene(state.getState(), {
      sessionId: SESSION,
      generation: state.generation,
      overlay: "challenge",
    });
    const open = planFocusTransition(withChallenge, "challenge");
    expect(open.to).toBe("overlay.challenge");
    expect(isDeterministicFocusTarget(open.to)).toBe(true);
    const close = planFocusTransition(withChallenge, "none");
    expect(close.to).toBe(`world.station.${run.evidences[0]!.id}`);
    expect(isDeterministicFocusTarget(close.to)).toBe(true);
    state.destroy();
  });

  it("changes responsive presentation without resetting engine state or generation", () => {
    const runtime = createFakePhaserRuntime();
    const adapter = createMathDetectiveHostAdapter({
      sessionId: SESSION,
      runtime,
      now: () => NOW,
      layoutMode: "desktop",
      parent: {} as HTMLElement,
    });
    const run = generateCase({ seed: 42, tier: "D3", mode: "mini" });
    adapter.startCase(run);
    const generation = adapter.generation;
    const before = adapter.getState();

    adapter.setPresentationOptions({
      layoutMode: "phonePortrait",
      reducedMotion: true,
      captionsEnabled: false,
    });

    expect(adapter.generation).toBe(generation);
    expect(adapter.getState()).toBe(before);
    expect(adapter.getScene().layoutMode).toBe("phonePortrait");
    expect(adapter.getScene().animation.reducedMotion).toBe(true);
    expect(adapter.getScene().animation.captionsEnabled).toBe(false);
    expect(runtime.lastScene?.world.setting.id).toBe(run.narrative.settingId);
    adapter.destroy();
  });
});


