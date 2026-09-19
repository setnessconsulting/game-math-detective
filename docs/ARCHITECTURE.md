# Standalone architecture

## Authority flow

The authoritative path is:

    deterministic inputs -> TypeScript case generator -> EngineState reducer
        -> SceneModel projection -> React semantic surfaces and Phaser renderer

EngineState owns case/session truth. SceneModel is a read-only presentation projection. SceneIntent is a bounded, token-stamped request that the host validates before it can become an engine action or a presentation-only effect.

## Ownership

| Surface | Owns | Must not own |
| --- | --- | --- |
| src/lib/mathDetective core | generation, constraints, solving, evidence, elimination, hints, scoring, adaptation, verdict, summary | DOM, Phaser, network, storage, account identity |
| React shell | semantic controls, labels, numeric input, focusable overlays, readable status | mathematical truth or an independent case reducer |
| Phaser runtime | world/foundation rendering, station markers, visual state refresh | clue correctness, score, suspect elimination, verdict, hidden session state |
| games-site later | catalog, immutable versioned assets, promotion and rollback | rebuilding or modifying the game |
| LevelBest later | host/session integration | becoming the game source or runtime dependency |

Animation completion and duplicate renderer callbacks cannot advance the engine without a validated intent. A remount starts from the projected authoritative state.

## Determinism

Generation receives an explicit seed, tier, and mode. Randomness is injected through the migrated Mulberry32 implementation. Reducer timestamps are injectable in tests. The browser shell supplies wall-clock time only at the host boundary.

Session resume and personal records are module-scope memory only. They are deliberately not browser storage, network telemetry, or account state.

## Foundation scope

This repository establishes the runtime/tooling seam and preserves the current educational semantics. Final authored world art, narrative, evidence-station production, complete deduction presentation, audio, games-site promotion, and LevelBest integration remain downstream work.
