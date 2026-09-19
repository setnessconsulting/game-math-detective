/**
 * Math Detective — bounded scene intents (GAME-137).
 *
 * Phaser / React emit these. The host validates generation tokens and maps
 * only legal intents to EngineActions. Intents never contain a solver.
 */
import type { EngineAction, EngineState } from "../engine";
import { tierRequiresLinks } from "../engine";
import type { SceneIntentName } from "./intentNames";

export type { SceneIntentName } from "./intentNames";

/** Token stamped on every renderer-originated intent. */
export interface SceneIntentAuth {
  sessionId: string;
  generation: number;
  caseId: string;
}

export type SceneIntent =
  | (SceneIntentAuth & { t: "enterStation"; evidenceId: string })
  | (SceneIntentAuth & { t: "inspectEvidence"; evidenceId: string })
  | (SceneIntentAuth & { t: "openChallenge"; evidenceId: string })
  | (SceneIntentAuth & { t: "closeChallenge" })
  | (SceneIntentAuth & { t: "openDeduction" })
  | (SceneIntentAuth & { t: "chooseSuspect"; suspectId: string })
  | (SceneIntentAuth & { t: "accuse"; suspectId: string; linkedCount: number })
  | (SceneIntentAuth & { t: "continue" })
  | (SceneIntentAuth & { t: "presentationComplete"; token: string });

export type IntentDisposition =
  | { ok: true; kind: "engine"; action: EngineAction }
  | { ok: true; kind: "presentation"; effect: PresentationEffect }
  | { ok: false; reason: string };

export type PresentationEffect =
  | { t: "highlightStation"; evidenceId: string }
  | { t: "openOverlay"; overlay: "challenge" | "result" | "pause" | "accusationConfirm" }
  | { t: "closeOverlay" }
  | { t: "selectSuspect"; suspectId: string }
  | { t: "presentationUnblocked"; token: string };

export interface IntentContext {
  sessionId: string;
  generation: number;
  state: EngineState;
  /** Evidence id currently shown in a challenge overlay, if any. */
  openChallengeEvidenceId?: string | null;
}

export function isSceneIntentName(value: string): value is SceneIntentName {
  return (
    value === "enterStation" ||
    value === "inspectEvidence" ||
    value === "openChallenge" ||
    value === "closeChallenge" ||
    value === "openDeduction" ||
    value === "chooseSuspect" ||
    value === "accuse" ||
    value === "continue" ||
    value === "presentationComplete"
  );
}

/**
 * Validate auth tokens and map a bounded intent to either an engine action
 * or a presentation-only effect. Never invents case truth.
 */
export function resolveSceneIntent(intent: SceneIntent, ctx: IntentContext): IntentDisposition {
  if (intent.sessionId !== ctx.sessionId) {
    return { ok: false, reason: "stale-session" };
  }
  if (intent.generation !== ctx.generation) {
    return { ok: false, reason: "stale-generation" };
  }
  const caseId = ctx.state.run?.caseId ?? null;
  if (!caseId || intent.caseId !== caseId) {
    return { ok: false, reason: "stale-case" };
  }

  switch (intent.t) {
    case "continue": {
      if (ctx.state.phase === "briefing") {
        return { ok: true, kind: "engine", action: { t: "BEGIN" } };
      }
      if (ctx.state.phase === "evidence") {
        const slot = ctx.state.slots[ctx.state.current];
        if (slot?.solved) {
          return { ok: true, kind: "engine", action: { t: "ADVANCE" } };
        }
        return { ok: false, reason: "evidence-unsolved" };
      }
      if (ctx.state.phase === "checkpoint") {
        return { ok: true, kind: "engine", action: { t: "COMMIT_CHECKPOINT" } };
      }
      if (ctx.state.phase === "verdict" && ctx.state.outcome === "closed") {
        return { ok: true, kind: "engine", action: { t: "OPEN_SUMMARY" } };
      }
      if (ctx.state.phase === "verdict" && ctx.state.outcome === null) {
        return { ok: true, kind: "engine", action: { t: "RETRY_FROM_VERDICT" } };
      }
      if (ctx.state.phase === "guided") {
        return { ok: true, kind: "engine", action: { t: "FINISH_GUIDED" } };
      }
      return { ok: false, reason: `continue-illegal-phase:${ctx.state.phase}` };
    }

    case "enterStation":
    case "inspectEvidence": {
      if (ctx.state.phase !== "evidence" && ctx.state.phase !== "briefing") {
        return { ok: false, reason: "station-phase" };
      }
      const exists = ctx.state.run?.evidences.some((e) => e.id === intent.evidenceId);
      if (!exists) return { ok: false, reason: "unknown-station" };
      return {
        ok: true,
        kind: "presentation",
        effect: { t: "highlightStation", evidenceId: intent.evidenceId },
      };
    }

    case "openChallenge": {
      if (ctx.state.phase !== "evidence") return { ok: false, reason: "challenge-phase" };
      const current = ctx.state.run?.evidences[ctx.state.current];
      if (!current || current.id !== intent.evidenceId) {
        return { ok: false, reason: "challenge-not-current" };
      }
      if (ctx.state.slots[ctx.state.current]?.solved) {
        return { ok: false, reason: "challenge-already-solved" };
      }
      return {
        ok: true,
        kind: "presentation",
        effect: { t: "openOverlay", overlay: "challenge" },
      };
    }

    case "closeChallenge":
      return { ok: true, kind: "presentation", effect: { t: "closeOverlay" } };

    case "openDeduction": {
      if (ctx.state.phase !== "board" && ctx.state.phase !== "verdict") {
        return { ok: false, reason: "deduction-phase" };
      }
      return {
        ok: true,
        kind: "presentation",
        effect: { t: "openOverlay", overlay: "accusationConfirm" },
      };
    }

    case "chooseSuspect": {
      const exists = ctx.state.run?.suspects.some((s) => s.id === intent.suspectId);
      if (!exists) return { ok: false, reason: "unknown-suspect" };
      return {
        ok: true,
        kind: "presentation",
        effect: { t: "selectSuspect", suspectId: intent.suspectId },
      };
    }

    case "accuse": {
      if (ctx.state.phase !== "board" && ctx.state.phase !== "verdict") {
        return { ok: false, reason: "accuse-phase" };
      }
      // Settled cases must not re-accuse (drops duplicate/stale intents after close/guided).
      // Wrong-accusation retry remains legal while outcome is still null in verdict.
      if (ctx.state.outcome === "closed" || ctx.state.outcome === "guided") {
        return { ok: false, reason: "accuse-already-settled" };
      }
      const exists = ctx.state.run?.suspects.some((s) => s.id === intent.suspectId);
      if (!exists) return { ok: false, reason: "unknown-suspect" };
      const min = ctx.state.run ? tierRequiresLinks(ctx.state.run.tier) : 0;
      if (intent.linkedCount < min) {
        return { ok: false, reason: "insufficient-links" };
      }
      return {
        ok: true,
        kind: "engine",
        action: {
          t: "ACCUSE",
          suspectId: intent.suspectId,
          linkedCount: intent.linkedCount,
        },
      };
    }

    case "presentationComplete":
      return {
        ok: true,
        kind: "presentation",
        effect: { t: "presentationUnblocked", token: intent.token },
      };

    default:
      return { ok: false, reason: "unknown-intent" };
  }
}
