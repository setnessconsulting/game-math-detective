import { describe, expect, it } from "vitest";
import {
  createBreakWindow,
  MINI_BREAK_SECONDS,
  WRAP_SOON_MS,
} from "@/lib/mathDetective/breakWindow";

// MD-13: the earned-break window is a neutral schedule fact — pause freezes
// it, expiry loses nothing, and there is no extension path.

describe("mathDetective break window", () => {
  it("defaults to the ~90 s Mini Case window", () => {
    expect(MINI_BREAK_SECONDS).toBe(90);
    const t = 0;
    const w = createBreakWindow({ now: () => t });
    expect(w.windowSeconds).toBe(90);
    expect(w.remainingMs()).toBe(90_000);
    expect(w.isExpired()).toBe(false);
    expect(w.isWrappingSoon()).toBe(false);
  });

  it("counts down and flags the calm wrap-soon stretch", () => {
    let t = 0;
    const w = createBreakWindow({ now: () => t });
    t = 74_000;
    expect(w.isWrappingSoon()).toBe(false);
    t = 76_000; // 14 s left
    expect(w.isWrappingSoon()).toBe(true);
    expect(w.isExpired()).toBe(false);
    t = WRAP_SOON_MS + 76_000;
    expect(w.isExpired()).toBe(true);
    expect(w.remainingMs()).toBe(0);
  });

  it("freezes while paused and resumes with the remainder intact", () => {
    let t = 0;
    const w = createBreakWindow({ now: () => t });
    t = 30_000;
    w.pause();
    t = 90_000; // would have expired while paused
    expect(w.remainingMs()).toBe(60_000);
    expect(w.isExpired()).toBe(false);
    w.resume();
    t = 91_000;
    expect(w.remainingMs()).toBe(59_000);
    t = 150_000;
    expect(w.isExpired()).toBe(true);
  });

  it("never shows negative time and honors custom windows", () => {
    let t = 0;
    const w = createBreakWindow({ windowSeconds: 45, now: () => t });
    expect(w.windowSeconds).toBe(45);
    t = 100_000;
    expect(w.remainingMs()).toBe(0);
    expect(w.isExpired()).toBe(true);
  });
});


