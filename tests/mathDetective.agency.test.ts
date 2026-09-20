import { beforeEach, describe, expect, it } from "vitest";
import {
  agencyFraming,
  beginAgencyCase,
  closeAgencyCase,
  getAgencyProgress,
  resetAgencyForTests,
} from "@/lib/mathDetective/agency";

describe("mathDetective session agency framing (GAME-245)", () => {
  beforeEach(() => resetAgencyForTests());

  it("counts distinct cases and settings without changing engine truth", () => {
    const first = beginAgencyCase("md-1-D2-mini", "library-archive");
    expect(first).toMatchObject({
      casesStarted: 1,
      casesClosed: 0,
      currentCaseNumber: 1,
      currentCaseId: "md-1-D2-mini",
      currentSettingId: "library-archive",
    });
    expect(agencyFraming(first)).toBe("Agency file · case 1 · 0 closed");

    const sameCase = beginAgencyCase("md-1-D2-mini", "library-archive");
    expect(sameCase.casesStarted).toBe(1);

    const second = beginAgencyCase("md-2-D2-mini", "makers-market");
    expect(second.casesStarted).toBe(2);
    expect(second.settingsSeen).toEqual(["library-archive", "makers-market"]);
    expect(agencyFraming(second)).toBe("Agency file · case 2 · 0 closed");
  });

  it("records a closed case once and keeps the counter session-only", () => {
    beginAgencyCase("md-1-D2-mini", "community-garden");
    expect(closeAgencyCase("md-1-D2-mini").casesClosed).toBe(1);
    expect(closeAgencyCase("md-1-D2-mini").casesClosed).toBe(1);
    expect(closeAgencyCase("unknown-case").casesClosed).toBe(1);
    expect(getAgencyProgress().casesStarted).toBe(1);
    expect(agencyFraming()).toBe("Agency file · case 1 · 1 closed");
  });

  it("starts empty without a storage or network dependency", () => {
    expect(getAgencyProgress()).toEqual({
      casesStarted: 0,
      casesClosed: 0,
      currentCaseNumber: 0,
      currentCaseId: null,
      currentSettingId: null,
      settingsSeen: [],
    });
    expect(agencyFraming()).toBe("Agency file · no case opened");
  });
});
