/**
 * Math Detective — D1–D5 golden fixture definitions (GAME-136).
 *
 * Seeds are fixed so regeneration is deterministic. Traces are computed at
 * load/test time from the live generator + engine; they are not hand-authored
 * case semantics (those remain in generate/solver/engine).
 */
import {
  initialEngineState,
  reduce,
  summarizeCase,
  tierRequiresLinks,
  type EngineAction,
  type EngineState,
  type Effect,
} from "../engine";
import { generateCase, verifyCaseRun } from "../solver";
import type { CaseMode, DifficultyTier } from "../types";
import { projectCase, type ProjectedCase } from "./project";

const TRACE_NOW = 1_700_000_000_000;

export interface GoldenFixtureSpec {
  id: string;
  seed: number;
  tier: DifficultyTier;
  mode: CaseMode;
  /** Representative station family expected somewhere in the evidence list. */
  expectedPresentationKinds?: string[];
}

/** One full-mode case per D1–D5 plus one mini-mode case for resume/mini coverage. */
export const GOLDEN_FIXTURE_SPECS: readonly GoldenFixtureSpec[] = [
  { id: "D1-full", seed: 42, tier: "D1", mode: "full" },
  { id: "D2-full", seed: 42, tier: "D2", mode: "full" },
  { id: "D3-full", seed: 42, tier: "D3", mode: "full" },
  { id: "D4-full", seed: 42, tier: "D4", mode: "full" },
  { id: "D5-full", seed: 42, tier: "D5", mode: "full" },
  { id: "D3-mini", seed: 17, tier: "D3", mode: "mini" },
] as const;

export interface EliminationStep {
  afterEvidenceIndex: number;
  evidenceId: string;
  skillId: string;
  aliveIds: string[];
  earnedIds: string[];
  pointsAwarded: number;
}

export interface ChallengeTraceStep {
  evidenceId: string;
  wrongValue: number;
  wrongAttempts: number;
  correctValue: number;
  hintsUsed: number[];
  points: number;
}

export interface AccusationTrace {
  wrongSuspectId: string;
  contradictedBy: string[];
  retryReturnedToBoard: boolean;
  secondWrongEnteredGuided: boolean;
  correctSuspectId: string;
  finalOutcome: "closed" | "guided" | null;
  telemetryNames: string[];
}

export interface GoldenFixture {
  spec: GoldenFixtureSpec;
  projected: ProjectedCase;
  uniquenessOk: boolean;
  uniquenessProblems: string[];
  eliminationSequence: EliminationStep[];
  challengeTraces: ChallengeTraceStep[];
  hintProgression: { evidenceId: string; levels: number[] }[];
  accusation: AccusationTrace;
  scoring: {
    totalPoints: number;
    independenceScore: number;
    evidenceSolved: number;
  };
  finalVerdict: {
    phase: EngineState["phase"];
    outcome: EngineState["outcome"];
    finished: boolean;
    culpritId: string;
  };
}

function dispatch(
  state: EngineState,
  action: EngineAction,
): { state: EngineState; effects: Effect[]; telemetry: string[] } {
  const { state: next, effects } = reduce(state, action, TRACE_NOW);
  const telemetry = effects
    .filter((e): e is Extract<Effect, { kind: "telemetry" }> => e.kind === "telemetry")
    .map((e) => e.event.name);
  return { state: next, effects, telemetry };
}

