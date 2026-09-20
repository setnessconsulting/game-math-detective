export {
  createFakePhaserRuntime,
  createMathDetectiveHostAdapter,
  type ChallengeResponder,
  type HostAdapter,
  type HostAdapterOptions,
  type PresentationOptions,
  type PhaserRuntime,
} from "./hostAdapter";

export {
  createPhaserRuntime,
  PHASER_PACKAGE,
  PHASER_PINNED_VERSION,
  type PhaserBootOptions,
} from "./phaserRuntime";

export {
  runFoundationHarness,
  type HarnessResult,
  type HarnessStep,
} from "./harness";

export {
  isDeterministicFocusTarget,
  planFocusTransition,
  type FocusBoundaryEvent,
} from "./focusBoundary";

export {
  layoutWorld,
  renderDetectiveWorld,
  worldCanvasSize,
  type WorldCanvasSize,
  type WorldDisplay,
  type WorldLayout,
  type WorldSceneLike,
  type WorldStationLayout,
  type WorldSuspectLayout,
} from "./worldView";
