/** Canonical bounded intent names for Math Detective scene contract. */
export type SceneIntentName =
  | "enterStation"
  | "inspectEvidence"
  | "openChallenge"
  | "closeChallenge"
  | "openDeduction"
  | "chooseSuspect"
  | "linkEvidence"
  | "requestHint"
  | "submitAnswer"
  | "accuse"
  | "continue"
  | "presentationComplete";

export const SCENE_INTENT_NAMES: readonly SceneIntentName[] = [
  "enterStation",
  "inspectEvidence",
  "openChallenge",
  "closeChallenge",
  "openDeduction",
  "chooseSuspect",
  "linkEvidence",
  "requestHint",
  "submitAnswer",
  "accuse",
  "continue",
  "presentationComplete",
] as const;