function driveToBoard(state: EngineState): {
  state: EngineState;
  elimination: EliminationStep[];
  challenges: ChallengeTraceStep[];
  hints: { evidenceId: string; levels: number[] }[];
  telemetry: string[];
} {
  let s = state;
  const elimination: EliminationStep[] = [];
  const challenges: ChallengeTraceStep[] = [];
  const hints: { evidenceId: string; levels: number[] }[] = [];
  const telemetry: string[] = [];

  const step = (action: EngineAction) => {
    const r = dispatch(s, action);
    s = r.state;
    telemetry.push(...r.telemetry);
    return r;
  };

  for (let guard = 0; guard < 80; guard += 1) {
    if (s.phase === "board") break;
    if (s.phase === "briefing") {
      step({ t: "BEGIN" });
      continue;
    }
    if (s.phase === "checkpoint") {
      step({ t: "COMMIT_CHECKPOINT" });
      continue;
    }
    if (s.phase === "evidence") {
      const slot = s.slots[s.current]!;
      const item = s.run!.evidences[s.current]!;
      if (!slot.solved) {
        const wrongValue = item.answer.value + 1000;
        step({ t: "SUBMIT_ANSWER", itemId: item.id, value: wrongValue, latencyMs: 800 });
        step({ t: "REQUEST_HINT", itemId: item.id, level: 1 });
        hints.push({ evidenceId: item.id, levels: [1] });
        const before = s;
        step({ t: "SUBMIT_ANSWER", itemId: item.id, value: item.answer.value, latencyMs: 1200 });
        const solvedSlot = s.slots[s.current]!;
        challenges.push({
          evidenceId: item.id,
          wrongValue,
          wrongAttempts: before.slots[s.current]!.attempts,
          correctValue: item.answer.value,
          hintsUsed: [...solvedSlot.hintsUsed],
          points: solvedSlot.points ?? 0,
        });
        elimination.push({
          afterEvidenceIndex: s.current,
          evidenceId: item.id,
          skillId: item.skillId,
          aliveIds: [...s.aliveIds],
          earnedIds: [...s.earnedIds],
          pointsAwarded: solvedSlot.points ?? 0,
        });
      } else {
        step({ t: "ADVANCE" });
      }
      continue;
    }
    throw new Error(`driveToBoard stalled in phase ${s.phase}`);
  }
  if (s.phase !== "board") throw new Error(`expected board, got ${s.phase}`);
  return { state: s, elimination, challenges, hints, telemetry };
}

export function buildGoldenFixture(spec: GoldenFixtureSpec): GoldenFixture {
  const run = generateCase({ seed: spec.seed, tier: spec.tier, mode: spec.mode });
  const verification = verifyCaseRun(run);
  const projected = projectCase(run);

  let s = initialEngineState();
  const started = dispatch(s, { t: "START", run });
  s = started.state;

  const driven = driveToBoard(s);
  s = driven.state;

  const wrongSuspect = run.suspects.find((x) => x.id !== run.culpritId)!;
  const linkCount = Math.max(tierRequiresLinks(run.tier), 2);
  const telemetryNames = [...started.telemetry, ...driven.telemetry];

  const firstWrong = dispatch(s, {
    t: "ACCUSE",
    suspectId: wrongSuspect.id,
    linkedCount: linkCount,
  });
  s = firstWrong.state;
  telemetryNames.push(...firstWrong.telemetry);
  const contradictedBy = [...(s.accusations[0]?.contradictedBy ?? [])];

  const retry = dispatch(s, { t: "RETRY_FROM_VERDICT" });
  s = retry.state;
  const retryReturnedToBoard = s.phase === "board";

  const secondWrong = dispatch(s, {
    t: "ACCUSE",
    suspectId: wrongSuspect.id,
    linkedCount: linkCount,
  });
  s = secondWrong.state;
  telemetryNames.push(...secondWrong.telemetry);
  const secondWrongEnteredGuided = s.phase === "guided";

  // From guided, finish; otherwise we already entered guided on second wrong.
  // For the golden "correct path" after documenting wrong recovery, rebuild a
  // fresh board solve and accuse correctly so scoring/verdict are also frozen.
  let closed = initialEngineState();
  closed = dispatch(closed, { t: "START", run }).state;
  const clean = driveToBoard(closed);
  closed = clean.state;
  const correctAccuse = dispatch(closed, {
    t: "ACCUSE",
    suspectId: run.culpritId,
    linkedCount: linkCount,
  });
  closed = correctAccuse.state;
  telemetryNames.push(...correctAccuse.telemetry);
  const summary = dispatch(closed, { t: "OPEN_SUMMARY" });
  closed = summary.state;
  telemetryNames.push(...summary.telemetry);

  const scored = summarizeCase(closed);

  return {
    spec,
    projected,
    uniquenessOk: verification.ok,
    uniquenessProblems: verification.problems,
    eliminationSequence: driven.elimination,
    challengeTraces: driven.challenges,
    hintProgression: driven.hints,
    accusation: {
      wrongSuspectId: wrongSuspect.id,
      contradictedBy,
      retryReturnedToBoard,
      secondWrongEnteredGuided,
      correctSuspectId: run.culpritId,
      finalOutcome: closed.outcome,
      telemetryNames: [...new Set(telemetryNames)],
    },
    scoring: {
      totalPoints: scored.totalPoints,
      independenceScore: scored.independenceScore,
      evidenceSolved: scored.evidenceSolved,
    },
    finalVerdict: {
      phase: closed.phase,
      outcome: closed.outcome,
      finished: closed.finished,
      culpritId: run.culpritId,
    },
  };
}

export function buildAllGoldenFixtures(): GoldenFixture[] {
  return GOLDEN_FIXTURE_SPECS.map(buildGoldenFixture);
}
