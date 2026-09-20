/**
 * Project authoritative EngineState into a Phaser/React SceneModel.
 */
import { tierRequiresLinks, type EngineState } from "../engine";
import type {
  FocusTarget,
  OverlayKind,
  PresentationPhase,
  SceneLocation,
  SceneModel,
  SceneProjectOptions,
  SceneStation,
  SceneSuspect,
  StationStatus,
  SuspectPresentationStatus,
} from "./types";

function locationFor(phase: EngineState["phase"], overlay: OverlayKind): SceneLocation {
  if (overlay === "pause" || overlay === "settings") return "pause";
  switch (phase) {
    case "briefing":
      return "briefing";
    case "evidence":
      return "evidenceStation";
    case "checkpoint":
      return "checkpoint";
    case "board":
      return overlay === "accusationConfirm" ? "accusation" : "deductionBoard";
    case "verdict":
      return "verdict";
    case "guided":
      return "guided";
    case "summary":
      return "summary";
    default:
      return "office";
  }
}

function defaultPresentationPhase(
  state: EngineState,
  overlay: OverlayKind,
  pendingPresentationComplete: boolean,
): PresentationPhase {
  if (
    pendingPresentationComplete &&
    state.phase === "evidence" &&
    state.slots[state.current]?.solved
  ) {
    return "clueDiscovery";
  }
  if (overlay === "challenge") return "challengeOpen";
  if (overlay === "result") return "challengeResult";
  switch (state.phase) {
    case "briefing":
      return "awaitingContinue";
    case "evidence": {
      const slot = state.slots[state.current];
      if (slot?.solved) return "stationCompleted";
      return "stationActive";
    }
    case "verdict":
      return state.outcome === null ? "wrongAccusationRecovery" : "idle";
    default:
      return "idle";
  }
}

function defaultFocus(
  state: EngineState,
  overlay: OverlayKind,
  highlightedStationId: string | null | undefined,
): FocusTarget {
  if (overlay === "challenge") return "overlay.challenge";
  if (overlay === "result") return "overlay.result";
  if (overlay === "pause" || overlay === "settings") return "overlay.pause";
  if (overlay === "accusationConfirm") return "overlay.accusation";
  if (state.phase === "briefing") return "dom.briefingContinue";
  if (state.phase === "summary") return "dom.summaryPrimary";
  if (state.phase === "evidence") {
    const id = highlightedStationId ?? state.run?.evidences[state.current]?.id;
    return id ? `world.station.${id}` : "world";
  }
  return "world";
}

function stationStatus(
  state: EngineState,
  index: number,
  highlightedStationId: string | null | undefined,
): StationStatus {
  const slot = state.slots[index];
  if (!slot) return "locked";
  if (slot.solved) return "completed";
  if (state.phase !== "evidence" && state.phase !== "briefing") {
    return index <= state.current ? "completed" : "locked";
  }
  if (state.phase === "briefing") return index === 0 ? "available" : "locked";
  if (index === state.current) {
    if (highlightedStationId && highlightedStationId !== slot.itemId) return "available";
    return "active";
  }
  if (index < state.current) return "completed";
  return "locked";
}

function suspectStatus(state: EngineState, suspectId: string): SuspectPresentationStatus {
  const lastAcc = state.accusations[state.accusations.length - 1];
  if (state.phase === "verdict" || state.phase === "guided" || state.phase === "summary") {
    if (state.outcome === "closed" && suspectId === state.run?.culpritId) {
      return "culpritRevealed";
    }
    if (lastAcc && !lastAcc.correct && lastAcc.suspectId === suspectId) {
      return "accused";
    }
  }
  if (!state.aliveIds.includes(suspectId)) return "eliminated";
  return "alive";
}

