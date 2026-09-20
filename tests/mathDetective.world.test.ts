import { describe, expect, it } from "vitest";
import { initialEngineState, reduce } from "@/lib/mathDetective/engine";
import { layoutWorld, worldCanvasSize } from "@/lib/mathDetective/phaser";
import { generateCase } from "@/lib/mathDetective/solver";
import { projectScene } from "@/lib/mathDetective/scene";

const NOW = 1_700_000_000_000;

describe("mathDetective reusable world projection (GAME-140)", () => {
  it("projects setting, chapter, station, and suspect state without solver authority", () => {
    const run = generateCase({ seed: 42, tier: "D3", mode: "mini" });
    const started = reduce(initialEngineState(), { t: "START", run }, NOW).state;
    const briefing = projectScene(started, {
      sessionId: "world-test",
      generation: 1,
      layoutMode: "desktop",
    });

    expect(briefing.world.setting).toEqual({
      id: run.narrative.settingId,
      label: run.narrative.settingLabel,
      objectFamilies: [...new Set(Object.values(run.narrative.stationFamilies))],
    });
    expect(briefing.world.chapter).toEqual({ current: 0, total: run.evidences.length, label: "Case setup" });
    expect(briefing.world.stations.map((station) => station.evidenceId)).toEqual(
      run.evidences.map((evidence) => evidence.id),
    );
    expect(briefing.world.suspects.map((suspect) => suspect.id)).toEqual(
      run.suspects.map((suspect) => suspect.id),
    );
    expect(briefing.world.stations.every((station) => station.objectFamily)).toBe(true);
    expect(briefing.narrative).toEqual(run.narrative);
    expect(briefing.world.clueDiscovery.state).toBe("hidden");
    expect("culpritId" in briefing.world).toBe(false);
    expect("test" in briefing.world).toBe(false);
  });

  it("marks clue discovery as presentation-only while the engine already owns the clue", () => {
    const run = generateCase({ seed: 42, tier: "D3", mode: "mini" });
    let state = reduce(initialEngineState(), { t: "START", run }, NOW).state;
    state = reduce(state, { t: "BEGIN" }, NOW).state;
    const item = run.evidences[0]!;
    state = reduce(state, { t: "SUBMIT_ANSWER", itemId: item.id, value: item.answer.value }, NOW).state;

    const discovering = projectScene(state, {
      sessionId: "world-test",
      generation: 1,
      pendingPresentationComplete: true,
    });
    expect(discovering.presentationPhase).toBe("clueDiscovery");
    expect(discovering.world.clueDiscovery).toEqual({
      state: "discovering",
      evidenceId: item.id,
      chip: item.constraint.chip,
      sentence: item.constraint.sentence,
    });
    expect(discovering.world.transition.kind).toBe("clueDiscovery");
    expect(discovering.world.transition.durationMs).toBeGreaterThan(0);

    const reduced = projectScene(state, {
      sessionId: "world-test",
      generation: 1,
      pendingPresentationComplete: true,
      reducedMotion: true,
      captionsEnabled: false,
    });
    expect(reduced.world.transition.durationMs).toBe(0);
    expect(reduced.world.transition.captionsEnabled).toBe(false);
    expect(reduced.deduction.earnedConstraintIds).toContain(item.id);
  });

  it("lays out the same typed station and suspect patterns for phone and desktop", () => {
    const run = generateCase({ seed: 42, tier: "D3", mode: "full" });
    const state = reduce(initialEngineState(), { t: "START", run }, NOW).state;
    const phoneScene = projectScene(state, {
      sessionId: "world-test",
      generation: 1,
      layoutMode: "phonePortrait",
    });
    const desktopScene = projectScene(state, {
      sessionId: "world-test",
      generation: 1,
      layoutMode: "desktop",
    });
    const phoneSize = worldCanvasSize("phonePortrait");
    const desktopSize = worldCanvasSize("desktop");
    const phone = layoutWorld(phoneScene, phoneSize.width, phoneSize.height);
    const desktop = layoutWorld(desktopScene, desktopSize.width, desktopSize.height);

    expect(phone.compact).toBe(true);
    expect(desktop.compact).toBe(false);
    expect(phone.stations).toHaveLength(run.evidences.length);
    expect(phone.suspects).toHaveLength(run.suspects.length);
    expect(phone.stations.every((item) => item.x + item.width / 2 <= phone.width)).toBe(true);
    expect(phone.suspects.every((item) => item.y + item.height / 2 <= phone.height)).toBe(true);
    expect(desktop.stations.every((item) => item.x + item.width / 2 <= desktop.width)).toBe(true);
  });
});
