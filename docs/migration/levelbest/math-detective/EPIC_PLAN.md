# Math Detective — Epic Plan (Phase 4)

**Status:** Locked 2026-08-25 · Merges [REQUIREMENTS.md](REQUIREMENTS.md), [UX_DESIGN.md](UX_DESIGN.md), [PROTOTYPE_NOTES.md](PROTOTYPE_NOTES.md)
**Jira home:** `CONSULTING` project · labels `levelbest`, `game-math-detective` (+ topic labels) · stories use `Parent` link to the epic (next-gen hierarchy). Note: this project exposes no story-points field, so estimates are carried in the description (`Estimate:` line) and verified by the readiness audit.

---

## Epic — Math Detective: contextual reasoning & evidence engine

**Summary.** Ship Math Detective to the free-site `/games` page and wire its earned-break Mini Case mode: one evidence-driven detective game whose case generator builds mysteries from the learner's placement signal across grades 1–8, with a deterministic AI-tutor hint ladder, honest scoring, full accessibility conformance, and parent-brief itemization.

**Description.**
LevelBest's signature AI-native game (GAMES_PLAN Tier 2 idea #3; benchmark: *Odd Squad: Agent Check-Up*, mechanics-level only). Each session is a case: solving math evidence items earns constraint chips that eliminate suspects on a deduction board until exactly one culprit remains. One polished engine scales across skills and grades via four seams — skill definition, problem generation, AI-tutor intervention, learner model — validated in miniature by the prototype (`docs/games/math-detective/prototype/`).

**Artifact links.**
- Requirements (PRD + architecture seams + red-team synthesis): `docs/games/math-detective/REQUIREMENTS.md`
- UX spec (flows, states, a11y system + review log): `docs/games/math-detective/UX_DESIGN.md`
- Prototype notes (validated core loop, Builder prompts, IP record): `docs/games/math-detective/PROTOTYPE_NOTES.md`
- Readiness verdict: `docs/games/math-detective/SPRINT_READINESS.md`

**Curriculum coverage statement.** Ten skill stations map to CCSS clusters spanning grades 1–8 (measure-length, time-elapsed, data-tables, money-receipts, fractions-parts, ratio-proportion, grid-coordinates, expressions-codes, stats-summary, probability-claims — full table in REQUIREMENTS §3). Five difficulty tiers D1–D5 cover every placement band `{grade 1–8 × early/mid/late}`; every tier ships ≥4 available stations. No grade band is reachable without ≥2 station types active.

**Success signals.** REQUIREMENTS §15: ≥60% case-start→verdict completion; Mini Case median 75–110 s; hints concentrated L1–L2 ≥70%; recovery-after-wrong-accusation ≥80%; learning-share ≥80% preserved; zero banned-pattern findings.

**Stories:** MD-01 … MD-15 below. Dependency graph:

```
MD-01 ─┬─> MD-02 ─────┬──────────────┐
       └─> MD-03 ─┬──> MD-04        │
                  ├─> MD-05 <───────┘(engine+skills)
                  ├─> MD-06 ──> MD-07 ─> MD-08 ─┬─> MD-09 (a11y)
                  │                             ├─> MD-10 (records)
                  │                             ├─> MD-11 (telemetry+brief)
                  │                             └─> MD-12 (/games hub)
                  │                             └─> MD-13 (earned break; ext. dep: lesson-block hook)
                  └─(all)──────────────────────────> MD-14 (gates) ─> MD-15 (benchmark polish + playtest)
```

---

## MD-01 · Shared game primitives + detective seam contracts