function worldTransitionFor(
  state: EngineState,
  pendingPresentationComplete: boolean,
  reducedMotion: boolean,
  captionsEnabled: boolean,
): SceneModel["world"]["transition"] {
  let kind: SceneModel["world"]["transition"]["kind"] = "none";
  if (pendingPresentationComplete && state.phase === "evidence") {
    kind = "clueDiscovery";
  } else {
    switch (state.phase) {
      case "briefing":
        kind = "caseEntry";
        break;
      case "evidence":
        kind = state.slots[state.current]?.solved ? "stationComplete" : "stationFocus";
        break;
      case "checkpoint":
      case "board":
        kind = "suspectUpdate";
        break;
      case "guided":
        kind = "wrongAccusationRecovery";
        break;
      case "verdict":
        kind = "verdict";
        break;
      case "summary":
        kind = "summary";
        break;
      default:
        kind = "none";
    }
  }

  return {
    kind,
    durationMs: reducedMotion || kind === "none" ? 0 : kind === "clueDiscovery" ? 520 : 260,
    reducedMotion,
    captionsEnabled,
  };
}

function worldFeedbackFor(
  state: EngineState,
  pendingPresentationComplete: boolean,
  currentStation: SceneStation | null,
): SceneModel["world"]["environmentalFeedback"] {
  if (pendingPresentationComplete) {
    return { state: "clue", label: "Clue discovery ready" };
  }
  if (state.phase === "briefing") {
    return { state: "briefing", label: "Briefing ready" };
  }
  if (state.phase === "board" || state.phase === "checkpoint") {
    return { state: "board", label: "Suspect board updated" };
  }
  if (state.phase === "guided" || (state.phase === "verdict" && state.outcome === null)) {
    return { state: "recovery", label: "Review the evidence" };
  }
  if (state.phase === "verdict" || state.phase === "summary") {
    return { state: "closed", label: "Case file closed" };
  }
  if (currentStation?.status === "completed") {
    return { state: "clue", label: "Evidence solved" };
  }
  return { state: "station", label: "Evidence station ready" };
}

