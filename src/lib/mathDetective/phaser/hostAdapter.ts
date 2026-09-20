/**
 * Math Detective — Phaser host adapter (GAME-138).
 *
 * React/session owns lifecycle. Phaser consumes SceneModel and emits only
 * bounded SceneIntents stamped with session/generation/case tokens.
 * Engine remains sole case authority.
 */
import {
  initialEngineState,
  reduce,
  type EngineAction,
  type EngineState,
  type Effect,
} from "../engine";
import {
  focusAfterOverlayClose,
  projectScene,
  resolveSceneIntent,
  type LayoutMode,
  type OverlayKind,
  type PresentationEffect,
  type SceneIntent,
  type SceneModel,
} from "../scene";
import type { CaseRun } from "../types";
import { saveResume } from "../resume";

export interface PhaserRuntime {
  mount(parent: HTMLElement, scene: SceneModel): void;
  reconcile(scene: SceneModel): void;
  destroy(): void;
  /** Qualification-only readback; production consumers do not own the game. */
  getGame?: () => unknown;
  /** Test/harness hook: emit a raw intent as if from Phaser. */
  emit?(intent: SceneIntent): void;
}

export type ChallengeResponder = (args: {
  evidenceId: string;
  /** Injected for harnesses; production React overlay supplies the learner value. */
  simulateCorrect?: boolean;
}) => { value: number } | null;

export interface HostAdapterOptions {
  sessionId: string;
  runtime: PhaserRuntime;
  parent?: HTMLElement | null;
  now?: () => number;
  /** Fake/test challenge responder so adapter tests need no visual UI. */
  challengeResponder?: ChallengeResponder;
  onEffects?: (effects: Effect[]) => void;
  onScene?: (scene: SceneModel) => void;
  onFocusTarget?: (target: SceneModel["focusTarget"]) => void;
  layoutMode?: LayoutMode;
  reducedMotion?: boolean;
  captionsEnabled?: boolean;
}

export interface PresentationOptions {
  layoutMode?: LayoutMode;
  reducedMotion?: boolean;
  captionsEnabled?: boolean;
}

export interface HostAdapter {
  readonly sessionId: string;
  readonly generation: number;
  getState(): EngineState;
  getScene(): SceneModel;
  startCase(run: CaseRun): void;
  /** Resume from an authoritative engine snapshot (reload/remount). */
  restore(run: CaseRun, engine: EngineState): void;
  dispatchEngine(action: EngineAction): void;
  handleIntent(intent: SceneIntent): { accepted: boolean; reason?: string };
  /** Harness helper: open challenge and inject a simulated authoritative answer. */
  simulateChallengeResult(evidenceId: string, correct: boolean): void;
  remount(parent: HTMLElement): void;
  setPresentationOptions(options: PresentationOptions): void;
  destroy(): void;
}

