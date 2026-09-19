# Math Detective — Phaser Host Adapter (GAME-138)

**Pinned Phaser:** `4.2.1` (`phaser` dependency)  
**Live hub:** unchanged — `MathDetective.tsx` is **not** wired to Phaser yet (GAME-139).

## Architecture

```
EngineState → projectScene → SceneModel → PhaserRuntime.reconcile
Phaser/fake emit → SceneIntent(+session/generation/case) → resolveSceneIntent
  → EngineAction | presentation effect → EngineState
```

## Hardening

- One runtime per active adapter session; `destroy()` tears down Phaser/fake and bumps generation.
- Stale `sessionId` / `generation` / `caseId` intents are dropped.
- `presentationComplete` never earns evidence or advances case authority.
- Resume: `restore(run, engine)` rebuilds SceneModel from authoritative state.
- Fake challenge responder supports adapter tests without visual challenge UI.

## Harness

`runFoundationHarness(run)` proves:

briefing → station select → openChallenge → simulated authoritative result → clue reveal → deduction board.


