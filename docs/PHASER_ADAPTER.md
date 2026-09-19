# Math Detective Phaser host adapter

Status: standalone implementation contract for GAME-138. This is the deterministic lifecycle and synchronization seam, not the final production world or vertical slice.

## Authority flow

```text
EngineState -> projectScene -> SceneModel -> PhaserRuntime.reconcile
Phaser/React -> SceneIntent(sessionId, generation, caseId)
             -> resolveSceneIntent
             -> EngineAction or presentation-only effect
             -> EngineState
```

The TypeScript engine remains the only case state machine. Phaser receives projected state and may request bounded intents; animation completion, canvas callbacks, and visual state never become authoritative facts.

## Lifecycle contract

`createMathDetectiveHostAdapter` owns one `PhaserRuntime` for its active session:

1. `startCase` resets the authoritative engine, increments the generation, and mounts the projected briefing scene.
2. `dispatchEngine` applies only an explicit engine action, then republishes the projection.
3. `handleIntent` validates all tokens and phase rules before applying an engine action or presentation effect.
4. `restore` rebuilds the scene from a supplied authoritative `EngineState`; it does not infer state from canvas objects.
5. `remount` destroys and remounts the runtime from the current authoritative state while incrementing generation so pre-remount callbacks become stale.
6. `destroy` tears down the runtime, clears the adapter state, and rejects later intents.

The production runtime dynamically imports the pinned `phaser` package (`4.2.1`) only in the browser. The optional `getGame` hook exists for qualification readback and is not a game-state API. The fake runtime and foundation harness provide deterministic tests without a canvas.

## Synchronization safeguards

- session, generation, and case tokens reject stale callbacks;
- duplicate `presentationComplete` events cannot earn evidence or advance the reducer;
- duplicate accusations after a closed or guided outcome are rejected;
- wrong-answer recovery and retry remain engine actions;
- resume/remount reconstructs `SceneModel` from engine state;
- teardown makes later callbacks inert;
- no LevelBest import, storage, network sink, account identity, or renderer-side solver is present.

## Executable evidence

- `tests/mathDetective.phaserAdapter.test.ts` covers initialization, foundation journey, stale generation, duplicate clue reveal, teardown, resume, out-of-order completion, duplicate accusation, remount, and focus restoration.
- `src/lib/mathDetective/phaser/harness.ts` runs briefing → station → challenge → authoritative answer → clue reveal → deduction state using the fake runtime.
- `tests/mathDetectivePhaserRender.spec.ts` loads the installed Phaser package in Chromium, verifies Phaser `4.2.1`, active scene, `WebGLRenderer`, advancing frames, a populated display list, and one canvas.
- `tests/e2e/mathDetective.e2e.spec.ts` and `tests/e2e/mathDetective.accessibility.spec.ts` verify the React shell, keyboard path, and first evidence station.

GAME-139 owns the polished evidence-station vertical slice and the full player journey. GAME-173 owns final visual design. Neither may move case truth into Phaser or React.
