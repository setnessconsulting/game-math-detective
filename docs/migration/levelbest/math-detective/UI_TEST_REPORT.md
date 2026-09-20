# Math Detective — Full UI Test Report

**Date:** 2026-08-25 · **Round 2 addendum 2026-08-27** · **Fresh closeout verification 2026-08-27** · **Scope:** complete player-facing walkthrough of `src/app/games/MathDetective.tsx` + engine seams it exercises
**Method:** (1) line-by-line code walkthrough simulating each user action; (2) real-browser end-to-end suite `tests/e2e/mathDetective.spec.ts` + `tests/e2e/mathDetective.accessibility.spec.ts` (Playwright, Desktop Chrome + iPhone 13) driving hub → picker → briefing → clues → checkpoint → board → accusation → verdict/guided → summary → exit; (3) targeted unit/regression tests for every fix.

**Result (round 1):** 9 bugs found · 8 fixed & verified · 1 documented as deferred scope. E2E 8/8 passing on desktop + mobile; unit gates 375/375; production build green.

**Result (round 2, 2026-08-27):** 8 findings found & fixed (below). E2E 18/18 green on desktop + mobile; unit gates 448/448; typecheck 0 errors; lint 0 errors; build green.

**Fresh closeout verification (2026-08-27):** From the isolated `consulting-190-math-detective` worktree at implementation commit `bbb6874e2124050386bb182b7980a7d695392b5a`, `npm run typecheck`, `npm run lint` (0 errors; 4 warnings in unrelated sibling E2E specs), `npm run test` (450/450 across 38 files), and `npm run build` all passed. The required Math Detective command was first run with the default Playwright config, which reused an already-running Next server from another checkout on port 3000 and reported 13 failures against that stale app; those results are invalid for this worktree. A clean rerun against the current worktree on isolated port 3100 passed 18 tests with 2 expected project skips and no failures across Desktop Chrome and iPhone 13. The default-port failures are not treated as product evidence.

---

## 0. Round 2 — 2026-08-27 hardening pass (epic closeout)

