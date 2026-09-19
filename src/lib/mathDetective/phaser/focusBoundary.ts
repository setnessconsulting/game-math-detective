/**
 * Focus-boundary helpers for Phaser world ↔ React challenge overlays.
 */
import type { FocusTarget, SceneModel } from "../scene";
import { focusAfterOverlayClose } from "../scene";

export interface FocusBoundaryEvent {
  from: FocusTarget;
  to: FocusTarget;
  reason: "open-challenge" | "show-result" | "close-to-world" | "briefing" | "summary";
}

export function planFocusTransition(
  scene: SceneModel,
  nextOverlay: SceneModel["overlay"],
): FocusBoundaryEvent {
  const from = scene.focusTarget;
  if (nextOverlay === "challenge") {
    return { from, to: "overlay.challenge", reason: "open-challenge" };
  }
  if (nextOverlay === "result") {
    return { from, to: "overlay.result", reason: "show-result" };
  }
  if (nextOverlay === "none") {
    const to = focusAfterOverlayClose({ ...scene, overlay: "none" });
    return { from, to, reason: "close-to-world" };
  }
  if (scene.casePhase === "briefing") {
    return { from, to: "dom.briefingContinue", reason: "briefing" };
  }
  return { from, to: "dom.summaryPrimary", reason: "summary" };
}

/** True when the restore target is a named, deterministic focus hook. */
export function isDeterministicFocusTarget(target: FocusTarget): boolean {
  if (target === "world") return true;
  if (target === "overlay.challenge") return true;
  if (target === "overlay.result") return true;
  if (target === "overlay.pause") return true;
  if (target === "overlay.accusation") return true;
  if (target === "dom.briefingContinue") return true;
  if (target === "dom.summaryPrimary") return true;
  return target.startsWith("world.station.");
}