**Estimate:** 3 pts · **Depends on:** none · **Blocks:** MD-02, MD-03
**Scope.** Extract/promote shared primitives under `src/lib/games/shared/` (mulberry32 rng re-exported by numberLineJumper — no duplicate algorithm; SessionClock/cap enforcement; telemetry port interface; learner-model signal types; hint-ladder contract) and add `src/lib/mathDetective/types.ts` implementing REQUIREMENTS §13.3 payload types verbatim. No behavior change to shipped games except NLJ importing shared rng.
**AC:**
- Given a fresh import of `@lib/games/shared/rng`, when two consumers seed identically, then sequences match bit-for-bit with the legacy NLJ implementation.
- Given `types.ts`, when `tsc --noEmit` runs, then all §13.3 interfaces compile with zero `any`.
- Given the storage-guard test suite, when run after the refactor, then it passes unchanged (no new persistence).
**DoD:** unit tests for rng parity + SessionClock pause/resume/visibility; lint/typecheck clean; no changes to game behavior or visuals; reviewed against REQUIREMENTS §13 module layout.

## MD-02 · Detective engine core (pure state machine)

**Estimate:** 5 pts · **Depends on:** MD-01 · **Blocks:** MD-05, MD-07
**Scope.** `src/lib/mathDetective/engine.ts`: pure reducer over briefing→evidence→checkpoint→board→accuse→verdict→summary; consumes generated payloads only; emits Effect[] (telemetry/audio/announce); implements scoring contract (10/6/3 taper, hint caps 6/3, silent streak reset), wrong-accusation flow incl. guided walkthrough state, mini/full case shapes, hard-cap wrap rules (REQUIREMENTS §§4–8). Prototype logic in `docs/games/math-detective/prototype/engine.js` is the behavioral reference.
**AC:**
- Given a seeded case, when the full happy path is reduced, then final state matches the prototype's summarize() outputs for identical inputs (golden fixture).
- When accusation is attempted without required evidence-links at D3+, then reduce() rejects with reason and no phase change.
- When a second wrong accusation occurs, then state enters guided resolution and still completes with badge omitted.
- When the wrap cap fires mid-item, then the current item completes before transition (grace rule §7).
**DoD:** Vitest golden fixtures + property tests (no state where points decrease; no phase skips); pure functions only (no DOM/network); docs comments cite requirement sections.

## MD-03 · Skill registry + problem generation D1–D3 (+ uniqueness solver)

**Estimate:** 8 pts · **Depends on:** MD-01 · **Blocks:** MD-04, MD-05, MD-06
**Scope.** `src/lib/mathDetective/skills.ts` registry (all ten skill defs with tiers/knobs/CCSS/misconception tags) plus generators for D1–D3-reachable stations: measure-length, time-elapsed, data-tables, money-receipts, fractions-parts, expressions-codes(fact level). Includes the uniqueness solver (exact-one-culprit, no-early-prefix, every-clue-eliminates) with 20-retry budget and hand-authored deterministic fallback cases per tier (§5.1, A3). Ruler/countability rule from PROTOTYPE_NOTES §3.5 encoded.
**AC:**
- Given 10,000 seeds per tier D1–D3, when generateCase runs, then zero violations of the three uniqueness properties (property test).
- Given solver retry exhaustion, when generation fails 20×, then the fallback case returns deterministically and logs `mdetect.error{code:fallback-used}`.
- Given any generated fraction display, when parsed, then it is in simplest form; given any ruler item, then the answer position is never exactly on a labeled tick more than 15% of the time.
- Given D1 content strings, then sentences ≤12 words (automated copy-length test).
**DoD:** property + edge tests merged; registry exports consumed-by-construction (engine compiles against it); CCSS alignment column peer-reviewed against cluster intent; no UI code.

## MD-04 · Problem generation D4–D5

