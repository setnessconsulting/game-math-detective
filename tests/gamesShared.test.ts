import { describe, expect, it } from "vitest";
import { mulberry32, pickFrom, pickInt, shuffled } from "@/lib/games/shared/rng";
import { createSessionClock } from "@/lib/games/shared/session";
import {
  createBufferSink,
  latencyBucketMs,
  minutesBucketMs,
  MD_EVENT_FIELDS,
  type MdEvent,
  type MdEventName,
} from "@/lib/games/shared/telemetry";
import { clearResume, hasResume, resetResumeForTests, saveResume, takeResume } from "@/lib/mathDetective/resume";
import { recordOutcome, resetRecordsForTests, getTierRecord } from "@/lib/mathDetective/records";
import { generateCase } from "@/lib/mathDetective/solver";
import type { PresentationPayload } from "@/lib/mathDetective/types";

// MD-01: shared game primitives. These tests pin the contracts that other
// games (Number Line Jumper, Math Detective) consume.

// ---------------------------------------------------------------------------
// Shared PRNG
// ---------------------------------------------------------------------------

describe("games/shared rng", () => {
  it("is bit-for-bit mulberry32 (legacy parity)", () => {
    function legacy(seed: number): () => number {
      let a = seed >>> 0;
      return function next() {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    for (const seed of [0, 1, 42, 987_654_321, 0xffffffff]) {
      const shared = mulberry32(seed);
      const old = legacy(seed);
      for (let i = 0; i < 500; i += 1) {
        expect(shared()).toBe(old());
      }
    }
  });

  it("produces identical sequences for identical seeds (consumer parity)", () => {
    const a = mulberry32(777);
    const b = mulberry32(777);
    for (let i = 0; i < 100; i += 1) expect(a()).toBe(b());
  });

  it("pickInt covers the inclusive range and pickFrom/shuffled stay deterministic", () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 300; i += 1) {
      const v = pickInt(rng, -2, 2);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThanOrEqual(2);
    }
    const list = [1, 2, 3, 4, 5] as const;
    expect(pickFrom(mulberry32(9), list)).toBe(pickFrom(mulberry32(9), list));
    expect(shuffled(mulberry32(9), list)).toEqual(shuffled(mulberry32(9), list));
    expect([...shuffled(mulberry32(9), list)].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5]);
  });
});

// ---------------------------------------------------------------------------
// SessionClock (visibility pause / cap enforcement)
// ---------------------------------------------------------------------------

describe("games/shared SessionClock", () => {
  it("accumulates only while running and freezes on pause (visibility)", () => {
    let t = 0;
    const clock = createSessionClock(() => t);
    clock.start(10_000);
    t = 3_000;
    expect(clock.activeMs()).toBe(3_000);
    clock.pause(); // e.g. tab hidden
    t = 9_000;
    expect(clock.activeMs()).toBe(3_000); // hidden time does not count
    clock.resume();
    t = 10_500;
    expect(clock.activeMs()).toBe(4_500);
    expect(clock.expired()).toBe(false);
    t = 12_000;
    expect(clock.activeMs()).toBe(6_000);
    expect(clock.expired()).toBe(false);
  });

  it("expires exactly at the cap and restarts cleanly", () => {
    let t = 0;
    const clock = createSessionClock(() => t);
    clock.start(5_000);
    t = 5_000;
    expect(clock.expired()).toBe(true);
    clock.start(5_000);
    expect(clock.activeMs()).toBe(0);
    expect(clock.expired()).toBe(false);
    expect(clock.capMs).toBe(5_000);
  });

  it("never expires before start", () => {
    const clock = createSessionClock(() => 123);
    expect(clock.expired()).toBe(false);
    expect(clock.capMs).toBe(0);
  });

  it("double pause/resume is idempotent", () => {
    let t = 0;
    const clock = createSessionClock(() => t);
    clock.start(60_000);
    t = 1_000;
    clock.pause();
    clock.pause();
    t = 2_000;
    clock.resume();
    clock.resume();
    t = 2_500;
    expect(clock.activeMs()).toBe(1_500);
  });
});

// ---------------------------------------------------------------------------
// Telemetry port primitives
// ---------------------------------------------------------------------------

