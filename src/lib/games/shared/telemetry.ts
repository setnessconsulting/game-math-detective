/**
 * Telemetry port for games (REQUIREMENTS §10).
 *
 * Free-site binding is a session-only buffer: cookieless, network-free,
 * dies with the tab. In-app builds may bind an account-backed sink later
 * without touching game code — they only implement `TelemetryPort`.
 *
 * Privacy rules enforced by construction: payload values are primitives
 * only, no free text, latency is bucketed (see `latencyBucketMs`).
 */

export const MD_EVENTS = {
  caseStarted: "mdetect.case_started",
  evidencePresented: "mdetect.evidence_presented",
  evidenceAnswered: "mdetect.evidence_answered",
  hintShown: "mdetect.hint_shown",
  checkpointMarked: "mdetect.checkpoint_marked",
  accusationMade: "mdetect.accusation_made",
  caseCompleted: "mdetect.case_completed",
  error: "mdetect.error",
} as const;

export type MdEventName = (typeof MD_EVENTS)[keyof typeof MD_EVENTS];

export type MdEventValue = string | number | boolean | null;

export interface MdEvent {
  name: MdEventName;
  /** Epoch ms when the event was emitted. */
  at: number;
  data: Record<string, MdEventValue>;
}

export interface TelemetryPort {
  emit(event: MdEvent): void;
}

/**
 * Session-only sink. Keeps a bounded in-memory ring; never touches
 * storage or the network.
 */
export function createBufferSink(maxEvents = 200): TelemetryPort & { events: MdEvent[] } {
  const events: MdEvent[] = [];
  return {
    emit(event: MdEvent) {
      events.push(event);
      if (events.length > maxEvents) events.shift();
    },
    get events() {
      return events;
    },
  };
}

/** Bucket raw latency into coarse bands (never persist exact timings). */
export function latencyBucketMs(ms: number): "<5s" | "5-15s" | "15-45s" | ">45s" {
  if (ms < 5_000) return "<5s";
  if (ms < 15_000) return "5-15s";
  if (ms < 45_000) return "15-45s";
  return ">45s";
}

/** Bucket case duration into coarse minute bands (never persist exact timings). */
export function minutesBucketMs(ms: number): "<2m" | "2-5m" | "5-10m" | ">10m" {
  if (ms < 2 * 60_000) return "<2m";
  if (ms < 5 * 60_000) return "2-5m";
  if (ms < 10 * 60_000) return "5-10m";
  return ">10m";
}

/**
 * Payload allowlist per event (REQUIREMENTS §10 privacy rules). The
 * contract test in tests/mathDetective.telemetry.test.ts asserts that
 * engine-emitted events never carry a field outside this table and that
 * values stay primitive and short (no free text, no identifiers).
 */
export const MD_EVENT_FIELDS: Record<MdEventName, readonly string[]> = {
  "mdetect.case_started": ["caseId", "tier", "mode", "stationIds", "suspectCount"],
  "mdetect.evidence_presented": ["itemId", "skillId", "presentation"],
  "mdetect.evidence_answered": [
    "itemId",
    "skillId",
    "correct",
    "attemptCount",
    "hintsUsed",
    "latencyBucket",
    "misconceptionTag",
  ],
  "mdetect.hint_shown": ["itemId", "level", "source", "misconceptionTag"],
  "mdetect.checkpoint_marked": ["chapter", "markedSurvivors", "trueSurvivors"],
  "mdetect.accusation_made": ["attemptIndex", "accusedCorrect", "linksSelected"],
  "mdetect.case_completed": [
    "caseId",
    "tier",
    "mode",
    "outcome",
    "independenceScore",
    "totalPoints",
    "minutesSpentBucket",
    "skills",
  ],
  "mdetect.error": ["context", "code"],
};
