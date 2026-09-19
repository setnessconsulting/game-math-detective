# Migration and provenance record

## Source identity

The canonical standalone repository contained only its initial README at 22f437c71afb61fbe752000f311cec262508f922 when GAME-298 began.

The authoritative historical implementation was verified in the clean LevelBest main checkout at:

- repository: setnessconsulting/levelbest
- ref: main
- source commit: 38a9dfa78e8c1cef2238ba27fd058fc3d9f8a683
- source implementation root: src/lib/mathDetective/
- historical UI source: legacy/next-reference/src/app/games/MathDetective.tsx

The source commit includes the completed current-generation Math Detective implementation and the GAME-136/137/138 foundation artifacts. The standalone extraction preserves the core behavior and does not delete or modify the LevelBest source.

## Code and test map

| Source identity/path | Destination | Disposition |
| --- | --- | --- |
| LevelBest src/lib/mathDetective/** at 38a9dfa... | src/lib/mathDetective/** | Copied as game-owned core; only the Phaser runtime qualification readback hook is additive |
| LevelBest src/lib/games/shared/rng.ts at 38a9dfa... | src/lib/games/shared/rng.ts | Copied; standalone game-owned deterministic primitive |
| LevelBest src/lib/games/shared/session.ts at 38a9dfa... | src/lib/games/shared/session.ts | Copied; module-local timing contract |
| LevelBest src/lib/games/shared/telemetry.ts at 38a9dfa... | src/lib/games/shared/telemetry.ts | Copied; bounded in-memory event contract |
| LevelBest legacy/next-reference/tests/mathDetective*.test.ts at 38a9dfa... | tests/mathDetective*.test.ts | Migrated contract/parity tests |
| LevelBest legacy/next-reference/tests/gamesShared.test.ts at 38a9dfa... | tests/gamesShared.test.ts | Migrated shared primitive/privacy tests |
| LevelBest docs/games/math-detective/** at 38a9dfa... | docs/migration/levelbest/math-detective/** | Copied historical design/prototype input; not current standalone authority |
| LevelBest legacy/next-reference/src/app/games/MathDetective.tsx | src/app/games/MathDetective.tsx | Superseded for standalone runtime; replaced by a minimal shell without LevelBest imports |
| LevelBest host routes, account/session stores, APIs, and telemetry SDKs | none | Intentionally not migrated; no hidden runtime dependency |

## Reconciliation rule

Any future semantic change must cite a new source decision or Jira story. A presentation refactor must not alter the core contracts. If historical behavior is undesirable, preserve it in this baseline and raise a separately authorized follow-up instead of changing it silently.
