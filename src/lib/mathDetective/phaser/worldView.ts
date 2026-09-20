/**
 * Read-only Phaser world projection for Math Detective (GAME-140).
 *
 * This module deliberately accepts SceneModel only. It has no access to the
 * reducer, generated answers, constraint predicates, or solver. The same
 * marker/card patterns therefore work for every station and suspect roster.
 */
import type { LayoutMode, SceneModel, SceneStation, SceneSuspect } from "../scene";

export interface WorldDisplay {
  setName(name: string): WorldDisplay;
  setOrigin?(x: number, y: number): WorldDisplay;
  setPosition?(x: number, y: number): WorldDisplay;
  setSize?(width: number, height: number): WorldDisplay;
  setText?(text: string): void;
  setFillStyle?(color: number, alpha?: number): WorldDisplay;
  setStrokeStyle?(lineWidth: number, color: number, alpha?: number): WorldDisplay;
  setAlpha?(alpha: number): WorldDisplay;
}

export interface WorldSceneLike {
  add: {
    text: (
      x: number,
      y: number,
      text: string,
      style?: Record<string, string>,
    ) => WorldDisplay;
    rectangle: (x: number, y: number, width: number, height: number, color: number) => WorldDisplay;
  };
  children: {
    getByName: (name: string) => WorldDisplay | null;
  };
  scale?: { width: number; height: number };
}

export interface WorldCanvasSize {
  width: number;
  height: number;
}

export function worldCanvasSize(layoutMode: LayoutMode): WorldCanvasSize {
  switch (layoutMode) {
    case "phonePortrait":
      return { width: 360, height: 620 };
    case "tablet":
      return { width: 520, height: 520 };
    case "desktop":
    default:
      return { width: 640, height: 360 };
  }
}

