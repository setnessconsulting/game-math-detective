/**
 * Math Detective — engine core (REQUIREMENTS §§4–8, seam 3).
 *
 * Pure reducer over briefing → evidence → checkpoint → board → verdict →
 * guided → summary. Contains no math facts, case text, or mastery rules —
 * those live in the generation and learner-model seams. Emits effects
 * (telemetry / announcements / sound cues); the shell applies them.
 *
 * Behavioral reference: docs/games/math-detective/prototype/engine.js.
 */
import { MD_EVENTS, latencyBucketMs, minutesBucketMs } from "@/lib/games/shared/telemetry";
import { SKILL_REGISTRY } from "./skills";
import type {
  CaseRun,
  Constraint,
  GeneratedEvidence,
  SuspectAttrs,
} from "./types";

// ---------------------------------------------------------------------------
// Scoring contract (§6): taper by attempt, cap by deepest hint used.
// ---------------------------------------------------------------------------

export function scoreEvidence(attemptIndex: number, hintsUsed: readonly number[]): number {
  const base = attemptIndex <= 0 ? 10 : attemptIndex === 1 ? 6 : 3;
  const maxHint = hintsUsed.length ? Math.max(...hintsUsed) : 0;
  const cap = maxHint >= 3 ? 3 : maxHint >= 1 ? 6 : base;
  return Math.min(base, cap);
}

export function evaluateConstraint(c: Constraint, attrs: SuspectAttrs): boolean {
  return c.test(attrs);
}

// ---------------------------------------------------------------------------
// State & actions
// ---------------------------------------------------------------------------

export type DetectivePhase =
  | "briefing"
  | "evidence"
  | "checkpoint"
  | "board"
  | "verdict"
  | "guided"
  | "summary";

export interface SlotState {
  itemId: string;
  solved: boolean;
  attempts: number;
  hintsUsed: number[];
  points: number | null;
  firstTryNoHint: boolean;
}

export interface AccusationRecord {
  suspectId: string;
  correct: boolean;
  /** Earned constraint ids that contradict the accused suspect. */
  contradictedBy: string[];
}

export interface LinkState {
  /** key = `${suspectId}|${constraintId}` → ruled out */
  links: Record<string, true>;
}

export interface EngineState extends LinkState {
  phase: DetectivePhase;
  run: CaseRun | null;
  current: number;
  slots: SlotState[];
  aliveIds: string[];
  earnedIds: string[];
  accusations: AccusationRecord[];
  checkpointMarks: Record<string, boolean>;
  /** Consecutive first-try-no-hint solves within this case (§6 sharp streak). */
  streak: number;
  /** Epoch ms captured at START for the minutes-spent bucket (§10). */
  startedAt: number | null;
  wrapPending: boolean;
  capReached: boolean;
  outcome: "closed" | "guided" | null;
  finished: boolean;
  /** Set when an action was rejected (e.g. accusation without enough links). */
  rejection: string | null;
}

export function initialEngineState(): EngineState {
  return {
    phase: "briefing",
    run: null,
    current: 0,
    slots: [],
    aliveIds: [],
    earnedIds: [],
    accusations: [],
    checkpointMarks: {},
    streak: 0,
    startedAt: null,
    wrapPending: false,
    capReached: false,
    outcome: null,
    finished: false,
    links: {},
    rejection: null,
  };
}

export type EngineAction =
  | { t: "START"; run: CaseRun }
  | { t: "BEGIN" }
  | { t: "SUBMIT_ANSWER"; itemId: string; value: number; latencyMs?: number }
  | { t: "REQUEST_HINT"; itemId: string; level: 1 | 2 | 3 | 4 }
  | { t: "ADVANCE" }
  | { t: "WRAP_REQUEST" }
  | { t: "CHECKPOINT_MARK"; suspectId: string; alive: boolean }
  | { t: "COMMIT_CHECKPOINT" }
  | { t: "TOGGLE_LINK"; suspectId: string; constraintId: string }
  | { t: "ACCUSE"; suspectId: string; linkedCount: number }
  | { t: "RETRY_FROM_VERDICT" }
  | { t: "FINISH_GUIDED" }
  | { t: "OPEN_SUMMARY" };

