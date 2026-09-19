/**
 * Math Detective — earned-break window seam (story MD-13 / CONSULTING-228).
 *
 * The break window is a neutral schedule fact, never a threat: pausing
 * freezes the remaining time, expiry loses nothing (the engine's
 * finish-current-item grace rule wraps the case cleanly), and there is no
 * "earn more time" path anywhere.
 *
 * External dependency (declared): the host app shell's lesson-block-complete
 * hook creates this window when a block finishes, renders the neutral
 * countdown strip OUTSIDE game chrome, and calls the game back via
 * `onBreakComplete` when practice resumes. The hook itself lives in the
 * Tier 1 shell (outside this epic's repos-side scope); the free site never
 * shows break mode.
 */
import type { SessionClock } from "@/lib/games/shared/session";

export const MINI_BREAK_SECONDS = 90; // REQUIREMENTS §7 earned-break window

export interface BreakWindowOptions {
  windowSeconds?: number;
  /** Injectable clock for deterministic tests. Defaults to Date.now. */
  now?: () => number;
}

export interface BreakWindow {
  readonly windowSeconds: number;
  /** Milliseconds left; 0 once expired. Frozen while paused. */
  remainingMs(): number;
  isExpired(): boolean;
  /** True during the final stretch when the shell may show its calm strip. */
  isWrappingSoon(): boolean;
  pause(): void;
  resume(): void;
}

export const WRAP_SOON_MS = 15_000; // UX earned-break variant: calm strip in final 15 s

export function createBreakWindow(options: BreakWindowOptions = {}): BreakWindow {
  const now = options.now ?? Date.now;
  const windowSeconds = options.windowSeconds ?? MINI_BREAK_SECONDS;
  const windowMs = Math.max(0, Math.round(windowSeconds * 1000));
  let endAt = now() + windowMs;
  let pausedRemainingMs: number | null = null;

  return {
    windowSeconds,
    remainingMs() {
      if (pausedRemainingMs !== null) return pausedRemainingMs;
      return Math.max(0, endAt - now());
    },
    isExpired() {
      return this.remainingMs() <= 0;
    },
    isWrappingSoon() {
      return this.remainingMs() > 0 && this.remainingMs() <= WRAP_SOON_MS;
    },
    pause() {
      if (pausedRemainingMs === null) pausedRemainingMs = this.remainingMs();
    },
    resume() {
      if (pausedRemainingMs !== null) {
        endAt = now() + pausedRemainingMs;
        pausedRemainingMs = null;
      }
    },
  };
}

/**
 * Wiring note for the future host binding (kept beside the seam so the
 * contract cannot drift):
 *
 * 1. Host: on lesson-block completion → show break offer (Mini Case option).
 * 2. Host: on Mini Case chosen → mount MathDetective with
 *    `earnedBreakSeconds={90}` and `onBreakComplete={resumePractice}`.
 * 3. Game: runs a Mini Case; at window expiry dispatches WRAP_REQUEST —
 *    the engine finishes the current item, then wraps to verdict/summary.
 * 4. Host: renders the neutral countdown strip itself (never red, never
 *    pulsing, never inside game chrome).
 * 5. Game: when the summary phase arrives with an expired window, calls
 *    `onBreakComplete` once so the shell returns to practice with a tick.
 *
 * The SessionClock hard cap (MINI_CASE_CAP_MS) stays as the backstop for
 * free-site Quick Cases; the break window simply fires the same wrap
 * earlier. No copy counts down inside the game.
 */
export type BreakBindings = {
  earnedBreakSeconds: number | null;
  onBreakComplete: (() => void) | null;
  clock: SessionClock | null;
};
