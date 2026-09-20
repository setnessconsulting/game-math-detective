/**
 * Math Detective — in-memory agency framing (GAME-245).
 *
 * This is a shell-facing session counter, not a score store. It exists only
 * in the current JavaScript session and never touches browser storage or a
 * network boundary.
 */
import type { CaseSettingId } from "./types";

type AuthoredSettingId = Exclude<CaseSettingId, "detective-office">;

export interface AgencyProgress {
  casesStarted: number;
  casesClosed: number;
  currentCaseNumber: number;
  currentCaseId: string | null;
  currentSettingId: AuthoredSettingId | null;
  settingsSeen: readonly AuthoredSettingId[];
}

const EMPTY_PROGRESS: AgencyProgress = {
  casesStarted: 0,
  casesClosed: 0,
  currentCaseNumber: 0,
  currentCaseId: null,
  currentSettingId: null,
  settingsSeen: [],
};

let progress: AgencyProgress = EMPTY_PROGRESS;
const startedCaseIds = new Set<string>();
const closedCaseIds = new Set<string>();

function snapshot(): AgencyProgress {
  return { ...progress, settingsSeen: [...progress.settingsSeen] };
}

export function getAgencyProgress(): AgencyProgress {
  return snapshot();
}

export function beginAgencyCase(caseId: string, settingId: AuthoredSettingId): AgencyProgress {
  if (!startedCaseIds.has(caseId)) {
    startedCaseIds.add(caseId);
    progress = {
      ...progress,
      casesStarted: progress.casesStarted + 1,
      currentCaseNumber: progress.casesStarted + 1,
      currentCaseId: caseId,
      currentSettingId: settingId,
      settingsSeen: progress.settingsSeen.includes(settingId)
        ? [...progress.settingsSeen]
        : [...progress.settingsSeen, settingId],
    };
  } else if (progress.currentCaseId !== caseId) {
    progress = { ...progress, currentCaseId: caseId, currentSettingId: settingId };
  }
  return snapshot();
}

export function closeAgencyCase(caseId: string): AgencyProgress {
  if (startedCaseIds.has(caseId) && !closedCaseIds.has(caseId)) {
    closedCaseIds.add(caseId);
    progress = { ...progress, casesClosed: progress.casesClosed + 1 };
  }
  return snapshot();
}

export function agencyFraming(value: AgencyProgress = progress): string {
  if (!value.currentCaseId) return "Agency file · no case opened";
  return `Agency file · case ${value.currentCaseNumber} · ${value.casesClosed} closed`;
}

/** Test hook; the live shell never calls this. */
export function resetAgencyForTests(): void {
  progress = EMPTY_PROGRESS;
  startedCaseIds.clear();
  closedCaseIds.clear();
}