export type Effect =
  | { kind: "telemetry"; event: import("@/lib/games/shared/telemetry").MdEvent }
  | { kind: "announce"; text: string }
  | {
      kind: "feedback";
      itemId: string;
      correct: boolean;
      submittedValue: number;
      misconceptionTag: string;
      text: string;
    }
  | { kind: "cue"; name: "ok" | "no" | "win" };

const FEEDBACK_GUIDANCE: Record<string, string> = {
  "ruler-read": "Check the endpoint and count the small marks between labels.",
  "elapsed-time": "Read both clocks, then count forward in five-minute steps.",
  "table-missing-cell": "Add the visible rows and compare them with the total.",
  "receipt-total": "Multiply each price by its quantity, then add the lines.",
  "fraction-of-set": "Split the whole into equal groups before taking the numerator.",
  "coordinate-read": "Read the row first, then the column, to build the square number.",
  "expression-evaluate": "Follow the operation symbols in the code from left to right.",
  "recipe-scale": "Find the amount for one serving, then scale to the new servings.",
  "median-find": "Order the readings before choosing the middle value.",
  "compound-outcomes": "Count the equally likely outcomes for every coin flip.",
};

export function wrongAnswerFeedback(item: GeneratedEvidence, submittedValue: number): {
  misconceptionTag: string;
  text: string;
} {
  const shown = Number.isInteger(submittedValue)
    ? String(submittedValue)
    : submittedValue.toFixed(2);
  const guidance =
    FEEDBACK_GUIDANCE[item.misconceptionTag] ??
    "Look closely at the evidence and choose the operation it asks for.";
  return {
    misconceptionTag: item.misconceptionTag,
    text: `You entered ${shown}. ${guidance}`,
  };
}

function attrsById(run: CaseRun): Map<string, SuspectAttrs> {
  return new Map(run.suspects.map((s) => [s.id, s.attrs]));
}

function applyConstraints(run: CaseRun, earned: GeneratedEvidence[]): string[] {
  const map = attrsById(run);
  let ids = run.suspects.map((s) => s.id);
  for (const ev of earned) {
    ids = ids.filter((id) => ev.constraint.test(map.get(id)!));
  }
  return ids;
}

function finishSummary(state: EngineState, effects: Effect[], now: number): EngineState {
  const summary = summarizeCase({ ...state, phase: "summary", finished: true });
  const minutes = state.startedAt === null ? 0 : Math.max(0, now - state.startedAt);
  // §10 outcome: a cap wrap that never reached a verdict is an honest
  // "abandoned-at-cap", not a closed case.
  const outcome = state.outcome ?? (state.capReached ? "abandoned-at-cap" : "closed");
  effects.push({
    kind: "telemetry",
    event: {
      name: MD_EVENTS.caseCompleted,
      at: now,
      data: {
        caseId: state.run?.caseId ?? "",
        tier: state.run?.tier ?? "",
        mode: state.run?.mode ?? "",
        outcome,
        independenceScore: summary.independenceScore,
        totalPoints: summary.totalPoints,
        minutesSpentBucket: minutesBucketMs(minutes),
        skills: summary.skills.join(","),
      },
    },
  });
  return {
    ...state,
    phase: "summary",
    finished: true,
    rejection: null,
  };
}

