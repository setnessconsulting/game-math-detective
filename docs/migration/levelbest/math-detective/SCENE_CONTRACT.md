# Math Detective — Scene / Figma Contract (GAME-137)

**Status:** Implementation-facing contract (no final art claimed)  
**Companion:** [`RENDERER_BOUNDARY.md`](RENDERER_BOUNDARY.md)  
**Types:** `src/lib/mathDetective/scene/`

## Figma availability (API-37)

API-37 (`project-figma-api`) provides Unity/Blender handoff schemas and REST inspection. Figma MCP is authenticated in this workspace (View seat), but **no Math Detective detective-world Figma file key is registered** for this epic.

Therefore this document is the **authority for scene state names, ownership, and intents**. Frame/component art may be authored later and must map 1:1 to the `SceneLocation` / overlay / station status names below. Do not pretend polished final UI exists.

When a Figma file is created, map frames as:

| Figma frame / component name | Contract id |
| --- | --- |
| `MD/Briefing` | `briefing` |
| `MD/Office` | `office` |
| `MD/Station/Available` | `stationAvailable` |
| `MD/Station/Completed` | `stationCompleted` |
| `MD/ClueDiscovery` | `clueDiscovery` |
| `MD/Suspect/*` | suspect presentation statuses |
| `MD/DeductionBoard` | `deductionBoard` |
| `MD/Accusation` | `accusation` |
| `MD/Verdict/Wrong` | `wrongAccusationRecovery` |
| `MD/Verdict/Closed` | `verdict` |
| `MD/Summary` | `summary` |
| `MD/Pause` | `pause` |
| `MD/Captions` | captions overlay |
| `MD/ReducedMotion` | reduced-motion variants |
| `MD/Layout/Phone|Tablet|Desktop` | `layoutMode` |

## Scene states

Covered locations / presentation phases:

- briefing
- office / world
- evidence stations (`available` / `active` / `completed`)
- clue discovery (presentation-only motion)
- suspect states (`alive` / `eliminated` / `accused` / `culpritRevealed`)
- deduction board
- accusation
- wrong accusation / recovery
- verdict
- summary
- pause / settings
- captions
- reduced motion
- responsive layouts (`phonePortrait` | `tablet` | `desktop`)

## React DOM vs Phaser

**React DOM (required for a11y / reliability):**

- briefing copy and continue control
- challenge overlays: tables, numeric forms, selectors, keypads, equations, semantic evidence text
- challenge result / feedback copy
- pause / settings controls
- captions region
- focus traps for overlays

**Phaser:**

- detective office / world
- station markers and availability/completed presentation
- clue-discovery motion
- suspect / character presentation
- deduction-board motion
- accusation / verdict / summary staging
- pause backdrop
- reduced-motion / layout presentation flags

Do not force complex math interactions into canvas sprites.

## Typed SceneModel

`projectScene(engineState, options)` emits:

- `casePhase`, `location`, `presentationPhase`
- `stations[]`, `completedStationIds`
- `clue` presentation state (payload + solved/attempts/hints/points display)
- `suspects[]` with **engine-derived** status only
- `deduction` chips / links / canAccuse
- `overlay`, `focusTarget`, `layoutMode`
- `animation` metadata (`generation`, reducedMotion, captions, pendingPresentationComplete)

**Must not contain:** a solver, culprit authority, constraint predicates, or scoring logic.

## Bounded intents

`enterStation` · `inspectEvidence` · `openChallenge` · `closeChallenge` · `openDeduction` · `chooseSuspect` · `accuse` · `continue` · `presentationComplete`

Engine state determines legality via `resolveSceneIntent`. Stale `sessionId` / `generation` / `caseId` intents are rejected.

`presentationComplete` only unblocks animation; it **cannot** earn evidence or advance authoritative case state.

## Focus transfer

| Transition | Focus target |
| --- | --- |
| Phaser world → React challenge | `overlay.challenge` |
| Challenge → React result | `overlay.result` |
| Result / challenge close → world | `world.station.<evidenceId>` via `focusAfterOverlayClose` |
| Briefing | `dom.briefingContinue` |
| Summary | `dom.summaryPrimary` |

Never restore focus into an invisible canvas object. Prefer named DOM restore targets or an explicit world station marker id.


