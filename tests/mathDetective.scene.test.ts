import { describe, expect, it } from "vitest";
import {
  initialEngineState,
  reduce,
  type EngineState,
} from "@/lib/mathDetective/engine";
import { generateCase } from "@/lib/mathDetective/solver";
import {
  SCENE_INTENT_NAMES,
  SURFACE_OWNERSHIP,
  focusAfterOverlayClose,
  projectScene,
  resolveSceneIntent,
  type SceneIntent,
} from "@/lib/mathDetective/scene";

const T = 1_700_000_000_000;
const SESSION = "sess-md-137";

function start(): { state: EngineState; caseId: string } {
  const run = generateCase({ seed: 42, tier: "D3", mode: "mini" });
  const { state } = reduce(initialEngineState(), { t: "START", run }, T);
  return { state, caseId: run.caseId };
}

function auth(caseId: string, generation = 1): Pick<SceneIntent, "sessionId" | "generation" | "caseId"> {
  return { sessionId: SESSION, generation, caseId };
}

describe("mathDetective scene contract (GAME-137)", () => {
  it("exposes the full bounded intent set", () => {
    expect(SCENE_INTENT_NAMES).toEqual([
      "enterStation",
      "inspectEvidence",
      "openChallenge",
      "closeChallenge",
      "openDeduction",
      "chooseSuspect",
      "accuse",
      "continue",
      "presentationComplete",
    ]);
  });

  it("keeps complex math surfaces in React DOM ownership", () => {
    for (const surface of [
      "challengeTables",
      "numericForms",
      "selectors",
      "keypads",
      "equations",
      "semanticEvidenceText",
    ]) {
      expect(SURFACE_OWNERSHIP.reactDom).toContain(surface);
      expect(SURFACE_OWNERSHIP.phaser).not.toContain(surface);
    }
  });

  it("projects briefing → evidence scene model without a solver", () => {
    const { state, caseId } = start();
    const briefing = projectScene(state, { sessionId: SESSION, generation: 1 });
    expect(briefing.contractVersion).toBe(1);
    expect(briefing.casePhase).toBe("briefing");
    expect(briefing.location).toBe("briefing");
    expect(briefing.focusTarget).toBe("dom.briefingContinue");
    expect(briefing.caseId).toBe(caseId);
    expect(briefing.stations.length).toBeGreaterThan(0);
    expect(briefing.suspects.every((s) => s.status === "alive")).toBe(true);

    const begun = reduce(state, { t: "BEGIN" }, T).state;
    const evidence = projectScene(begun, {
      sessionId: SESSION,
      generation: 1,
      overlay: "challenge",
    });
    expect(evidence.location).toBe("evidenceStation");
    expect(evidence.presentationPhase).toBe("challengeOpen");
    expect(evidence.overlay).toBe("challenge");
    expect(evidence.focusTarget).toBe("overlay.challenge");
    expect(evidence.clue.presentation).not.toBeNull();
    expect("culpritId" in evidence).toBe(false);
  });

  it("maps continue from briefing to BEGIN and rejects stale generation", () => {
    const { state, caseId } = start();
    const ok = resolveSceneIntent(
      { t: "continue", ...auth(caseId, 1) },
      { sessionId: SESSION, generation: 1, state },
    );
    expect(ok).toEqual({ ok: true, kind: "engine", action: { t: "BEGIN" } });

    const stale = resolveSceneIntent(
      { t: "continue", ...auth(caseId, 1) },
      { sessionId: SESSION, generation: 2, state },
    );
    expect(stale).toEqual({ ok: false, reason: "stale-generation" });
  });

  it("openChallenge is presentation-only and only for the current unsolved item", () => {
    const { state, caseId } = start();
    const begun = reduce(state, { t: "BEGIN" }, T).state;
    const itemId = begun.run!.evidences[0]!.id;
    const open = resolveSceneIntent(
      { t: "openChallenge", evidenceId: itemId, ...auth(caseId) },
      { sessionId: SESSION, generation: 1, state: begun },
    );
    expect(open.ok).toBe(true);
    if (open.ok) {
      expect(open.kind).toBe("presentation");
      if (open.kind === "presentation") {
        expect(open.effect).toEqual({ t: "openOverlay", overlay: "challenge" });
      }
    }

    const wrong = resolveSceneIntent(
      { t: "openChallenge", evidenceId: "ev-not-real", ...auth(caseId) },
      { sessionId: SESSION, generation: 1, state: begun },
    );
    expect(wrong).toEqual({ ok: false, reason: "challenge-not-current" });
  });

  it("presentationComplete never becomes an engine action", () => {
    const { state, caseId } = start();
    const begun = reduce(state, { t: "BEGIN" }, T).state;
    const before = begun.earnedIds;
    const resolved = resolveSceneIntent(
      { t: "presentationComplete", token: "clue-reveal-1", ...auth(caseId) },
      { sessionId: SESSION, generation: 1, state: begun },
    );
    expect(resolved).toEqual({
      ok: true,
      kind: "presentation",
      effect: { t: "presentationUnblocked", token: "clue-reveal-1" },
    });
    expect(begun.earnedIds).toEqual(before);
  });

  it("restores focus to a named world station after overlay close", () => {
    const { state } = start();
    const begun = reduce(state, { t: "BEGIN" }, T).state;
    const withOverlay = projectScene(begun, {
      sessionId: SESSION,
      generation: 1,
      overlay: "challenge",
    });
    expect(withOverlay.focusTarget).toBe("overlay.challenge");
    const closed = projectScene(begun, {
      sessionId: SESSION,
      generation: 1,
      overlay: "none",
    });
    const restore = focusAfterOverlayClose(closed);
    expect(restore).toBe(`world.station.${begun.run!.evidences[0]!.id}`);
  });

  it("marks suspects eliminated from engine aliveIds only", () => {
    const { state } = start();
    let s = reduce(state, { t: "BEGIN" }, T).state;
    const item = s.run!.evidences[0]!;
    s = reduce(
      s,
      { t: "SUBMIT_ANSWER", itemId: item.id, value: item.answer.value, latencyMs: 500 },
      T,
    ).state;
    const scene = projectScene(s, { sessionId: SESSION, generation: 1 });
    const eliminated = scene.suspects.filter((x) => x.status === "eliminated");
    const alive = scene.suspects.filter((x) => x.status === "alive");
    expect(alive.map((x) => x.id).sort()).toEqual([...s.aliveIds].sort());
    expect(eliminated.length + alive.length).toBe(scene.suspects.length);
  });
});