/** Primary reducer. `now` is injectable for deterministic tests. */
export function reduce(
  state: EngineState,
  action: EngineAction,
  now: number = Date.now(),
): { state: EngineState; effects: Effect[] } {
  const effects: Effect[] = [];
  const emit = (name: (typeof MD_EVENTS)[keyof typeof MD_EVENTS], data: Record<string, string | number | boolean>) => {
    effects.push({ kind: "telemetry", event: { name, at: now, data } });
  };
  const say = (text: string) => effects.push({ kind: "announce", text });

  switch (action.t) {
    case "START": {
      const next: EngineState = {
        ...initialEngineState(),
        run: action.run,
        aliveIds: action.run.suspects.map((s) => s.id),
        slots: action.run.evidences.map((ev) => ({
          itemId: ev.id,
          solved: false,
          attempts: 0,
          hintsUsed: [],
          points: null,
          firstTryNoHint: false,
        })),
        startedAt: now,
      };
      emit(MD_EVENTS.caseStarted, {
        caseId: action.run.caseId,
        tier: action.run.tier,
        mode: action.run.mode,
        stationIds: action.run.evidences.map((e) => e.skillId).join(","),
        suspectCount: action.run.suspects.length,
      });
      return { state: next, effects };
    }

    case "BEGIN": {
      if (!state.run || state.phase !== "briefing") break;
      const ev = state.run.evidences[0]!;
      emit(MD_EVENTS.evidencePresented, {
        itemId: ev.id,
        skillId: ev.skillId,
        presentation: ev.presentation.kind,
      });
      say(ev.goal);
      return { state: { ...state, phase: "evidence", current: 0, rejection: null }, effects };
    }

    case "SUBMIT_ANSWER": {
      if (!state.run || state.phase !== "evidence") break;
      const idx = state.current;
      const slot = state.slots[idx]!;
      if (!slot || slot.solved || slot.itemId !== action.itemId) break;
      const item = state.run.evidences[idx]!;
      const correct = action.value === item.answer.value;

      if (!correct) {
        const slots = state.slots.map((s, i) =>
          i === idx ? { ...s, attempts: s.attempts + 1 } : s,
        );
        emit(MD_EVENTS.evidenceAnswered, {
          itemId: slot.itemId,
          skillId: item.skillId,
          correct: false,
          attemptCount: slot.attempts + 1,
          hintsUsed: slot.hintsUsed.join(","),
          latencyBucket: latencyBucketMs(action.latencyMs ?? 0),
          misconceptionTag: item.misconceptionTag,
        });
        const feedback = wrongAnswerFeedback(item, action.value);
        effects.push({
          kind: "feedback",
          itemId: item.id,
          correct: false,
          submittedValue: action.value,
          ...feedback,
        });
        return { state: { ...state, slots, rejection: null }, effects };
      }

      const points = scoreEvidence(slot.attempts, slot.hintsUsed);
      const firstTryNoHint = slot.attempts === 0 && slot.hintsUsed.length === 0;
      const slots = state.slots.map((s, i) =>
        i === idx ? { ...s, solved: true, points, firstTryNoHint } : s,
      );
      const earnedEvs = state.run.evidences.filter(
        (ev) => ev.id === slot.itemId || state.earnedIds.includes(ev.id),
      );
      const aliveIds = applyConstraints(state.run, earnedEvs);
      const earnedIds = [...state.earnedIds, slot.itemId];
      // §6: streak grows on first-try-no-hint solves; non-first-try solves
      // end it. Resets are quiet — no effect, no announcement, no loss copy.
      const streak = firstTryNoHint ? state.streak + 1 : 0;
      emit(MD_EVENTS.evidenceAnswered, {
        itemId: slot.itemId,
        skillId: item.skillId,
        correct: true,
        attemptCount: slot.attempts + 1,
        hintsUsed: slot.hintsUsed.join(","),
        latencyBucket: latencyBucketMs(action.latencyMs ?? 0),
        misconceptionTag: item.misconceptionTag,
      });
      say(`Clue earned. ${item.constraint.sentence} Plus ${points} points.`);
      effects.push({
        kind: "feedback",
        itemId: item.id,
        correct: true,
        submittedValue: action.value,
        misconceptionTag: item.misconceptionTag,
        text: `Clue earned: ${item.constraint.sentence}`,
      });
      effects.push({ kind: "cue", name: "ok" });
      return {
        state: { ...state, slots, aliveIds, earnedIds, streak, rejection: null },
        effects,
      };
    }

    case "REQUEST_HINT": {
      if (!state.run) break;
      const idx = state.current;
      const slot = state.slots[idx]!;
      if (!slot || slot.itemId !== action.itemId || slot.hintsUsed.includes(action.level)) break;
      const item = state.run.evidences[idx]!;
      const slots = state.slots.map((s, i) =>
        i === idx ? { ...s, hintsUsed: [...s.hintsUsed, action.level] } : s,
      );
      // §6: a hint ends the sharp streak silently — no animation, no copy.
      emit(MD_EVENTS.hintShown, {
        itemId: slot.itemId,
        level: action.level,
        source: "user",
        misconceptionTag: item.misconceptionTag,
      });
      say(item.hints[`l${action.level}`]);
      return { state: { ...state, slots, streak: 0 }, effects };
    }

    case "WRAP_REQUEST": {
      if (state.finished) break;
      // Grace rule: flag only; the current item finishes before wrapping (§7).
      return { state: { ...state, wrapPending: true }, effects };
    }

    case "ADVANCE": {
      if (!state.run || state.phase !== "evidence") break;
      const idx = state.current;
      const justSolvedIdx = idx;
      if (state.wrapPending) {
        const wrapped = finishSummary({ ...state, capReached: true }, effects, now);
        return { state: wrapped, effects };
      }
      if (
        state.run.mode === "full" &&
        state.run.checkpointAfterIndices.includes(justSolvedIdx)
      ) {
        return { state: { ...state, phase: "checkpoint", rejection: null }, effects };
      }
      const nextIdx = idx + 1;
      if (nextIdx < state.run.evidences.length) {
        const ev = state.run.evidences[nextIdx]!;
        emit(MD_EVENTS.evidencePresented, {
          itemId: ev.id,
          skillId: ev.skillId,
          presentation: ev.presentation.kind,
        });
        say(ev.goal);
        return { state: { ...state, current: nextIdx, rejection: null }, effects };
      }
      return { state: { ...state, phase: "board", rejection: null }, effects };
    }

    case "CHECKPOINT_MARK": {
      if (!state.run || state.phase !== "checkpoint") break;
      // Diagnostic-only toggle (§5.3): truth comes from constraints, not the
      // child's taps. Telemetry is emitted once at COMMIT (§10 schema).
      return {
        state: {
          ...state,
          checkpointMarks: { ...state.checkpointMarks, [action.suspectId]: action.alive },
        },
        effects,
      };
    }

    case "COMMIT_CHECKPOINT": {
      if (!state.run || state.phase !== "checkpoint") break;
      // Grace rule: a checkpoint is a clean boundary — wrap instead of
      // serving another clue once the session cap has been requested.
      if (state.wrapPending) {
        const wrapped = finishSummary({ ...state, capReached: true }, effects, now);
        return { state: wrapped, effects };
      }
      const chapter = state.run.checkpointAfterIndices.indexOf(state.current) + 1;
      const markedSurvivors = state.run.suspects.filter(
        (s) => state.checkpointMarks[s.id] !== false,
      ).length;
      emit(MD_EVENTS.checkpointMarked, {
        chapter,
        markedSurvivors,
        trueSurvivors: state.aliveIds.length,
      });
      const nextIdx = state.current + 1;
      if (nextIdx < state.run.evidences.length) {
        const ev = state.run.evidences[nextIdx]!;
        emit(MD_EVENTS.evidencePresented, {
          itemId: ev.id,
          skillId: ev.skillId,
          presentation: ev.presentation.kind,
        });
        say(ev.goal);
        return { state: { ...state, current: nextIdx, phase: "evidence", rejection: null }, effects };
      }
      return { state: { ...state, phase: "board", rejection: null }, effects };
    }

    case "TOGGLE_LINK": {
      const key = `${action.suspectId}|${action.constraintId}`;
      const links = { ...state.links };
      if (links[key]) delete links[key];
      else links[key] = true;
      return { state: { ...state, links }, effects };
    }

    case "ACCUSE": {
      if (!state.run || (state.phase !== "board" && state.phase !== "verdict")) break;
      const minLinks = tierRequiresLinks(state.run.tier);
      if (action.linkedCount < minLinks) {
        say(`Link at least ${minLinks} clues before naming your culprit.`);
        return {
          state: { ...state, rejection: `Link at least ${minLinks} clues first.` },
          effects,
        };
      }
      const correct = action.suspectId === state.run.culpritId;
      const accusedAttrs = attrsById(state.run).get(action.suspectId)!;
      const contradictedBy = state.earnedIds.filter((id) => {
        const ev = state.run!.evidences.find((e) => e.id === id)!;
        return !ev.constraint.test(accusedAttrs);
      });
      const accusations = [
        ...state.accusations,
        { suspectId: action.suspectId, correct, contradictedBy },
      ];
      emit(MD_EVENTS.accusationMade, {
        attemptIndex: accusations.length,
        accusedCorrect: correct,
        linksSelected: action.linkedCount,
      });
      const wrongCount = accusations.filter((a) => !a.correct).length;
      if (correct) {
        effects.push({ kind: "cue", name: "win" });
        say("CASE CLOSED. That is the culprit!");
        return {
          state: { ...state, accusations, phase: "verdict", outcome: "closed", rejection: null },
          effects,
        };
      }
      effects.push({ kind: "cue", name: "no" });
      say("That suspect does not fit the evidence. Look at the contradictions.");
      const nextWrong = wrongCount >= 2;
      return {
        state: {
          ...state,
          accusations,
          phase: nextWrong ? "guided" : "verdict",
          outcome: nextWrong ? "guided" : null,
          rejection: null,
        },
        effects,
      };
    }

    case "RETRY_FROM_VERDICT": {
      if (state.phase !== "verdict") break;
      return { state: { ...state, phase: "board", rejection: null }, effects };
    }

    case "FINISH_GUIDED": {
      if (state.phase !== "guided") break;
      const done = finishSummary({ ...state, outcome: "guided" }, effects, now);
      return { state: done, effects };
    }

    case "OPEN_SUMMARY": {
      if (!state.run || state.finished) break;
      const done = finishSummary(state, effects, now);
      return { state: done, effects };
    }
  }
  return { state, effects };
}

