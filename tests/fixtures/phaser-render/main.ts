import * as Phaser from "phaser";
import { initialEngineState, reduce } from "@/lib/mathDetective/engine";
import { createPhaserRuntime, type PhaserRuntime } from "@/lib/mathDetective/phaser";
import { generateCase } from "@/lib/mathDetective/solver";
import { projectScene } from "@/lib/mathDetective/scene";

const parent = document.querySelector<HTMLElement>("#game");
if (!parent) throw new Error("Missing Phaser fixture parent");
const fixtureParent = parent;

const run = generateCase({ seed: 42, tier: "D3", mode: "mini" });
const state = reduce(
  initialEngineState(),
  { t: "START", run },
  1_700_000_000_000,
).state;
const scene = projectScene(state, {
  sessionId: "phaser-render-fixture",
  generation: 1,
});
const runtime = (await createPhaserRuntime({
  width: 640,
  height: 280,
  backgroundColor: "#0a1220",
})) as PhaserRuntime & { getGame: () => unknown };
runtime.mount(parent, scene);

type GameLike = {
  renderer?: {
    constructor?: { name?: string };
    gl?: WebGLRenderingContext | WebGL2RenderingContext;
  };
  getFrame?: () => number;
  scene?: {
    getScene?: (key: string) => {
      sys?: { isActive?: () => boolean };
      children?: { list?: unknown[] };
    } | null;
  };
};

export type MathDetectivePhaserDiagnostics = {
  phaserVersion: string;
  frame: number;
  sceneActive: boolean;
  rendererClass: string;
  isWebGL: boolean;
  drawingBufferWidth: number;
  drawingBufferHeight: number;
  displayListCount: number;
  canvasCount: number;
};

function getDiagnostics(): MathDetectivePhaserDiagnostics {
  const game = runtime.getGame() as GameLike | null;
  const gl = game?.renderer?.gl;
  const activeScene = game?.scene?.getScene?.("math-detective-foundation");
  return {
    phaserVersion: String((Phaser as unknown as { VERSION?: unknown }).VERSION ?? ""),
    frame: game?.getFrame?.() ?? -1,
    sceneActive: Boolean(activeScene?.sys?.isActive?.()),
    rendererClass: game?.renderer?.constructor?.name ?? "unknown",
    isWebGL: Boolean(gl),
    drawingBufferWidth: gl?.drawingBufferWidth ?? 0,
    drawingBufferHeight: gl?.drawingBufferHeight ?? 0,
    displayListCount: activeScene?.children?.list?.length ?? 0,
    canvasCount: fixtureParent.querySelectorAll("canvas").length,
  };
}

export type MathDetectivePhaserHarness = {
  getDiagnostics: () => MathDetectivePhaserDiagnostics;
  destroy: () => void;
};

declare global {
  interface Window {
    __MATH_DETECTIVE_PHASER__?: MathDetectivePhaserHarness;
  }
}

window.__MATH_DETECTIVE_PHASER__ = {
  getDiagnostics,
  destroy: () => runtime.destroy(),
};