export interface WorldStationLayout {
  station: SceneStation;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorldSuspectLayout {
  suspect: SceneSuspect;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorldLayout {
  width: number;
  height: number;
  compact: boolean;
  stations: WorldStationLayout[];
  suspects: WorldSuspectLayout[];
  suspectHeadingY: number;
  clueY: number;
}

function gridItems<T>(
  items: readonly T[],
  columns: number,
  startY: number,
  cardWidth: number,
  cardHeight: number,
  gap: number,
): { item: T; x: number; y: number }[] {
  return items.map((item, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      item,
      x: 16 + column * (cardWidth + gap) + cardWidth / 2,
      y: startY + row * (cardHeight + gap) + cardHeight / 2,
    };
  });
}

/** Deterministic responsive geometry; it contains no case or curriculum rules. */
export function layoutWorld(scene: SceneModel, width: number, height: number): WorldLayout {
  const compact = scene.layoutMode !== "desktop" || width < 560;
  const contentWidth = Math.max(220, width - 32);
  const gap = compact ? 8 : 10;
  const stationColumns = compact
    ? Math.max(1, Math.min(2, scene.world.stations.length))
    : Math.max(1, Math.min(5, scene.world.stations.length));
  const stationWidth = (contentWidth - gap * (stationColumns - 1)) / stationColumns;
  const stationHeight = compact ? 68 : 58;
  const stationStartY = compact ? 116 : 112;
  const stationPositions = gridItems(
    scene.world.stations,
    stationColumns,
    stationStartY,
    stationWidth,
    stationHeight,
    gap,
  );
  const stationRows = Math.max(1, Math.ceil(scene.world.stations.length / stationColumns));
  const suspectStartY = stationStartY + stationRows * (stationHeight + gap) + (compact ? 28 : 24);
  const suspectColumns = compact
    ? Math.max(1, Math.min(2, scene.world.suspects.length))
    : Math.max(1, Math.min(5, scene.world.suspects.length));
  const suspectWidth = (contentWidth - gap * (suspectColumns - 1)) / suspectColumns;
  const suspectHeight = compact ? 50 : 44;
  const suspectPositions = gridItems(
    scene.world.suspects,
    suspectColumns,
    suspectStartY,
    suspectWidth,
    suspectHeight,
    gap,
  );

  return {
    width,
    height,
    compact,
    stations: stationPositions.map(({ item, x, y }) => ({
      station: item,
      x,
      y,
      width: stationWidth,
      height: stationHeight,
    })),
    suspects: suspectPositions.map(({ item, x, y }) => ({
      suspect: item,
      x,
      y,
      width: suspectWidth,
      height: suspectHeight,
    })),
    suspectHeadingY: suspectStartY - (compact ? 16 : 14),
    clueY: height - 18,
  };
}

function upsertText(
  scene: WorldSceneLike,
  name: string,
  x: number,
  y: number,
  text: string,
  style: Record<string, string>,
  originX = 0,
  originY = 0,
  alpha = 1,
): WorldDisplay {
  const existing = scene.children.getByName(name);
  if (existing) {
    existing.setPosition?.(x, y);
    existing.setText?.(text);
    existing.setAlpha?.(alpha);
    return existing;
  }
  const created = scene.add.text(x, y, text, style).setName(name);
  created.setOrigin?.(originX, originY);
  created.setAlpha?.(alpha);
  return created;
}

function upsertRectangle(
  scene: WorldSceneLike,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  alpha = 1,
): WorldDisplay {
  const existing = scene.children.getByName(name);
  if (existing) {
    existing.setPosition?.(x, y);
    existing.setSize?.(width, height);
    existing.setFillStyle?.(color, alpha);
    existing.setAlpha?.(alpha);
    return existing;
  }
  const created = scene.add.rectangle(x, y, width, height, color).setName(name);
  created.setAlpha?.(alpha);
  return created;
}

function stationColor(status: SceneStation["status"]): number {
  switch (status) {
    case "completed":
      return 0x397c68;
    case "active":
      return 0xd09b2c;
    case "available":
      return 0x35628f;
    case "locked":
    default:
      return 0x24394f;
  }
}

function stationGlyph(status: SceneStation["status"]): string {
  switch (status) {
    case "completed":
      return "✓";
    case "active":
      return "●";
    case "available":
      return "○";
    case "locked":
    default:
      return "·";
  }
}

function suspectColor(status: SceneSuspect["status"]): number {
  switch (status) {
    case "culpritRevealed":
      return 0x8f6b2d;
    case "accused":
      return 0x805b3e;
    case "eliminated":
      return 0x304052;
    case "alive":
    default:
      return 0x31577b;
  }
}

function suspectGlyph(status: SceneSuspect["status"]): string {
  switch (status) {
    case "culpritRevealed":
      return "★";
    case "accused":
      return "!";
    case "eliminated":
      return "×";
    case "alive":
    default:
      return "•";
  }
}

function stationLabel(station: SceneStation): string {
  return station.skillId.replaceAll("-", " ");
}

function clueLabel(scene: SceneModel): string {
  if (scene.world.clueDiscovery.state === "discovering") {
    return `CLUE DISCOVERY · ${scene.world.clueDiscovery.chip ?? "new clue"}`;
  }
  if (scene.world.clueDiscovery.state === "revealed") {
    return `CASE FILE · ${scene.world.clueDiscovery.chip ?? "clue added"}`;
  }
  return "CASE FILE · solve a station to find a clue";
}

/** Draw or reconcile the world without emitting intents or changing case state. */
export function renderDetectiveWorld(
  target: WorldSceneLike,
  scene: SceneModel,
  dimensions?: Partial<WorldCanvasSize>,
): void {
  const width = dimensions?.width ?? target.scale?.width ?? worldCanvasSize(scene.layoutMode).width;
  const height = dimensions?.height ?? target.scale?.height ?? worldCanvasSize(scene.layoutMode).height;
  const layout = layoutWorld(scene, width, height);
  const compactStyle = layout.compact ? "10px" : "11px";

  upsertRectangle(target, "md-world-background", width / 2, height / 2, width, height, 0x081522);
  upsertText(target, "md-world-title", 16, 14, "DETECTIVE OFFICE · LIVE WORLD", {
    fontFamily: "sans-serif",
    fontSize: "15px",
    color: "#f5c451",
  });
  upsertText(
    target,
    "md-world-meta",
    16,
    38,
    `${scene.world.setting.label} · ${scene.world.chapter.label} · ${scene.tier ?? "unranked"}`,
    { fontFamily: "sans-serif", fontSize: compactStyle, color: "#a9c1d9" },
  );
  upsertText(target, "md-world-feedback", 16, 62, scene.world.environmentalFeedback.label, {
    fontFamily: "sans-serif",
    fontSize: compactStyle,
    color: scene.world.environmentalFeedback.state === "recovery" ? "#ffd6a5" : "#8fe3c0",
  });
  upsertText(target, "md-world-station-heading", 16, 92, "EVIDENCE STATIONS", {
    fontFamily: "sans-serif",
    fontSize: "10px",
    color: "#92a9c2",
  });

  for (const item of layout.stations) {
    const { station } = item;
    const key = station.evidenceId.replaceAll(/[^a-zA-Z0-9_-]/g, "_");
    const alpha = station.status === "locked" ? 0.72 : 1;
    upsertRectangle(
      target,
      `md-world-station-${key}`,
      item.x,
      item.y,
      item.width,
      item.height,
      stationColor(station.status),
      alpha,
    );
    upsertText(target, `md-world-station-glyph-${key}`, item.x - item.width / 2 + 10, item.y - item.height / 2 + 10, stationGlyph(station.status), {
      fontFamily: "sans-serif",
      fontSize: "12px",
      color: station.status === "locked" ? "#7188a0" : "#f4f8ff",
    });
    upsertText(target, `md-world-station-label-${key}`, item.x, item.y + 2, stationLabel(station), {
      fontFamily: "sans-serif",
      fontSize: layout.compact ? "9px" : "10px",
      color: "#f1f6ff",
    }, 0.5, 0.5);
    upsertText(target, `md-world-station-kind-${key}`, item.x, item.y + item.height / 2 - 10, station.presentationKind, {
      fontFamily: "sans-serif",
      fontSize: "8px",
      color: station.status === "locked" ? "#7890aa" : "#c9dbef",
    }, 0.5, 0.5);
  }

  upsertText(target, "md-world-suspect-heading", 16, layout.suspectHeadingY, "SUSPECTS · ENGINE STATE", {
    fontFamily: "sans-serif",
    fontSize: "10px",
    color: "#92a9c2",
  });
  for (const item of layout.suspects) {
    const { suspect } = item;
    const key = suspect.id.replaceAll(/[^a-zA-Z0-9_-]/g, "_");
    const alpha = suspect.status === "eliminated" ? 0.58 : 1;
    upsertRectangle(target, `md-world-suspect-${key}`, item.x, item.y, item.width, item.height, suspectColor(suspect.status), alpha);
    upsertText(target, `md-world-suspect-glyph-${key}`, item.x - item.width / 2 + 9, item.y, suspectGlyph(suspect.status), {
      fontFamily: "sans-serif",
      fontSize: "12px",
      color: "#f6f8ff",
    }, 0.5, 0.5);
    upsertText(target, `md-world-suspect-name-${key}`, item.x + 5, item.y, suspect.name, {
      fontFamily: "sans-serif",
      fontSize: layout.compact ? "9px" : "10px",
      color: "#edf3ff",
    }, 0, 0.5);
  }

  const transition = scene.world.transition.kind === "none"
    ? ""
    : `${scene.world.transition.reducedMotion ? "STATIC" : "MOTION"} · ${scene.world.transition.kind}`;
  upsertText(target, "md-world-transition", 16, layout.clueY - 18, transition, {
    fontFamily: "sans-serif",
    fontSize: "8px",
    color: "#8099b2",
  });
  upsertText(target, "md-world-clue", 16, layout.clueY, clueLabel(scene), {
    fontFamily: "sans-serif",
    fontSize: layout.compact ? "9px" : "10px",
    color: scene.world.clueDiscovery.state === "discovering" ? "#ffd166" : "#8fe3c0",
  });
  if (scene.world.transition.captionsEnabled) {
    upsertText(target, "md-world-caption", width - 16, layout.clueY, `CAPTION · ${scene.world.environmentalFeedback.label}`, {
      fontFamily: "sans-serif",
      fontSize: "8px",
      color: "#8fa7c1",
    }, 1, 0);
  } else {
    const caption = target.children.getByName("md-world-caption");
    caption?.setAlpha?.(0);
  }
}
