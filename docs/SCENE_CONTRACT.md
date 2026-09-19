# Math Detective scene and intent contract

Status: standalone implementation contract for GAME-137. This document describes the typed code contract; it does not claim final authored art or a completed production Figma file.

## Authority and design boundary

The standalone source of truth is:

- `src/lib/mathDetective/scene/types.ts` — `SceneModel` and state vocabulary;
- `src/lib/mathDetective/scene/project.ts` — pure `EngineState` to `SceneModel` projection;
- `src/lib/mathDetective/scene/intents.ts` — token-stamped intents and validation;
- `src/lib/mathDetective/phaser/focusBoundary.ts` — deterministic focus transitions.

GAME-173 owns the future production Figma source of truth. Until that story supplies a durable Figma identity and named frames, code and this contract define the implementation-facing state names without pretending that placeholder foundation art is final design authority. Figma frames must map one-to-one to these names rather than introduce a parallel state machine.

## State vocabulary

| Contract field | Values or source | Authority |
| --- | --- | --- |
| `location` | `briefing`, `office`, `evidenceStation`, `checkpoint`, `deductionBoard`, `accusation`, `verdict`, `guided`, `summary`, `pause` | projection from `EngineState` and overlay |
| `presentationPhase` | station, challenge, clue, recovery, and continue phases | presentation projection only |
| `stations[].status` | `locked`, `available`, `active`, `completed` | engine slots and earned evidence |
| `suspects[].status` | `alive`, `eliminated`, `accused`, `culpritRevealed` | engine `aliveIds`, accusations, and outcome |
| `overlay` | challenge/result/pause/settings/captions/accusation confirmation | host presentation state |
| `focusTarget` | named DOM overlay, named world station, briefing, summary, or world target | focus boundary |
| `layoutMode` | `phonePortrait`, `tablet`, `desktop` | presentation configuration |

`SceneModel` exposes case/evidence/suspect/deduction data needed for rendering, but it does not expose solver predicates or a second correctness reducer. The renderer cannot derive the culprit, earn a clue, eliminate a suspect, award points, or settle a verdict.

## Ownership

React/DOM owns semantic and assistive interaction: briefing copy, numeric forms, tables, keypads, selectors, equations, challenge feedback, pause/settings controls, captions, and focus traps. Phaser owns world/station markers, clue motion, suspect/deduction presentation, accusation/verdict staging, and responsive visual layout. Both consume the projection; neither owns case truth.

## Bounded intents

Every renderer-originated intent carries `sessionId`, `generation`, and `caseId`. The allowed set is:

`enterStation`, `inspectEvidence`, `openChallenge`, `closeChallenge`, `openDeduction`, `chooseSuspect`, `accuse`, `continue`, and `presentationComplete`.

`resolveSceneIntent` rejects stale session/generation/case tokens, unknown evidence or suspects, illegal phases, unsolved continuation, solved challenge reopen, insufficient accusation links, and duplicate settled accusations. Engine dispositions are limited to existing `EngineAction` values. Presentation dispositions only change overlay/highlight/selection/unblocked presentation state.

`presentationComplete` is deliberately presentation-only. It cannot earn evidence, advance the engine, alter suspect state, change scoring, or settle a verdict.

## Focus transfer

| Transition | Deterministic target |
| --- | --- |
| world/station to math challenge | `overlay.challenge` |
| challenge to feedback | `overlay.result` |
| challenge/result close | `world.station.<evidenceId>` |
| briefing | `dom.briefingContinue` |
| summary | `dom.summaryPrimary` |

`focusAfterOverlayClose` and `planFocusTransition` never restore focus to an unnamed or invisible canvas object. Reduced-motion and captions are metadata on the projection; they do not remove semantic information.

## Executable evidence

- `tests/mathDetective.scene.test.ts` verifies state projection, ownership, bounded intents, stale generation rejection, overlay focus, presentation-only completion, and engine-derived suspect status.
- `tests/mathDetective.phaserAdapter.test.ts` verifies the contract through the host boundary, including duplicate, stale, out-of-order, and settled-case rejection.
- `tests/mathDetective.golden.test.ts` and `tests/mathDetective.integrity.test.ts` bind the scene boundary to deterministic engine fixtures.

The complete foundation command is `npm run verify`. The production Figma handoff and authored world states remain GAME-173/GAME-139 scope; adding those artifacts must not change this authority boundary.
