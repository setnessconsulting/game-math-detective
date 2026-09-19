/**
 * Math Detective — typed scene / view model (GAME-137).
 *
 * Pure projection from EngineState. Contains no solver and no duplicated
 * case authority. Phaser and React overlays consume this model only.
 */
import type { DetectivePhase, EngineState } from "../engine";
import type {
  CaseMode,
  DifficultyTier,
  PresentationPayload,
  SkillId,
} from "../types";

/** High-level place in the detective world (maps 1:1 to SCENE_CONTRACT locations). */
export type SceneLocation =
  | "briefing"
  | "office"
  | "evidenceStation"
  | "checkpoint"
  | "deductionBoard"
  | "accusation"
  | "verdict"
  | "guided"
  | "summary"
  | "pause";

/**
 * Fine-grained presentation phase inside a location.
 * Animation may wait on these; they never authoritatively mutate the engine.
 */
export type PresentationPhase =
  | "idle"
  | "entering"
  | "stationAvailable"
  | "stationActive"
  | "stationCompleted"
  | "clueDiscovery"
  | "challengeOpen"
  | "challengeResult"
  | "suspectUpdate"
  | "wrongAccusationRecovery"
  | "awaitingContinue";

export type StationStatus = "locked" | "available" | "active" | "completed";

export type SuspectPresentationStatus = "alive" | "eliminated" | "accused" | "culpritRevealed";

export type OverlayKind =
  | "none"
  | "challenge"
  | "result"
  | "pause"
  | "settings"
  | "captions"
  | "accusationConfirm";

export type FocusTarget =
  | "world"
  | `world.station.${string}`
  | "overlay.challenge"
  | "overlay.result"
  | "overlay.pause"
  | "overlay.accusation"
  | "dom.briefingContinue"
  | "dom.summaryPrimary";

export type LayoutMode = "phonePortrait" | "tablet" | "desktop";

export interface SceneStation {
  evidenceId: string;
  skillId: SkillId;
  index: number;
  status: StationStatus;
  goal: string;
  presentationKind: PresentationPayload["kind"];
  /** Chip text when earned; null until engine earns the clue. */
  earnedChip: string | null;
}

export interface SceneSuspect {
  id: string;
  name: string;
  initial: string;
  icon: string;
  status: SuspectPresentationStatus;
}

export interface SceneDeduction {
  earnedConstraintIds: string[];
  chips: { id: string; chip: string; sentence: string }[];
  links: Record<string, true>;
  canAccuse: boolean;
  minLinksRequired: number;
}

export interface SceneCluePresentation {
  evidenceId: string | null;
  goal: string | null;
  presentation: PresentationPayload | null;
  solved: boolean;
  attempts: number;
  hintsUsed: number[];
  points: number | null;
}

export interface SceneAnimationMeta {
  /** Host-assigned generation; Phaser must echo this on intents. */
  generation: number;
  reducedMotion: boolean;
  captionsEnabled: boolean;
  pendingPresentationComplete: boolean;
}

export interface SceneModel {
  contractVersion: 1;
  sessionId: string;
  caseId: string | null;
  tier: DifficultyTier | null;
  mode: CaseMode | null;
  casePhase: DetectivePhase;
  location: SceneLocation;
  presentationPhase: PresentationPhase;
  stations: SceneStation[];
  completedStationIds: string[];
  clue: SceneCluePresentation;
  suspects: SceneSuspect[];
  deduction: SceneDeduction;
  overlay: OverlayKind;
  focusTarget: FocusTarget;
  layoutMode: LayoutMode;
  title: string | null;
  intro: string | null;
  outcome: EngineState["outcome"];
  rejection: string | null;
  animation: SceneAnimationMeta;
}

export interface SceneProjectOptions {
  sessionId: string;
  generation: number;
  reducedMotion?: boolean;
  captionsEnabled?: boolean;
  layoutMode?: LayoutMode;
  overlay?: OverlayKind;
  presentationPhase?: PresentationPhase;
  focusTarget?: FocusTarget;
  pendingPresentationComplete?: boolean;
  /** Presentation-only: which station marker is highlighted in the office. */
  highlightedStationId?: string | null;
}
