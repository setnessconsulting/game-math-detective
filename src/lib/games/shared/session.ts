/**
 * SessionClock — bounded play-session timing with pause support.
 *
 * Used by Math Detective to enforce the hard session cap
 * (REQUIREMENTS §7) with the finish-current-item grace rule handled by
 * the engine: the clock only flags expiry; it never interrupts an item.
 *
 * No wall-clock pressure surfaces in game UI — this is a cap, not a timer.
 */
export interface SessionClock {
  /** Begin (or restart) counting against capMs. */
  start(capMs: number): void;
  /** Stop accumulating (tab hidden / paused). */
  pause(): void;
  /** Resume after pause(). */
  resume(): void;
  /** Milliseconds of active play accumulated since start(). */
  activeMs(): number;
  /** True once active time has reached the configured cap. */
  expired(): boolean;
  /** Configured cap in ms (0 until start). */
  readonly capMs: number;
}

export function createSessionClock(now: () => number = () => Date.now()): SessionClock {
  let cap = 0;
  let anchor = 0;
  let accumulated = 0;
  let running = false;

  return {
    start(newCapMs: number) {
      cap = newCapMs;
      accumulated = 0;
      anchor = now();
      running = true;
    },
    pause() {
      if (!running) return;
      accumulated += now() - anchor;
      running = false;
    },
    resume() {
      if (running) return;
      anchor = now();
      running = true;
    },
    activeMs() {
      return accumulated + (running ? now() - anchor : 0);
    },
    expired() {
      return cap > 0 && this.activeMs() >= cap;
    },
    get capMs() {
      return cap;
    },
  };
}

export const MINI_CASE_CAP_MS = 150_000; // REQUIREMENTS §7 mini hard wrap
export const FULL_CASE_CAP_MS = 600_000; // REQUIREMENTS §7 full soft-wrap cue then auto-summary