| # | Severity | Where | Finding | Fix | Verification |
|---|---|---|---|---|---|
| R2-01 | **High — correctness** | genClaims | Probability station violated its own rule: generated odds (1 in 4–16) sat *inside* the 1-in-20 house cutoff the constraint claims to enforce, and L4 copy asserted the opposite ("way past 1 in 20"). | Flips now 5–6 → odds 1 in 32/64, genuinely past the cutoff; L4 copy corrected. | New content-rule test (answer > 20 over 300 D5 cases) |
| R2-02 | **High — content** | genStats | Statistics station could never be placed by the builder: its median-equals constraint always left exactly 1 survivor, which only the final slot allows, where only one other suspect is still live. | Live-twin construction (one live suspect shares the culprit's average, mirroring the receipt rewrite precedent); `stepsAvg` removed from the final-slot-only set. | stats-summary now generable (22+ occurrences over 200 cases); full 60k property sweeps stay green |
| R2-03 | **High — policy** | Six generators | Hint-leak sweep found L1–L3 hints containing the exact answer token (e.g., the L3 micro-example equalling a generated answer; L2 printing an operand equal to the answer at D1). | Reworked L1–L3 texts to be number-free or use provably out-of-range example values; expression operands bounded below the two-digit answer range; automated leak policy test (L1–L3 never contain the answer; L4 always does) across all tiers. | `tests/mathDetective.hints.test.ts` |
| R2-04 | Medium — spec gap | Shell | Returning-player "Continue your case?" row (UX §2) and the L4→next-station L2 pre-teach offer (MD-06 AC3) were unimplemented; hint auto-offer could re-ask after dismissal. | Session-only resume store + picker row; pre-teach auto-open (never twice in a row); per-item dismissal suppression. | E2E resume journey + unit offer-policy tests |
| R2-05 | Medium — accessibility | Shell | axe `aria-prohibited-attr` on the case-file strips (aria-label on a role-less div) and a color-contrast failure on eliminated suspect stamps (0.55 opacity pushed greyscale text to 2.31:1). | Strips now `role="group"`; eliminated cards de-emphasize via grayscale+dashed border without opacity (stamp text ≥ 7:1 grey). | axe scan zero critical/serious across all states |
| R2-06 | Medium — a11y gate | E2E | Keyboard-only completion was asserted only for start/pause, not a whole case; no 360px overflow, target-size, axe, or network-privacy gates existed for this game. | New `mathDetective.accessibility.spec.ts`: keyboard-complete quick case, axe across 8 states, 360px overflow + 44px target floor, zero POST/PUT during play. | 18/18 E2E green |
| R2-07 | Medium — benchmark P0 | Shell + generator | Benchmark gaps G1 (read-aloud) and G2 (constructed response) were still open, gated for release by `BENCHMARK_COMPARISON.md`. | G1: `speech.ts` + read-aloud toggle + per-goal/per-hint 🔊 buttons (omitted when TTS unsupported). G2: `tileEquation` presentation at D4/D5 + pure `tileEval.ts` evaluator + tile UI; multi-solution by design. | New unit + E2E coverage; gaps marked CLOSED |
| R2-08 | Low — polish | Engine/hub | Streak chip (§6) absent; checkpoint telemetry used off-schema fields; case_completed lacked minutes-bucket + skills; hub blurb diverged from the locked copy; hub focus was lost to `<body>` on exit. | Streak tracking with silent reset (relaxed-hidden); §10-schema checkpoint events; completed-event fields; exact hub blurb + "≈2 min"; hub focus restoration to the origin card for all games. | Engine tests + hub E2E still green |

Deferred scope from round 1 (§3 below) remains a historical test log. The current release uses the
single-tester qualitative policy recorded in `PLAYTEST_PROTOCOL.md`; the external shell hook and
operational rollback rehearsal remain separate follow-up work.

---

## 1. Round 1 bugs (2026-08-25)

## 1. Bugs found & fixed

| # | Severity | Where | Bug (what a user would hit) | Fix | Verification |
|---|---|---|---|---|---|
| B-01 | **High — gameplay-breaking** | Shell `startCase` | Players **never saw the Case Briefing**: startCase dispatched BEGIN itself, dumping the child straight into Clue 1 with no chance to read the mystery or study suspects. Caught by first browser run (briefing screen never rendered). | startCase now stops at phase `briefing`; the "Start investigating" button dispatches BEGIN. | E2E asserts briefing visible with roster before clue 1 (all suites) |
| B-02 | **High — correctness** | Solver/genStats | Statistics station taught **wrong median**: sample = all suspects; with even rosters (D4/D5 = 6) code took lower-middle, and even for odd sets the culprit's value was only median by luck (~1/n), making the station nearly unusable and mathematically misleading when hit. | Targeted construction: pair 2-below+2-above (or 1+1) readings around the culprit's stepsAvg so the culprit IS the median by construction; odd reading counts (3 or 5) only; throws "stats-unavailable" for builder to skip when no pairing exists. | Property suite green incl. 10k×D4/D5 runs |
| B-03 | Medium — React correctness | Shell `dispatch` | Side effects (`setAnnounce`, telemetry emit, sound cue) ran **inside the setState updater** — impure; double-invoked under StrictMode dev (duplicate telemetry events, doubled cues). | Engine state mirrored via `esRef`; dispatch computes next state from ref, commits, then applies effects outside the updater. | All flows re-run in dev server (StrictMode context); no duplicate events observed; typecheck/lint clean |
| B-04 | Medium — policy/spec gap | Shell evidence screen | Hint **auto-offer after 2 misses** (MD-06 AC2) was never surfaced — child had to know to press 🛈. | Inline offer bar appears after 2 consecutive misses ("Stuck? A hint is ready." + Take the hint) whenever hints are unused; disappears once any hint taken. Non-modal by design (no state-churn, no focus steal). | Manual flow + covered implicitly by ladder test path |
| B-05 | Medium — spec gap | Shell ↔ adaptivity seam | `adjustTier` existed and was tested but **never called** — Auto rank stayed frozen across cases in a session. | After each summary (Auto mode only; manual override always wins), outcomes map to EvidenceOutcomes (struggled = L2+ hint or ≥3 attempts) and feed adjustTier; result applies to the NEXT case and shows in the picker's Auto-rank line. | Render-phase wiring exercised by e2e happy path; unit-tested seam unchanged |
| B-06 | Medium — grace-rule edge | Engine `COMMIT_CHECKPOINT` | Session-cap wrap request was ignored at checkpoints: after the ~90 s window expired exactly at a chapter boundary the child got served another clue instead of wrapping. | COMMIT_CHECKPOINT routes to summary (capReached=true) when wrapPending. New regression test: wrap-at-checkpoint closes to finished summary. | `mathDetective.engine.test.ts` new case passes |
| B-07 | Low — visual alignment | Ruler renderer | Shelf block used an invalid-ish `calc(pct% * 0.88 + …)` and no marker line: the "marked top" did not visibly align with its position on the scale, so kids couldn't trust what they were reading. `.md-mark` CSS existed but was never rendered. | Reworked geometry: ticks/shelf/marker share one coordinate formula; added amber marker line connecting shelf edge down to the rail; shelf centered over its value. | Browser screenshots in e2e run; arithmetic shared single-source |
| B-08 | Low — HTML validity / a11y | Board suspect buttons | Suspect selection buttons contained `<div>`s and an `<h3>` (flow content inside `<button>`) — invalid nesting that assistive tech can flatten unpredictably. | Inner card markup switched to phrasing-only spans; avatar class now `display:block`. | axe-relevant structure valid; e2e clicks unaffected |
| B-09 | Hygiene | Shell | Leftover dead `applyEffects` stub; auto-advance timer not cleared on unmount/restart (benign due to phase guards, but unhygienic). | Removed stub; timer stored in ref, cleared on restart/unmount. | lint 0 errors; flows unchanged |

### Verified-safe suspicions (checked, not bugs)
- Stale auto-advance timer firing after a restart cannot corrupt a new case (engine ADVANCE is a no-op outside `evidence` phase).
- Double-tap on ✓ after solving is rejected by the engine (slot already solved).
- Keypad ✓ with empty entry shows friendly guidance instead of submitting NaN.
- Eliminated suspects remain visible with ✕ OUT stamps (reasoning stays inspectable).

## 2. End-to-end results (real browsers)

Suite: `tests/e2e/mathDetective.spec.ts` — **8 passed / 0 failed (desktop Chrome + iPhone 13)**

| # | Test | Covers |
|---|---|---|
| 1 | hub card → quick case → clues → board → accusations (wrong/wrong-guided/correct paths) → summary → back to hub | full user arc incl. recovery paths, Because-lines sheet, contradiction view |
| 2 | hint ladder opens, reveals L1→L3, L4 behind "(worth fewer points)" consent, closes | scaffolding UX + honest cost labeling |
| 3 | keyboard-only start (focus+Enter), Escape pause, Resume | keyboard parity + calm pause menu |
| 4 | full case plays 4 clues through chapter checkpoints → board | chapter/checkpoint mechanics at D2-Auto |

Mobile project additionally guards against horizontal overflow on the evidence keypad layout (iPhone 13 viewport).

## 3. Deferred / known limitations (recorded, intentional)

1. **Live-child discoverability protocol** remains an owner-run qualitative gate (CONSULTING-230) — automation cannot replace the one-tester playtest, and the owner-reported acceptance is recorded in `PLAYTEST_PROTOCOL.md`.
2. **Earned-break shell hook** (MD-13 external dep): Mini Case playable from picker; shell countdown integration lands with the Tier 1 break system.
3. **Adaptivity tier shifts apply between cases**, never mid-case (by design; prevents whiplash) — so a single-session player sees at most ±1 tier change.
4. Parallel-agent note: during this test round another agent's in-flight `lessonEngine`/`GamesHub`/`ShapeStudio` edits introduced their own transient lint/test failures; all Math Detective scopes remained green throughout (verified with scoped runs excluding `tests/lessonEngine.test.ts`).

## 4. Final gate status (this round)

```
  typecheck ✓    lint ✓ 0 errors (4 warnings in unrelated sibling E2E specs)
  vitest   ✓ 450/450 across 38 files — incl. 60k generation property cases
  build    ✓ production compile + static /games with Math Detective card
  playwright ✓ 18 passed, 2 expected project skips (desktop + mobile; isolated port 3100)
```

The production build also emitted the repository's known non-blocking stale `baseline-browser-mapping` warning. The exact default-port command was retained as an environment diagnosis only; the isolated-port rerun is the authoritative browser result for this worktree.