**Estimate:** 8 pts · **Depends on:** MD-03 · **Blocks:** MD-05 (content availability), MD-14
**Scope.** Generators for remaining stations at advanced knobs: grid-coordinates (5.G/6.NS), ratio-proportion (6–7.RP), expressions-codes (EE/FS), stats-summary (SP mean/median/outliers), probability-claims (7.SP likelihood audit), decimal/negative variants. Two-step evidence items allowed at D4/D5 (payload sub-steps).
**AC:**
- Given 10,000 seeds per tier D4/D5, uniqueness properties hold; two-step items always resolvable in ≤2 reductions.
- Given stats items, then datasets are integers or 1-decimal, outlier rule explicit, and no dataset requires computing beyond tier arithmetic knobs.
- Given probability claims, then plausibility threshold uses documented cutoffs (e.g., p < 1%) and explanation strings accompany every claim.
**DoD:** same test bar as MD-03; cross-tier smoke: every tier has ≥4 stations generable; performance budget: generation <50 ms p95 on CI hardware.

## MD-05 · Adaptive difficulty wiring (placement/mastery)

**Estimate:** 3 pts · **Depends on:** MD-02, MD-03 · **Blocks:** MD-07
**Scope.** Map assessment `PlacementResult.band {grade, third}` → tier D1–D5 (REQUIREMENTS §3 table); implement `initialTier()` + `adjustTier()` using in-session outcomes (two first-try-no-hint ⇒ knob up; two hint-heavy/mash-flagged ⇒ knob down + L2 pre-teach offer); missing placement ⇒ default D2 + calibration chapter (A12). Manual rank override always wins.
**AC:**
- Given every band {grade 1–8 × early/mid/late}, initialTier maps per the locked table (table-driven test enumerates all 24 bands).
- Given outcome sequences [ok,ok] / [hint,hint] / mash-flags, adjustTier moves within tier bounds and never jumps >1 tier in a session.
- Given null placement, default tier D2 and calibration chapter present.
**DoD:** unit tests incl. boundary bands; integration point documented for future account-backed mastery; no persistence added on free site.

## MD-06 · AI-tutor hint intervention (deterministic ladder v1)

**Estimate:** 5 pts · **Depends on:** MD-03 · **Blocks:** MD-07
**Scope.** `getHint()` implementation + misconception-tagged ladder content L1–L4 per generator payload; auto-offer after 2 misses; L3/L4 consent gating; independence-score coupling; `HintResponse.source:"rule"` binding on free site; LLM adapter port defined but unbound (interface only, no network call ships).
**AC:**
- Given any D1–D5 item, requesting levels L1→L4 returns non-empty, misconception-tagged text authored for that tag (content coverage test over registry).
- Given 2 consecutive misses, exactly one auto-offer event fires; dismissing suppresses re-offer for the next item.
- Given L4 used, item caps at 3 pts and next-station L2 pre-teach flag sets.
- Given free-site build, `grep` proves no fetch/XHR in hint path; adapter compiles behind an unbound port.
**DoD:** content review vs banned-copy list (§12 UX); ladder logged events match schema §10; prototype parity spot-checks.

## MD-07 · UI shell — briefing, evidence stations, checkpoint (core loop screens)

**Estimate:** 8 pts · **Depends on:** MD-02, MD-06 (and MD-03/05 payloads) · **Blocks:** MD-08
**Scope.** React `MathDetective.tsx` following repo demo-panel conventions: case picker (first-run 2-button + Auto rank), briefing lineup w/ icon attribute chips, station renderer per PresentationPayload union (ruler, clock pair, data table, receipt, keypad input), goal bubbles, persistent hint sheet, checkpoint stamps, constraint-chip fly-to-casefile animation, aria-live announcements, progress dots, exit/pause everywhere. Prototype `index.html` is the interaction reference.
**AC:**
- Given each PresentationPayload kind shipped in MD-03, the renderer renders it keyboard- and touch-operably with SR labels matching UX §4/§6.
- Given correct/incorrect submissions, feedback appears <150 ms locally with ✓/✗ glyph+word (never color-only) and constraint chip animates (fade under reduced-motion).
- Given Esc or ⏸ at any screen, pause opens with resume/restart/a11y/hub options.
**DoD:** component tests for renderers; manual keyboard walkthrough recorded; visual consistency pass vs existing games' shells.