/** D3+ requires the child to link at least two clues before accusing (§5.4). */
export function tierRequiresLinks(tier: CaseRun["tier"]): number {
  const order = ["D1", "D2", "D3", "D4", "D5"];
  return order.indexOf(tier) >= 2 ? 2 : 0;
}

// ---------------------------------------------------------------------------
// Summary model
// ---------------------------------------------------------------------------

export interface CaseSummaryModel {
  totalPoints: number;
  independenceScore: number;
  independenceExplanation: string;
  evidenceSolved: number;
  evidenceTotal: number;
  hintsTotal: number;
  l4SharePct: number;
  coaching: string;
  badges: string[];
  skills: string[];
  parentSentence: string;
}

export function summarizeSlots(slots: readonly SlotState[]): {
  totalPoints: number;
  independenceScore: number;
} {
  let totalPoints = 0;
  let independentPoints = 0;
  for (const s of slots) {
    if (!s.solved) continue;
    totalPoints += s.points ?? 0;
    if (s.firstTryNoHint) independentPoints += s.points ?? 0;
  }
  const independenceScore =
    totalPoints === 0 ? 0 : Math.round((independentPoints / totalPoints) * 100);
  return { totalPoints, independenceScore };
}

export function summarizeCase(state: EngineState): CaseSummaryModel {
  const slots = state.slots;
  const { totalPoints, independenceScore } = summarizeSlots(slots);
  const evidenceSolved = slots.filter((s) => s.solved).length;
  const hintsTotal = slots.reduce((n, s) => n + s.hintsUsed.length, 0);
  const l4Uses = slots.reduce((n, s) => n + s.hintsUsed.filter((l) => l >= 3).length, 0);
  const l4SharePct = hintsTotal === 0 ? 0 : Math.round((l4Uses / hintsTotal) * 100);
  const independenceExplanation =
    hintsTotal > 0
      ? "Independence drops when hints help. Try again without hints to raise it."
      : "Independence shows how much of the case you solved without hints.";

  let coaching: string;
  if (independenceScore >= 80) {
    coaching = "Sharp detective work — you cracked most clues on your own.";
  } else if (independenceScore >= 50) {
    coaching = "Good instincts. Next case, try the trick hint before the reveal.";
  } else {
    coaching = "Every detective uses help sometimes. Picture the steps, then check your answer.";
  }

  const badges: string[] = [];
  const firstAccusation = state.accusations[0];
  if (firstAccusation?.correct) badges.push("\uD83C\uDFC5 Cracked It");
  if (slots.length > 0 && slots.every((s) => s.firstTryNoHint)) badges.push("\uD83C\uDFC5 Sharp Eye");
  else if (hintsTotal > 0 && evidenceSolved === slots.length) badges.push("\uD83C\uDFC5 Fair Play");

  const solvedSkills = state.run?.evidences
    .filter((ev) => slots.find((s) => s.itemId === ev.id)?.solved)
    .map((ev) => SKILL_REGISTRY[ev.skillId].label) ?? [];
  const skills = [...new Set(solvedSkills)];

  const parentSentence =
    l4SharePct > 60
      ? "Solved mostly with step-by-step reveals \u2014 a slightly easier case is a good next step."
      : "A parent reading this can see exactly what was practiced. Nothing was saved.";

  return {
    totalPoints,
    independenceScore,
    independenceExplanation,
    evidenceSolved,
    evidenceTotal: slots.length,
    hintsTotal,
    l4SharePct,
    coaching,
    badges,
    skills,
    parentSentence,
  };
}
