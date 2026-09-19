# Math Detective — Renderer / Engine Boundary (GAME-136)

**Status:** Implementation contract for GAME-106 Phaser foundation  
**Authority:** TypeScript case engine in `src/lib/mathDetective/`  
**Baseline freeze:** golden fixtures in `src/lib/mathDetective/golden/` + `tests/mathDetective.golden.test.ts`

This document defines exactly what a presentation layer (React today, Phaser + React overlays next) may observe and emit. It does **not** authorize Phaser (or any renderer) to determine learning-case truth.

---

## Engine-owned (authoritative)

The pure reducer / generator / solver own:

| Concern | Module |
| --- | --- |
| Case generation & uniqueness | `solver.ts`, `generate.ts` |
| Evidence truth & answers | `GeneratedEvidence.answer` |
| Constraint predicates | `Constraint.test` |
| Suspect elimination (`aliveIds`) | `engine.ts` after earned clues |
| Challenge correctness | `SUBMIT_ANSWER` |
| Hint ladder content & caps | `hints.ts` + scoring caps |
| Accusation correctness & recovery | `ACCUSE`, `RETRY_FROM_VERDICT`, guided |
| Verdict / outcome / score | `outcome`, `summarizeCase`, `scoreEvidence` |
| Adaptivity / tier shift | `adaptivity.ts` |
| Telemetry event payloads | engine effects + `parentBrief.ts` |
| Resume snapshot contents | `resume.ts` (in-memory) |
| Learner progression / records | `records.ts` |

Phaser must never compute or override these.

---

## Renderer-observable state

A presentation layer may **read** (via projection / scene model) and display:

- Current case **phase**: `briefing | evidence | checkpoint | board | verdict | guided | summary`
- Case identity for presentation only: `caseId`, `title`, `intro`, `tier`, `mode`
- Suspect cards: `id`, `name`, `initial`, `icon`, and **engine-derived** status (`alive` iff id ∈ `aliveIds`)
- Station / evidence list derived from `run.evidences`:
  - `id`, `skillId`, `goal`
  - `presentation` payload (ruler, table, keypad inputs, etc.)
  - constraint **chip / sentence** text (not the predicate)
  - solved / attempts / hintsUsed / points from `slots` (display only)
- Current evidence index (`current`) and checkpoint marks (diagnostic UI only)
- Earned constraint chips (`earnedIds` → chip text)
- Deduction **links** toggled by the learner (`links`) — presentation of board marks
- Accusation history for contradiction / guided walkthrough UI
- Summary model fields for end screen (points, independence, badges, coaching)
- Presentation metadata: reduced-motion preference, captions, mute, layout mode
- Animation / presentation phase flags (e.g. “clue reveal playing”) that **do not** mutate engine state

### Explicitly not observable as authority

- Culprit id must not be treated as a renderer secret that Phaser “decides”; if shown, it is only after engine verdict.
- `Constraint.test` is not part of the serializable renderer contract.
- Correct numeric answers may be held by React challenge overlays for grading **only** by dispatching `SUBMIT_ANSWER` to the engine — never by Phaser inventing correctness.

---

## Bounded intents (renderer → host → engine)

Renderers may propose intents. The host maps **legal** intents to `EngineAction`s. Illegal intents are dropped.

| Intent | Typical engine mapping | Notes |
| --- | --- | --- |
| `continue` (from briefing) | `BEGIN` | |
| `enterStation` / `inspectEvidence` | presentation-only or select current item | Does not earn evidence |
| `openChallenge` / `closeChallenge` | overlay focus only | No case mutation |
| `submitChallenge` (React) | `SUBMIT_ANSWER` | Engine grades |
| `requestHint` (React) | `REQUEST_HINT` | |
| `advanceAfterClue` | `ADVANCE` | Only after engine marks solved |
| `openDeduction` | phase already `board` or navigate presentation | |
| `chooseSuspect` | presentation selection | Accuse is separate |
| `accuse` | `ACCUSE` | Engine checks links / correctness |
| `presentationComplete` | **no** authoritative advance | Unblocks animation only |

Stale intents (wrong `sessionId` / `generation` / `caseId` / `itemId`) must be ignored.

---

## React DOM vs Phaser ownership (preview for GAME-137)

**Prefer React DOM** for semantic math: tables, numeric forms, selectors, keypads, equations, challenge text, pause/settings, captions.

**Prefer Phaser** for world/office, station markers, clue-discovery motion, suspect staging, deduction-board motion, environmental feel — always driven by engine-projected scene state.

---

## Freeze rule

Any intentional change to case generation, uniqueness, scoring, elimination, or verdict semantics requires a **separate approved GAME issue**. Golden fixtures and integrity tests must be updated in the same change.