## MD-08 · UI shell — deduction board, accusation, verdict, summary, settings

**Estimate:** 5 pts · **Depends on:** MD-07 · **Blocks:** MD-09…MD-13
**Scope.** Board matrix (ARIA grid desktop / stacked cards mobile) with ✕/✓ linking, two-step accusation sheet with auto-"Because…" lines, contradiction side-by-side view, guided-resolution walkthrough, CASE CLOSED verdict + badges, summary cards (independence headline, skills, coaching line), Relaxed mode + sound/text-size/reduced-motion settings persisting per session.
**AC:**
- Given a solved case, accusation confirm shows ≥2 "Because…" lines at D3+; wrong accuse renders contradicting constraint adjacent to accused card; second miss starts walkthrough and completes case.
- Given summary, independence score leads; parent-readable footer lists practiced skills; personal-best delta shown only when beaten.
- Given Relaxed mode on, progress dots and streak chips hidden everywhere.
**DoD:** e2e happy path + wrong-twice path scripted; grayscale screenshot review artifact attached (de-colorization invariant); mobile 360 px no-overflow check.

## MD-09 · Accessibility controls & conformance bundle

**Estimate:** 3 pts · **Depends on:** MD-08 · **Blocks:** MD-14
**Scope.** Enforce UX §8–§13 globally in-game: focus-visible tokens, ≥48px targets (44px floor), captions-on-text invariant, colorblind-safe pairs + pattern overlays, reduced-motion global honor, zoom 200%/320px reflow, SR board semantics, axe gate integration for game routes.
**AC:**
- axe-core: zero critical/serious violations across all game states in CI.
- Programmatic target-size assertions pass at Pixel-7 and iPhone SE viewports; keyboard-only full case completion e2e passes.
- Grayscale-mode screenshot set reviewed and attached; every state carries glyph+word.
**DoD:** a11y findings triaged to zero open blockers; conformance notes added to game README section.

## MD-10 · Score records ("beat your best")

**Estimate:** 2 pts · **Depends on:** MD-08 · **Blocks:** MD-11 (summary surfacing)
**Scope.** Per-tier best independence score + cases-cracked count; free site: session-memory only (extends storage-guard contract); in-app seam: account-scoped record store interface bound later. Summary delta line "New best!" only on beat; no cross-child comparison anywhere (policy).
**AC:**
- Given records exist, summary shows delta iff current > best; ties do not claim records.
- Given free-site reload, records reset with no storage writes (storage-guard test extended to detective keys).
- Given any copy surface, grep finds no comparative-between-players language.
**DoD:** unit + guard tests; policy checklist signed in PR description.

## MD-11 · Telemetry + parent-brief itemization

**Estimate:** 5 pts · **Depends on:** MD-02 (effects), MD-08 · **Blocks:** MD-14
**Scope.** Emit `mdetect.*` schema (REQUIREMENTS §10) through the shared telemetry port (cookieless sink on free site); parent-brief rows: minutes-by-game inside total, per-case skills/evidence/hints/accusations/independence/coaching sentence; honesty rule for L4-heavy completions; latency buckets only.
**AC:**
- Given a completed case, brief row fields populate exactly from the schema allowlist; payload snapshot test rejects any identifier-shaped or free-text field.
- Given L4 share >60%, brief sentence states reveal-heavy completion plainly.
- Given free site, network capture during a full case shows zero telemetry requests (pageview analytics unaffected).
**DoD:** schema version constant exported; brief rendering covered by tests; privacy checklist mirrors CONSULTING-182 amendment posture.

## MD-12 · Free-site `/games` hub integration

