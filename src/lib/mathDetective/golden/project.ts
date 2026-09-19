/**
 * Math Detective — serializable golden-case projections (GAME-136).
 *
 * Constraint predicates (`test`) are intentionally omitted. Golden identity
 * is re-proven by regenerating from seed and comparing this projection, then
 * driving the engine for elimination / scoring / verdict traces.
 */
import type {
  AnswerPayload,
  CaseMode,
  CaseRun,
  Constraint,
  DifficultyTier,
  GeneratedEvidence,
  HintSet,
  PresentationPayload,
  Suspect,
  SuspectAttrs,
} from "../types";

export interface SerializableConstraint {
  id: string;
  chip: string;
  sentence: string;
  kind: Constraint["kind"];
  attr: Constraint["attr"];
  op?: Constraint["op"];
  value?: number | boolean;
  sceneMin?: number;
}

export interface ProjectedEvidence {
  id: string;
  skillId: GeneratedEvidence["skillId"];
  goal: string;
  presentation: PresentationPayload;
  answer: AnswerPayload;
  constraint: SerializableConstraint;
  hints: HintSet;
  misconceptionTag: string;
}

export interface ProjectedSuspect {
  id: string;
  name: string;
  initial: string;
  icon: string;
  attrs: SuspectAttrs;
}

/** Closure-free case identity used by golden fixtures and freeze tests. */
export interface ProjectedCase {
  caseId: string;
  title: string;
  intro: string;
  tier: DifficultyTier;
  mode: CaseMode;
  culpritId: string;
  suspects: ProjectedSuspect[];
  evidences: ProjectedEvidence[];
  checkpointAfterIndices: number[];
}

export function projectConstraint(c: Constraint): SerializableConstraint {
  return {
    id: c.id,
    chip: c.chip,
    sentence: c.sentence,
    kind: c.kind,
    attr: c.attr,
    op: c.op,
    value: c.value,
    sceneMin: c.sceneMin,
  };
}

export function projectSuspect(s: Suspect): ProjectedSuspect {
  return {
    id: s.id,
    name: s.name,
    initial: s.initial,
    icon: s.icon,
    attrs: { ...s.attrs },
  };
}

export function projectEvidence(e: GeneratedEvidence): ProjectedEvidence {
  return {
    id: e.id,
    skillId: e.skillId,
    goal: e.goal,
    presentation: e.presentation,
    answer: { ...e.answer },
    constraint: projectConstraint(e.constraint),
    hints: { ...e.hints },
    misconceptionTag: e.misconceptionTag,
  };
}

export function projectCase(run: CaseRun): ProjectedCase {
  return {
    caseId: run.caseId,
    title: run.title,
    intro: run.intro,
    tier: run.tier,
    mode: run.mode,
    culpritId: run.culpritId,
    suspects: run.suspects.map(projectSuspect),
    evidences: run.evidences.map(projectEvidence),
    checkpointAfterIndices: [...run.checkpointAfterIndices],
  };
}