export function projectScene(state: EngineState, options: SceneProjectOptions): SceneModel {
  const overlay = options.overlay ?? "none";
  const run = state.run;
  const currentSlot = state.slots[state.current] ?? null;
  const pendingClueDiscovery = Boolean(options.pendingPresentationComplete && currentSlot?.solved);
  const stations: SceneStation[] =
    run?.evidences.map((ev, index) => {
      const status = stationStatus(state, index, options.highlightedStationId);
      const earned = state.earnedIds.includes(ev.id);
      return {
        evidenceId: ev.id,
        skillId: ev.skillId,
        index,
        status,
        goal: ev.goal,
        presentationKind: ev.presentation.kind,
        objectFamily: run?.narrative.stationFamilies[ev.skillId] ?? null,
        earnedChip: earned ? ev.constraint.chip : null,
      };
    }) ?? [];

  const suspects: SceneSuspect[] =
    run?.suspects.map((s) => ({
      id: s.id,
      name: s.name,
      initial: s.initial,
      icon: s.icon,
      status: suspectStatus(state, s.id),
    })) ?? [];

  const currentEv = run?.evidences[state.current] ?? null;
  const minLinks = run ? tierRequiresLinks(run.tier) : 0;
  const linkCount = Object.keys(state.links).length;

  const chips =
    run?.evidences
      .filter((ev) => state.earnedIds.includes(ev.id))
      .map((ev) => ({
        id: ev.id,
        chip: ev.constraint.chip,
        sentence: ev.constraint.sentence,
      })) ?? [];

  const presentationPhase =
    options.presentationPhase ??
    defaultPresentationPhase(state, overlay, pendingClueDiscovery);
  const focusTarget =
    options.focusTarget ?? defaultFocus(state, overlay, options.highlightedStationId);
  const currentStation = stations.find((station) => station.evidenceId === currentEv?.id) ?? null;
  const clueDiscoveryState = pendingClueDiscovery
    ? "discovering"
    : currentSlot?.solved
      ? "revealed"
      : "hidden";
  const chapterCurrent = run
    ? state.phase === "briefing"
      ? 0
      : Math.min(state.current + 1, stations.length)
    : 0;

  return {
    contractVersion: 1,
    sessionId: options.sessionId,
    caseId: run?.caseId ?? null,
    tier: run?.tier ?? null,
    mode: run?.mode ?? null,
    casePhase: state.phase,
    location: locationFor(state.phase, overlay),
    presentationPhase,
    stations,
    completedStationIds: stations.filter((s) => s.status === "completed").map((s) => s.evidenceId),
    clue: {
      evidenceId: currentEv?.id ?? null,
      goal: currentEv?.goal ?? null,
      presentation: currentEv?.presentation ?? null,
      solved: currentSlot?.solved ?? false,
      attempts: currentSlot?.attempts ?? 0,
      hintsUsed: currentSlot ? [...currentSlot.hintsUsed] : [],
      points: currentSlot?.points ?? null,
    },
    suspects,
    deduction: {
      earnedConstraintIds: [...state.earnedIds],
      chips,
      links: { ...state.links },
      canAccuse: state.phase === "board" && linkCount >= minLinks,
      minLinksRequired: minLinks,
    },
    overlay,
    focusTarget,
    layoutMode: options.layoutMode ?? "desktop",
    title: run?.title ?? null,
    intro: run?.intro ?? null,
    narrative: run?.narrative ?? null,
    outcome: state.outcome,
    rejection: state.rejection,
    animation: {
      generation: options.generation,
      reducedMotion: options.reducedMotion ?? false,
      captionsEnabled: options.captionsEnabled ?? true,
      pendingPresentationComplete: options.pendingPresentationComplete ?? false,
    },
    world: {
      setting: {
        id: run?.narrative.settingId ?? "detective-office",
        label: run?.narrative.settingLabel ?? "Detective office",
        objectFamilies: run
          ? [...new Set(Object.values(run.narrative.stationFamilies))]
          : ["office"],
      },
      chapter: {
        current: chapterCurrent,
        total: stations.length,
        label:
          chapterCurrent === 0
            ? "Case setup"
            : `Station ${chapterCurrent} of ${stations.length}`,
      },
      stations,
      suspects,
      clueDiscovery: {
        state: clueDiscoveryState,
        evidenceId: clueDiscoveryState === "hidden" ? null : currentEv?.id ?? null,
        chip: clueDiscoveryState === "hidden" ? null : currentEv?.constraint.chip ?? null,
        sentence:
          clueDiscoveryState === "hidden" ? null : currentEv?.constraint.sentence ?? null,
      },
      environmentalFeedback: worldFeedbackFor(state, pendingClueDiscovery, currentStation),
      transition: worldTransitionFor(
        state,
        pendingClueDiscovery,
        options.reducedMotion ?? false,
        options.captionsEnabled ?? true,
      ),
    },
  };
}

/** Deterministic focus restore after closing a React overlay back to the world. */
export function focusAfterOverlayClose(scene: SceneModel): FocusTarget {
  if (scene.casePhase === "evidence" && scene.clue.evidenceId) {
    return `world.station.${scene.clue.evidenceId}`;
  }
  if (scene.casePhase === "briefing") return "dom.briefingContinue";
  if (scene.casePhase === "summary") return "dom.summaryPrimary";
  return "world";
}

/** Ownership map for documentation / tests — not a runtime router. */
export const SURFACE_OWNERSHIP = {
  phaser: [
    "office",
    "evidenceStationMarkers",
    "stationAvailable",
    "stationCompleted",
    "clueDiscoveryMotion",
    "suspectPresentation",
    "deductionBoardMotion",
    "accusationStaging",
    "wrongAccusationRecoveryMotion",
    "verdictStaging",
    "summaryStaging",
    "pauseBackdrop",
    "reducedMotionFlags",
    "responsiveLayouts",
  ],
  reactDom: [
    "briefingCopy",
    "challengeTables",
    "numericForms",
    "selectors",
    "keypads",
    "equations",
    "semanticEvidenceText",
    "challengeResultCopy",
    "pauseSettingsControls",
    "captions",
    "focusTraps",
  ],
} as const;