**Estimate:** 2 pts · **Depends on:** MD-08 (playable end-to-end) · **Blocks:** MD-14
**Scope.** Add hub card per GamesHub conventions (title/blurb/tag/icon 🔍, GameReference pattern if used), lazy route wiring, meta description, hub blurb mentions "≈2 min" quick case expectation.
**AC:**
- Given `/games`, card renders with working Play flow into the picker; exit returns to hub cleanly at every phase.
- Given build, quality gates pass; no regression to existing seven games (hub snapshot test).
**DoD:** manual desktop+mobile smoke recorded; analytics pageview unchanged.

## MD-13 · Earned-break unlock + countdown return (in-app)

**Estimate:** 5 pts · **Depends on:** MD-08 · **External dependency (declared):** app-shell lesson-block-complete hook (Tier 1 integration surface outside this epic's repos-side scope; coordinate with shell owners)
**Scope.** Break offer card post-lesson-block; shell-owned neutral countdown strip (never inside game chrome, never red/pulsing); Mini Case mode selection; finish-current-item grace wrap; automatic return with completion tick; session-only resume.
**AC:**
- Given lesson block completes, break offer presents Mini Case; entering starts ~90 s window.
- Given window expiry mid-item, current item completes then wraps to verdict-or-summary and returns to practice; nothing lost; no mid-item cut (state-machine test + shell e2e).
- Given child exits early via pause, return happens immediately without guilt copy; streaks unaffected.
**DoD:** shell integration test scenario; calm-countdown style tokens reviewed vs banned-pattern list (FOMO audit negative).

## MD-14 · Automated tests + quality gates green

**Estimate:** 5 pts · **Depends on:** MD-01…MD-13 · **Blocks:** MD-15
**Scope.** Consolidate suites: generator property tests (10k seeds/tier), engine golden fixtures, scoring/hint caps, adaptivity table test, a11y/target-size e2e, storage-guard extension, banned-token IP grep gate ("Odd Squad", PBS character names, `Dr\. O`), banned-copy grep gate (loss/urgency/comparison phrases), full `npm run typecheck && npm run lint && npm run test && npm run build`.
**AC:**
- All four gate commands exit 0 on a clean clone; CI job wiring documented in repo scripts order.
- Property tests prove zero uniqueness violations across 40k total generations (10k × 4 upper tiers + 10k spread D1–D3).
- Both grep gates fail the build on seeded violation (negative test).
**DoD:** gate evidence posted to this issue; flake sweep (suite run 3× green).

## MD-15 · Benchmark-comparison polish pass + playtest closure

**Estimate:** 3 pts · **Depends on:** MD-14 · **Blocks:** release declaration
**Scope.** Hands-on side-by-side vs *Odd Squad: Agent Check-Up* scored against all nine GAMES_PLAN criteria; remediate any criterion below reference; run the single-tester adult-free discoverability protocol defined in UX §3 — closing the user-only step deferred from PROTOTYPE_NOTES §4; record scores + deltas in this issue. This is a qualitative release check, not a population-level study.
**AC:**
- Scorecard published for all 9 criteria with evidence links; every criterion ≥ reference or remediation loop completed and re-scored.
- Discoverability protocol executed: one uncoached first-run completion, or an owner-recorded qualitative acceptance with any blocking hesitation mapped to a fix or follow-up.
- Banned-pattern audit negative (no FOMO/loss/leaderboard patterns found in final build).
**DoD:** quality-bar sign-off comment or owner release record; GAMES_PLAN/STATUS doc updates
reflecting ship state. The owner release record is now captured in `PLAYTEST_PROTOCOL.md` and the
downstream release record in `docs/RELEASE.md`.

---

## Sprint mapping (proposed)

| Sprint | Stories | Points |
|---|---|---|
| 1 | MD-01, MD-02, MD-03, MD-06 | 21 |
| 2 | MD-04, MD-05, MD-07, MD-08 | 24 |
| 3 | MD-09…MD-13 | 17 |
| 4 | MD-14, MD-15 | 8 |
| | **Total** | **70** |

Decomposition check: largest story 8 pts; every story fits comfortably inside a 1–2 week sprint alongside existing portfolio work.


