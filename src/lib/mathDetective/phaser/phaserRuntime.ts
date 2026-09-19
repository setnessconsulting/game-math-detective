/**
 * Minimal Phaser 4 boot for Math Detective (GAME-138).
 *
 * Dynamically imports `phaser` so SSR / node Vitest never load the canvas
 * runtime. Production wiring into MathDetective.tsx is deferred to GAME-139.
 */
import type { SceneModel } from "../scene";
import type { PhaserRuntime } from "./hostAdapter";

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
      this.add
        .text(16, 16, "Math Detective (Phaser foundation)", {
          fontFamily: "sans-serif",
          fontSize: "16px",
          color: "#e8eef7",
        })
        .setOrigin(0, 0);
      this.drawModel(latest);
    }

    drawModel(scene: SceneModel | null) {
      if (!scene) return;
      const label = `${scene.location} · ${scene.presentationPhase} · gen ${scene.animation.generation}`;
      const existing = this.children.getByName("md-status") as
        | { setText: (text: string) => void }
        | null;
      if (existing) {
        existing.setText(label);
      } else {
        this.add
          .text(16, 48, label, {
            fontFamily: "sans-serif",
            fontSize: "14px",
            color: "#9db0c7",
          })
          .setName("md-status")
          .setOrigin(0, 0);
      }

      scene.stations.forEach((station, i) => {
        const color =
          station.status === "completed"
            ? 0x3d8b6e
            : station.status === "active"
              ? 0xd4a017
              : 0x4a5d73;
        const name = `station-${station.evidenceId}`;
        const prior = this.children.getByName(name) as
          | { setFillStyle?: (color: number) => void; destroy?: () => void }
          | null;
        if (prior?.setFillStyle) {
          prior.setFillStyle(color);
          return;
        }
        prior?.destroy?.();
        this.add.rectangle(48 + i * 56, 120, 40, 40, color).setName(name);
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

