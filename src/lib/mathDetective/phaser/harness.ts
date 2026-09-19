/**
 * Foundation harness proving GAME-138 sync without GAME-139 polish.
 *
 * Flow: briefing → station select → openChallenge → simulated engine grade →
 * clue reveal presentation → deduction-state update.
 */
import type { CaseRun } from "../types";
import {
  createFakePhaserRuntime,
  createMathDetectiveHostAdapter,
  type HostAdapter,
} from "./hostAdapter";

export interface HarnessStep {
  name: string;
  sceneLocation: string;
  presentationPhase: string;
  earnedIds: string[];
  aliveCount: number;
  overlay: string;
  focusTarget: string;
}

export interface HarnessResult {
  adapter: HostAdapter;
  steps: HarnessStep[];
  runtime: ReturnType<typeof createFakePhaserRuntime>;
}

function snapshot(adapter: HostAdapter, name: string): HarnessStep {
  const scene = adapter.getScene();
  const state = adapter.getState();
  return {
    name,
    sceneLocation: scene.location,
    presentationPhase: scene.presentationPhase,
    earnedIds: [...state.earnedIds],
    aliveCount: state.aliveIds.length,
    overlay: scene.overlay,
    focusTarget: scene.focusTarget,
  };
}

export function runFoundationHarness(run: CaseRun, sessionId = "harness-md-138"): HarnessResult {
  const runtime = createFakePhaserRuntime();
  const parent = { id: "fake-parent" } as unknown as HTMLElement;
  const adapter = createMathDetectiveHostAdapter({
    sessionId,
    runtime,
    parent,
    now: () => 1_700_000_000_000,
    challengeResponder: ({ evidenceId, simulateCorrect }) => {
      const item = adapter.getState().run?.evidences.find((e) => e.id === evidenceId);
      if (!item) return null;
      return {
        value: simulateCorrect === false ? item.answer.value + 1 : item.answer.value,
      };
    },
  });
  runtime.intentHandler = (intent) => {
    adapter.handleIntent(intent);
  };

  const steps: HarnessStep[] = [];
  adapter.startCase(run);
  steps.push(snapshot(adapter, "after-start-briefing"));

  const caseId = run.caseId;
  const firstId = run.evidences[0]!.id;

  adapter.handleIntent({
    t: "continue",
    sessionId,
    generation: adapter.generation,
    caseId,
  });
  steps.push(snapshot(adapter, "after-briefing-continue"));

  adapter.handleIntent({
    t: "enterStation",
    evidenceId: firstId,
    sessionId,
    generation: adapter.generation,
    caseId,
  });
  steps.push(snapshot(adapter, "after-station-select"));

  adapter.handleIntent({
    t: "openChallenge",
    evidenceId: firstId,
    sessionId,
    generation: adapter.generation,
    caseId,
  });
  steps.push(snapshot(adapter, "after-open-challenge"));

  adapter.simulateChallengeResult(firstId, true);
  steps.push(snapshot(adapter, "after-simulated-challenge-result"));

  adapter.handleIntent({
    t: "presentationComplete",
    token: "clue-reveal",
    sessionId,
    generation: adapter.generation,
    caseId,
  });
  steps.push(snapshot(adapter, "after-clue-reveal-complete"));

  let guard = 0;
  while (adapter.getState().phase !== "board" && guard < 40) {
    guard += 1;
    const s = adapter.getState();
    if (s.phase === "evidence") {
      const slot = s.slots[s.current]!;
      const item = s.run!.evidences[s.current]!;
      if (!slot.solved) {
        adapter.simulateChallengeResult(item.id, true);
        adapter.handleIntent({
          t: "presentationComplete",
          token: `clue-${item.id}`,
          sessionId,
          generation: adapter.generation,
          caseId,
        });
      } else {
        adapter.handleIntent({
          t: "continue",
          sessionId,
          generation: adapter.generation,
          caseId,
        });
      }
      continue;
    }
    if (s.phase === "checkpoint") {
      adapter.handleIntent({
        t: "continue",
        sessionId,
        generation: adapter.generation,
        caseId,
      });
      continue;
    }
    break;
  }
  steps.push(snapshot(adapter, "deduction-state"));

  return { adapter, steps, runtime };
}
