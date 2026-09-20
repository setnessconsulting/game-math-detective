/**
 * Minimal Phaser 4 boot for Math Detective (GAME-138).
 *
 * Dynamically imports `phaser` so SSR / node Vitest never load the canvas
 * runtime. The GAME-139 shell mounts this runtime as the live world surface;
 * the engine and HTML controls remain authoritative for all case decisions.
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
        .text(16, 16, "CASE DESK · LIVE WORLD", {
          fontFamily: "sans-serif",
          fontSize: "15px",
          color: "#f5c451",
        })
        .setOrigin(0, 0);
      this.add
        .text(16, 92, "EVIDENCE STATIONS", {
          fontFamily: "sans-serif",
          fontSize: "11px",
          color: "#9db0c7",
        })
        .setName("md-station-heading")
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
        } else {
          prior?.destroy?.();
          this.add.rectangle(48 + i * 56, 120, 40, 40, color).setName(name);
        }
        const stationTextName = `${name}-label`;
        const stationLabel = station.skillId.slice(0, 5).toUpperCase();
        const priorLabel = this.children.getByName(stationTextName) as
          | { setText: (text: string) => void }
          | null;
        if (priorLabel) {
          priorLabel.setText(stationLabel);
        } else {
          this.add
            .text(48 + i * 56, 168, stationLabel, {
              fontFamily: "sans-serif",
              fontSize: "8px",
              color: "#d7e3f0",
            })
            .setName(stationTextName)
            .setOrigin(0, 0);
        }
      });

      const suspectText = scene.suspects
        .map((suspect) => `${suspect.status === "eliminated" ? "×" : "•"} ${suspect.name}`)
        .join("   ");
      const suspects = this.children.getByName("md-suspects") as
        | { setText: (text: string) => void }
        | null;
      if (suspects) {
        suspects.setText(suspectText);
      } else {
        this.add
          .text(16, 220, suspectText, {
            fontFamily: "sans-serif",
            fontSize: "11px",
            color: "#d7e3f0",
          })
          .setName("md-suspects")
          .setOrigin(0, 0);
      }

      const clueText = `CLUES EARNED  ${scene.deduction.chips.length} / ${scene.stations.length}`;
      const clues = this.children.getByName("md-clues") as
        | { setText: (text: string) => void }
        | null;
      if (clues) {
        clues.setText(clueText);
      } else {
        this.add
          .text(16, 272, clueText, {
            fontFamily: "sans-serif",
            fontSize: "11px",
            color: "#7fe0b5",
          })
          .setName("md-clues")
          .setOrigin(0, 0);
      }
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

