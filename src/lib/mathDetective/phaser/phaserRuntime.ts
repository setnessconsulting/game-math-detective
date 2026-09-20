/**
 * Minimal Phaser 4 boot for Math Detective (GAME-138).
 *
 * Dynamically imports `phaser` so SSR / node Vitest never load the canvas
 * runtime. The GAME-139 shell mounts this runtime as the live world surface;
 * the engine and HTML controls remain authoritative for all case decisions.
 */
import type { SceneModel } from "../scene";
import type { PhaserRuntime } from "./hostAdapter";
import {
  renderDetectiveWorld,
  type WorldSceneLike,
  worldCanvasSize,
} from "./worldView";

export const PHASER_PACKAGE = "phaser";
export const PHASER_PINNED_VERSION = "4.2.1";

export interface PhaserBootOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
}

interface PhaserLike {
  AUTO: number;
  Game: new (config: Record<string, unknown>) => {
    destroy: (removeCanvas?: boolean) => void;
    scene: { getScene: (key: string) => { drawModel?: (s: SceneModel | null) => void } | null };
    scale?: { resize?: (width: number, height: number) => void };
  };
  Scene: new (config?: string | { key: string }) => {
    add: {
      text: (
        x: number,
        y: number,
        text: string,
        style?: Record<string, string>,
      ) => {
        setOrigin: (x: number, y: number) => unknown;
        setName: (name: string) => { setOrigin: (x: number, y: number) => unknown };
        setText: (text: string) => void;
      };
      rectangle: (
        x: number,
        y: number,
        w: number,
        h: number,
        color: number,
      ) => { setName: (name: string) => unknown };
      circle: (
        x: number,
        y: number,
        radius: number,
        color: number,
      ) => { setName: (name: string) => unknown };
    };
    children: { getByName: (name: string) => { setText: (text: string) => void } | null };
  };
}

/**
 * Create a real Phaser runtime. Call only in the browser.
 * Tests should use `createFakePhaserRuntime` instead.
 */
export async function createPhaserRuntime(
  options: PhaserBootOptions = {},
): Promise<PhaserRuntime> {
  const Phaser = (await import("phaser")) as unknown as PhaserLike;
  let game: InstanceType<PhaserLike["Game"]> | null = null;
  let latest: SceneModel | null = null;

  class DetectiveScene extends Phaser.Scene {
    constructor() {
      super("math-detective-foundation");
    }

    create() {
      this.drawModel(latest);
    }

    drawModel(scene: SceneModel | null) {
      if (!scene) return;
      const scale = (this as unknown as { scale?: { width: number; height: number } }).scale;
      renderDetectiveWorld(this as unknown as WorldSceneLike, scene, {
        width: scale?.width,
        height: scale?.height,
      });
    }
  }

  return {
    mount(parent, scene) {
      latest = scene;
      if (game) {
        game.destroy(true);
        game = null;
      }
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent,
        width: options.width ?? 640,
        height: options.height ?? 360,
        backgroundColor: options.backgroundColor ?? "#1a2433",
        scene: [DetectiveScene],
        banner: false,
      });
    },
    reconcile(scene) {
      latest = scene;
      const size = worldCanvasSize(scene.layoutMode);
      game?.scale?.resize?.(size.width, size.height);
      const active = game?.scene.getScene("math-detective-foundation") as
        | { drawModel?: (s: SceneModel | null) => void }
        | null
        | undefined;
      active?.drawModel?.(scene);
    },
    destroy() {
      if (game) {
        game.destroy(true);
        game = null;
      }
      latest = null;
    },
    getGame() {
      return game;
    },
  };
}

