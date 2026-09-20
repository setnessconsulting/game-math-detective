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
    circle?: (x: number, y: number, radius: number, color: number) => WorldDisplay;
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

function upsertCircle(
  scene: WorldSceneLike,
  name: string,
  x: number,
  y: number,
  radius: number,
  color: number,
  alpha = 1,
): WorldDisplay | null {
  if (!scene.add.circle) return null;
  const existing = scene.children.getByName(name);
  if (existing) {
    existing.setPosition?.(x, y);
    existing.setSize?.(radius * 2, radius * 2);
    existing.setFillStyle?.(color, alpha);
    existing.setAlpha?.(alpha);
    return existing;
  }
  const created = scene.add.circle(x, y, radius, color).setName(name);
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

function stationIcon(station: SceneStation): string {
  const family = stationLabel(station).toLowerCase();
  if (family.includes("clock")) return "◷";
  if (family.includes("ruler")) return "↔";
  if (family.includes("receipt") || family.includes("table") || family.includes("log")) return "▤";
  if (family.includes("map") || family.includes("grid") || family.includes("star")) return "⌖";
  if (family.includes("code") || family.includes("badge")) return "✦";
  if (family.includes("tray") || family.includes("fraction")) return "◒";
  return "⌕";
}

function stationStatusLabel(status: SceneStation["status"]): string {
  switch (status) {
    case "completed":
      return "FILED";
    case "active":
      return "INSPECT NEXT";
    case "available":
      return "AVAILABLE SOON";
    case "locked":
    default:
      return "UP AHEAD";
  }
}

function transitionLabel(kind: SceneModel["world"]["transition"]["kind"]): string {
  switch (kind) {
    case "caseEntry":
      return "The case is ready";
    case "stationFocus":
      return "Look closer";
    case "stationComplete":
      return "Evidence solved";
    case "clueDiscovery":
      return "New clue ready to file";
    case "suspectUpdate":
      return "The file narrows";
    case "wrongAccusationRecovery":
      return "Follow the evidence again";
    case "verdict":
      return "The trail reaches a verdict";
    case "summary":
      return "The case file is complete";
    case "none":
    default:
      return "";
  }
}

interface SettingTheme {
  sky: number;
  ground: number;
  accent: number;
  accentLight: number;
  motif: string;
}

function settingTheme(id: SceneModel["world"]["setting"]["id"]): SettingTheme {
  switch (id) {
    case "community-garden":
      return { sky: 0x173b45, ground: 0x245448, accent: 0x9adf8f, accentLight: 0xf4d06f, motif: "✿" };
    case "makers-market":
      return { sky: 0x173650, ground: 0x315b6b, accent: 0xffd166, accentLight: 0xf2a65a, motif: "✦" };
    case "sky-observatory":
      return { sky: 0x151e4b, ground: 0x283b6c, accent: 0xf6d365, accentLight: 0x9fb3ff, motif: "✧" };
    case "library-archive":
      return { sky: 0x3b2d3b, ground: 0x604553, accent: 0xf1c27d, accentLight: 0xb8d8d8, motif: "▤" };
    default:
      return { sky: 0x173650, ground: 0x315b6b, accent: 0xffd166, accentLight: 0xf2a65a, motif: "⌕" };
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
  return station.objectFamily ?? station.skillId.replaceAll("-", " ");
}

function clueLabel(scene: SceneModel): string {
  if (scene.world.clueDiscovery.state === "discovering") {
    return `NEW CLUE · ${scene.world.clueDiscovery.chip ?? "ready to file"}`;
  }
  if (scene.world.clueDiscovery.state === "revealed") {
    return `FILED CLUE · ${scene.world.clueDiscovery.chip ?? "clue added"}`;
  }
  return "Solve a station to file a clue";
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
  const theme = settingTheme(scene.world.setting.id);

  upsertRectangle(target, "md-world-background", width / 2, height / 2, width, height, theme.sky);
  upsertRectangle(target, "md-world-setting-band", width / 2, 35, width, 70, theme.ground, 0.72);
  upsertRectangle(target, "md-world-horizon", width / 2, 96, width, 2, theme.accent, 0.72);
  upsertCircle(target, "md-world-motif-orb", width - 42, 38, 24, theme.accentLight, 0.22);
  upsertText(target, "md-world-motif", width - 42, 38, theme.motif, {
    fontFamily: "sans-serif",
    fontSize: "28px",
    color: "#f5f9ff",
  }, 0.5, 0.5);
  upsertText(target, "md-world-title", 16, 14, scene.world.setting.label.toUpperCase(), {
    fontFamily: "sans-serif",
    fontSize: "15px",
    color: "#f5f9ff",
  });
  upsertText(
    target,
    "md-world-meta",
    16,
    38,
    `${scene.world.chapter.label} · lead ${Math.min(scene.world.chapter.current + 1, scene.world.chapter.total)}/${scene.world.chapter.total}`,
    { fontFamily: "sans-serif", fontSize: compactStyle, color: "#d1e2f1" },
  );
  upsertText(target, "md-world-feedback", 16, 62, scene.world.environmentalFeedback.label, {
    fontFamily: "sans-serif",
    fontSize: compactStyle,
    color: scene.world.environmentalFeedback.state === "recovery" ? "#ffd6a5" : "#b5f0d3",
  });
  upsertText(target, "md-world-station-heading", 16, 92, "CLUE STATIONS", {
    fontFamily: "sans-serif",
    fontSize: "10px",
    color: "#d7e7f5",
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
    upsertCircle(target, `md-world-station-badge-${key}`, item.x - item.width / 2 + 22, item.y, 13, theme.accent, alpha);
    upsertText(target, `md-world-station-icon-${key}`, item.x - item.width / 2 + 22, item.y, stationIcon(station), {
      fontFamily: "sans-serif",
      fontSize: "13px",
      color: "#17304b",
    }, 0.5, 0.5, alpha);
    upsertText(target, `md-world-station-state-${key}`, item.x - item.width / 2 + 42, item.y - 7, stationGlyph(station.status), {
      fontFamily: "sans-serif",
      fontSize: "11px",
      color: station.status === "locked" ? "#b3c2d0" : "#fff5ce",
    }, 0.5, 0.5, alpha);
    upsertText(target, `md-world-station-label-${key}`, item.x - item.width / 2 + 42, item.y - 5, stationLabel(station), {
      fontFamily: "sans-serif",
      fontSize: layout.compact ? "9px" : "10px",
      color: "#f1f6ff",
    }, 0, 0.5);
    upsertText(target, `md-world-station-kind-${key}`, item.x + item.width / 2 - 8, item.y + item.height / 2 - 10, stationStatusLabel(station.status), {
      fontFamily: "sans-serif",
      fontSize: "8px",
      color: station.status === "locked" ? "#8ca2b7" : "#fff0b0",
    }, 1, 0.5, alpha);
  }

  upsertText(target, "md-world-suspect-heading", 16, layout.suspectHeadingY, "PEOPLE IN THE FILE", {
    fontFamily: "sans-serif",
    fontSize: "10px",
    color: "#d7e7f5",
  });
  for (const item of layout.suspects) {
    const { suspect } = item;
    const key = suspect.id.replaceAll(/[^a-zA-Z0-9_-]/g, "_");
    const alpha = suspect.status === "eliminated" ? 0.58 : 1;
    upsertRectangle(target, `md-world-suspect-${key}`, item.x, item.y, item.width, item.height, suspectColor(suspect.status), alpha);
    upsertCircle(target, `md-world-suspect-avatar-${key}`, item.x - item.width / 2 + 20, item.y, 13, theme.accentLight, alpha);
    upsertText(target, `md-world-suspect-initial-${key}`, item.x - item.width / 2 + 20, item.y, suspect.initial, {
      fontFamily: "sans-serif",
      fontSize: "10px",
      color: "#17304b",
    }, 0.5, 0.5, alpha);
    upsertText(target, `md-world-suspect-glyph-${key}`, item.x + item.width / 2 - 9, item.y, suspectGlyph(suspect.status), {
      fontFamily: "sans-serif",
      fontSize: "12px",
      color: "#f6f8ff",
    }, 0.5, 0.5, alpha);
    upsertText(target, `md-world-suspect-name-${key}`, item.x - item.width / 2 + 40, item.y, suspect.name, {
      fontFamily: "sans-serif",
      fontSize: layout.compact ? "9px" : "10px",
      color: "#edf3ff",
    }, 0, 0.5, alpha);
  }

  const transition = transitionLabel(scene.world.transition.kind);
  upsertText(target, "md-world-transition", 16, layout.clueY - 18, transition, {
    fontFamily: "sans-serif",
    fontSize: "8px",
    color: theme.accentLight === 0xffd166 ? "#ffe8a1" : "#d8ebf7",
  }, 0, 0.5, scene.world.transition.reducedMotion ? 0.68 : 1);
  upsertText(target, "md-world-clue", 16, layout.clueY, clueLabel(scene), {
    fontFamily: "sans-serif",
    fontSize: layout.compact ? "9px" : "10px",
    color: scene.world.clueDiscovery.state === "discovering" ? "#ffd166" : "#b5f0d3",
  });
  if (scene.world.transition.captionsEnabled) {
    upsertText(target, "md-world-caption", width - 16, layout.clueY, scene.world.environmentalFeedback.label, {
      fontFamily: "sans-serif",
      fontSize: "8px",
      color: "#8fa7c1",
    }, 1, 0);
  } else {
    const caption = target.children.getByName("md-world-caption");
    caption?.setAlpha?.(0);
  }
}