export function createMathDetectiveHostAdapter(options: HostAdapterOptions): HostAdapter {
  let generation = 1;
  let state = initialEngineState();
  let overlay: OverlayKind = "none";
  let highlightedStationId: string | null = null;
  let pendingPresentation = false;
  let layoutMode: LayoutMode = options.layoutMode ?? "desktop";
  let reducedMotion = options.reducedMotion ?? false;
  let captionsEnabled = options.captionsEnabled ?? true;
  let destroyed = false;
  let mountedParent: HTMLElement | null = options.parent ?? null;
  const now = options.now ?? (() => Date.now());

  const buildScene = (): SceneModel =>
    projectScene(state, {
      sessionId: options.sessionId,
      generation,
      overlay,
      highlightedStationId,
      pendingPresentationComplete: pendingPresentation,
      layoutMode,
      reducedMotion,
      captionsEnabled,
    });

  const publish = () => {
    const scene = buildScene();
    if (mountedParent && !destroyed) {
      options.runtime.reconcile(scene);
    }
    options.onScene?.(scene);
    options.onFocusTarget?.(scene.focusTarget);
    return scene;
  };

  const applyEngine = (action: EngineAction) => {
    if (destroyed) return;
    const result = reduce(state, action, now());
    state = result.state;
    options.onEffects?.(result.effects);
    if (state.run && !state.finished) {
      saveResume(state.run, state);
    }
    if (action.t === "SUBMIT_ANSWER" && state.slots[state.current]?.solved) {
      overlay = "result";
      pendingPresentation = true;
    }
    publish();
  };

  const applyPresentation = (effect: PresentationEffect) => {
    switch (effect.t) {
      case "highlightStation":
        highlightedStationId = effect.evidenceId;
        break;
      case "openOverlay":
        overlay = effect.overlay;
        break;
      case "closeOverlay":
        overlay = "none";
        break;
      case "selectSuspect":
        break;
      case "presentationUnblocked":
        pendingPresentation = false;
        if (overlay === "result") overlay = "none";
        break;
      default:
        break;
    }
    const scene = publish();
    if (effect.t === "closeOverlay") {
      options.onFocusTarget?.(focusAfterOverlayClose(scene));
    }
  };

  const bumpGeneration = () => {
    generation += 1;
    overlay = "none";
    highlightedStationId = null;
    pendingPresentation = false;
  };

  const adapter: HostAdapter = {
    get sessionId() {
      return options.sessionId;
    },
    get generation() {
      return generation;
    },
    getState: () => state,
    getScene: () => buildScene(),

    startCase(run) {
      if (destroyed) return;
      bumpGeneration();
      state = initialEngineState();
      applyEngine({ t: "START", run });
      if (mountedParent) {
        options.runtime.mount(mountedParent, buildScene());
      }
    },

    restore(run, engine) {
      if (destroyed) return;
      bumpGeneration();
      state = { ...engine, run };
      publish();
      if (mountedParent) {
        options.runtime.mount(mountedParent, buildScene());
      }
    },

    dispatchEngine(action) {
      applyEngine(action);
    },

    handleIntent(intent) {
      if (destroyed) return { accepted: false, reason: "destroyed" };
      const resolved = resolveSceneIntent(intent, {
        sessionId: options.sessionId,
        generation,
        state,
      });
      if (!resolved.ok) return { accepted: false, reason: resolved.reason };
      if (resolved.kind === "engine") {
        applyEngine(resolved.action);
        return { accepted: true };
      }
      applyPresentation(resolved.effect);
      return { accepted: true };
    },

    simulateChallengeResult(evidenceId, correct) {
      if (destroyed || state.phase !== "evidence") return;
      const item = state.run?.evidences[state.current];
      if (!item || item.id !== evidenceId) return;
      const fromResponder = options.challengeResponder?.({
        evidenceId,
        simulateCorrect: correct,
      });
      const value = correct
        ? (fromResponder?.value ?? item.answer.value)
        : (fromResponder?.value ?? item.answer.value + 999);
      applyEngine({
        t: "SUBMIT_ANSWER",
        itemId: evidenceId,
        value,
        latencyMs: 500,
      });
    },

    remount(parent) {
      if (destroyed) return;
      bumpGeneration();
      mountedParent = parent;
      options.runtime.destroy();
      options.runtime.mount(parent, buildScene());
      publish();
    },

    setPresentationOptions(nextOptions) {
      if (destroyed) return;
      const changed =
        (nextOptions.layoutMode !== undefined && nextOptions.layoutMode !== layoutMode) ||
        (nextOptions.reducedMotion !== undefined && nextOptions.reducedMotion !== reducedMotion) ||
        (nextOptions.captionsEnabled !== undefined && nextOptions.captionsEnabled !== captionsEnabled);
      if (!changed) return;
      if (nextOptions.layoutMode !== undefined) layoutMode = nextOptions.layoutMode;
      if (nextOptions.reducedMotion !== undefined) reducedMotion = nextOptions.reducedMotion;
      if (nextOptions.captionsEnabled !== undefined) captionsEnabled = nextOptions.captionsEnabled;
      publish();
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      bumpGeneration();
      options.runtime.destroy();
      mountedParent = null;
      state = initialEngineState();
    },
  };

  if (mountedParent) {
    options.runtime.mount(mountedParent, buildScene());
  }

  return adapter;
}

/** Test/fake Phaser runtime: records scenes, no canvas. */
export function createFakePhaserRuntime(): PhaserRuntime & {
  scenes: SceneModel[];
  destroyedCount: number;
  lastScene: SceneModel | null;
  intentHandler: ((intent: SceneIntent) => void) | null;
} {
  const api = {
    scenes: [] as SceneModel[],
    destroyedCount: 0,
    lastScene: null as SceneModel | null,
    intentHandler: null as ((intent: SceneIntent) => void) | null,
    mount(_parent: HTMLElement, scene: SceneModel) {
      api.lastScene = scene;
      api.scenes.push(scene);
    },
    reconcile(scene: SceneModel) {
      api.lastScene = scene;
      api.scenes.push(scene);
    },
    destroy() {
      api.destroyedCount += 1;
      api.lastScene = null;
      api.intentHandler = null;
    },
    emit(intent: SceneIntent) {
      api.intentHandler?.(intent);
    },
  };
  return api;
}

