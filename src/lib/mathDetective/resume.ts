/**
 * Math Detective — session-only resume snapshots (UX_DESIGN §2 returning
 * player row). Memory lives at module scope so it dies with the tab — the
 * same privacy posture as records.ts. Free site never touches browser
 * storage (storage-guard contract).
 */
import type { EngineState } from "./engine";
import type { CaseRun } from "./types";

export interface ResumeSnapshot {
  run: CaseRun;
  engine: EngineState;
}

// Module scope = dies with the tab. Intentional.
let snapshot: ResumeSnapshot | null = null;

export function hasResume(): boolean {
  return snapshot !== null;
}

export function saveResume(run: CaseRun, engine: EngineState): void {
  if (engine.finished) return;
  snapshot = { run, engine };
}

/** Take (and clear) the stored snapshot, if any. */
export function takeResume(): ResumeSnapshot | null {
  const current = snapshot;
  snapshot = null;
  return current;
}

export function clearResume(): void {
  snapshot = null;
}

/** Test hook. */
export function resetResumeForTests(): void {
  snapshot = null;
}