describe("games/shared telemetry", () => {
  it("buffers events session-only with a bounded ring", () => {
    const sink = createBufferSink(3);
    for (let i = 0; i < 5; i += 1) {
      sink.emit({ name: "mdetect.error", at: i, data: { context: "test", code: String(i) } });
    }
    expect(sink.events.length).toBe(3);
    expect(sink.events[0]!.data.code).toBe("2");
  });

  it("buckets latency and minutes without raw timings", () => {
    expect(latencyBucketMs(0)).toBe("<5s");
    expect(latencyBucketMs(6_000)).toBe("5-15s");
    expect(latencyBucketMs(20_000)).toBe("15-45s");
    expect(latencyBucketMs(50_000)).toBe(">45s");
    expect(minutesBucketMs(90_000)).toBe("<2m");
    expect(minutesBucketMs(3 * 60_000)).toBe("2-5m");
    expect(minutesBucketMs(7 * 60_000)).toBe("5-10m");
    expect(minutesBucketMs(11 * 60_000)).toBe(">10m");
  });

  it("defines an allowlist field set for every canonical event name", () => {
    const names = Object.keys(MD_EVENT_FIELDS) as MdEventName[];
    expect(names).toHaveLength(8);
    for (const name of names) {
      expect(MD_EVENT_FIELDS[name]!.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Payload contract shapes (REQUIREMENTS §13.3)
// ---------------------------------------------------------------------------

describe("mathDetective payload contract shapes", () => {
  const samples: PresentationPayload[] = [
    { kind: "ruler", shelfTopCm: 120 },
    { kind: "clockPair", startH: 3, startM: 15, endH: 3, endM: 50, startLabel: "a", endLabel: "b" },
    { kind: "dataTable", title: "t", unitNoun: "n", rows: [{ label: "x", value: 1 }], total: 2 },
    { kind: "receipt", place: "p", lines: [{ label: "l", unitCents: 100, qty: 2 }] },
    { kind: "fractionBar", totalSlices: 8, eatenN: 3, eatenD: 4, label: "3/4" },
    { kind: "gridMap", rows: 4, cols: 4, markedRow: 2, markedCol: 3, witnessText: "w" },
    { kind: "expressionCode", a: 4, b: 5, c: 3, firstOp: "×", secondOp: "−", label: "l" },
    { kind: "tileEquation", target: 34, tiles: ["3", "4", "×", "+", "2"] },
    { kind: "statList", unit: "steps", readings: [2000, 3000] },
    { kind: "recipeScale", baseServings: 2, targetServings: 8, ingredient: "oats", amountPerBase: 1, unit: "cups" },
    { kind: "claimCard", claim: "c", flips: 5 },
  ];

  it("every presentation kind carries a discriminant and bounded fields", () => {
    expect(samples.length).toBe(11);
    for (const p of samples) {
      expect(typeof p.kind).toBe("string");
      expect(p.kind.length).toBeGreaterThan(2);
    }
  });

  it("generated cases only use registered presentation kinds", () => {
    const known = new Set(samples.map((p) => p.kind));
    for (const tier of ["D1", "D3", "D5"] as const) {
      for (let seed = 0; seed < 25; seed += 1) {
        for (const ev of generateCase({ seed, tier, mode: "full" }).evidences) {
          expect(known.has(ev.presentation.kind)).toBe(true);
          expect(ev.answer.type).toBe("number");
          expect(Number.isFinite(ev.answer.value)).toBe(true);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Session-only stores (records + resume) — never browser storage
// ---------------------------------------------------------------------------

describe("games session-only stores", () => {
  it("records reset on reload semantics (fresh module state via test hook)", () => {
    resetRecordsForTests();
    recordOutcome("D2", 60);
    expect(getTierRecord("D2").bestIndependence).toBe(60);
    resetRecordsForTests();
    expect(getTierRecord("D2").bestIndependence).toBe(0);
  });

  it("resume snapshot round-trips and clears on take", () => {
    resetResumeForTests();
    expect(hasResume()).toBe(false);
    const run = generateCase({ seed: 1, tier: "D1", mode: "mini" });
    saveResume(run, {
      phase: "board",
      run,
      current: 0,
      slots: [],
      aliveIds: [],
      earnedIds: [],
      accusations: [],
      checkpointMarks: {},
      streak: 0,
      startedAt: 0,
      wrapPending: false,
      capReached: false,
      outcome: null,
      finished: false,
      links: {},
      rejection: null,
    });
    expect(hasResume()).toBe(true);
    const snap = takeResume();
    expect(snap?.run.caseId).toBe(run.caseId);
    expect(snap?.engine.phase).toBe("board");
    expect(hasResume()).toBe(false);
  });

  it("resume refuses to store a finished case", () => {
    resetResumeForTests();
    const run = generateCase({ seed: 2, tier: "D1", mode: "mini" });
    saveResume(run, {
      phase: "summary",
      run,
      current: 0,
      slots: [],
      aliveIds: [],
      earnedIds: [],
      accusations: [],
      checkpointMarks: {},
      streak: 0,
      startedAt: 0,
      wrapPending: false,
      capReached: false,
      outcome: "closed",
      finished: true,
      links: {},
      rejection: null,
    });
    expect(hasResume()).toBe(false);
    clearResume();
  });
});

// Type-level guard: MdEvent values must stay primitive (compiles or fails).
const _primitiveCheck: MdEvent["data"] = { a: 1, b: "x", c: true, d: null };
void _primitiveCheck;


