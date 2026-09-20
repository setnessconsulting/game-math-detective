# Math Detective — Prototype Notes (Phase 3)

**Status:** Core-loop prototype playable + engine logic machine-verified · 2026-08-25
**Prototype location:** [`prototype/index.html`](prototype/index.html) (+ `engine.js`, `engine.test.mjs`)
**Tool context:** GamineAI Builder ([repo](https://github.com/GamineAI/GamineAI-Builder-) · builder at gamineai.com/builder)
**IP stance:** mechanics-level inspiration from *Odd Squad: Agent Check-Up* only — original names, cast, theme, art, audio direction, writing, layouts (evidence below).

---

## 1. What was built

A throwaway, self-contained **Quick Case** implementing the full core loop from REQUIREMENTS §4 at difficulty D3 ("The Case of the Missing Trophy"):

```
briefing (suspect lineup w/ icon attribute chips)
→ evidence station 1: ruler reading → constraint chip flies to case file
→ checkpoint: survivor marking
→ evidence station 2: elapsed time from clock pair → constraint
→ deduction board: suspect × constraint grid with ✕ linking
→ two-step accusation w/ auto-written "Because…" lines
→ verdict: CASE CLOSED stamp OR side-by-side contradiction view → re-accuse
→ summary: independence score headline, skills practiced, coaching line
```

Implementation follows the UX_DESIGN spec where it matters for validation: goal bubbles, persistent hint button, hint ladder L1–L4 (L4 = explicit consent tap labeled "(worth fewer points)"), keypad input, aria-live announcements, focus-visible rings, ≥48px targets, glyphs+words on every state (grayscale-safe), sound **off by default** (tiny oscillator cues only when enabled), reduced-motion honored (shorter reveal pauses), eliminated suspects stay visible with ELIMINATED banner, no timers anywhere.

`engine.js` deliberately mirrors the production seam contracts (REQUIREMENTS §13.3): pure payload generation data, scoring function, hint ladder source, and the **uniqueness solver** — so the throwaway validates the architecture shape, not just visuals. Output format (single-file HTML/CSS/JS) matches GamineAI Builder's export format so a Builder-exported iteration can be diffed against this baseline.

## 2. What was validated (confirmed evidence)

| Check | Method | Result |
|---|---|---|
| Case uniqueness properties (exactly-one culprit; no prefix solves early; every clue eliminates ≥1) | `node engine.test.mjs` — solver assertions | ✅ PASS |
| Scoring contract: attempt taper 10/6/3; L1–L2 hint caps at 6; L3/L4 cap at 3 | same | ✅ PASS |
| Independence-score math incl. zero-evidence edge | same | ✅ PASS |
| Hint ladder returns authored text L1–L4 for both stations; unknown id → null | same | ✅ PASS |
| Deterministic PRNG present for future seeded generation | code review vs repo `mulberry32` convention | ✅ same algorithm family |
| Inline UI script syntax | extracted to temp file, `node --check` | ✅ OK |
| DOM integrity: all 29 `$("id")` references resolve to elements in markup | regex cross-check script | ✅ ALL RESOLVED |
| IP token scan across game folder (`Odd Squad`, character names, `Dr. O`, `PBS`) | recursive grep; hits audited manually | ✅ CLEAN — only false positives (`"otto"` inside CSS `border-bottom`) and legitimate benchmark citations in `REQUIREMENTS.md` |

Full test transcript: 8/8 checks pass (`ALL CHECKS PASSED (8)`), re-runnable via `node engine.test.mjs`.

## 3. What failed or changed during iteration (honest log)

1. **First scoring sketch let hints reduce first-try points below retry points.** Fixed by capping at `min(base, cap)` — now a hint can never make an honest retry worth less than a hinted first try. Test added.
2. **Standalone "Check it" button duplicated the keypad's ✓ key**, creating two submission affordances (cognitive-load finding against UX principle 5). Keypad ✓ became the single submit; the standalone button is hidden at station render. If playtest shows kids look for a big right-hand button, restore it and drop the keypad Go key instead — decision deferred to playtest spike.
3. **Checkpoint toggling was initially wired to mutate the alive-set** — wrong: truth must come from constraints, not child taps (checkpoint is diagnostic, not authoritative). Reduced to display+announce-only in prototype; production engine keeps them separate (matches EngineAction `checkpoint_mark` being telemetry-only).
4. **Ladder consent**: an initial draft used `confirm()` dialogs for L4 — breaks keyboard flow and looks adult. Replaced by explicit labeled button text ("Show me how? (worth fewer points)"), which also teaches the cost honestly.
5. **Ruler rendering**: proportional tick layout needed the shelf top to land *between* labeled ticks (130 between 120/140) so counting alone doesn't hand over the answer without reading the scale — mirrors NLJ's "never countable dense ticks" rule adapted to rulers.

## 4. Comparison vs quality-bar game (documented-loop comparison)

Benchmark loop of *Agent Check-Up* (from PBS KIDS/PBS LearningMedia descriptions + TCRF teardown): patient presents complaint → two candidate conditions shown → run check-up tools to gather measurement/symptom data → verify readings (temperature etc.) → diagnosis resolves which condition → mix antidote → cure; voiceover guides; skills: fractions, volume, coordinates, greater-than/less-than.

| Aspect | Reference pattern | Prototype response | Verdict |
|---|---|---|---|
| Information-as-evidence | Tool readings decide between exactly 2 hypotheses | Each solved item adds a constraint that visibly changes who survives; board makes reasoning inspectable | Parity achieved in structure; **hands-on kid testing still required before claiming parity in feel** |
| Feedback immediacy | Instant tool reactions, playful cure animation | <150 ms acks; constraint chip + suspect dimming as visible consequence; contradiction view on wrong accuse | Modeled on spec targets; unverified by feel |
| Pacing cadence | Short diagnose→treat per patient | 2-station mini arc ≈ 2 min target; chapter exits clean | Sized correctly on paper; timing unmeasured (no human timing in this run) |
| Discoverability | Voiceover guidance | Icon chips, one-decision screens, pulsing affordance spec, read-aloud optional | Text/icon channel replaces voiceover; non-reader path needs live-kid proof |
| Math breadth | Fractions/volume/coordinates/comparisons fixed set | 10-skill registry spanning grades 1–8 (REQUIREMENTS §3) | Exceeds reference by design intent |

**Explicitly not claimable from the original prototype run:** hands-on play of the PBS reference (browser plugin-era title; not drivable here), live-kid discoverability tests, and feel/pacing judgment. The later one-tester owner acceptance is recorded in `PLAYTEST_PROTOCOL.md`; it is a qualitative release signal and does not retroactively turn this prototype note into a population study.

## 5. GamineAI Builder workstreams — status

Builder is interactive web software (sign-in browser app); it cannot be driven from this headless CLI session. Status per workstream:

| Workstream | Status | Evidence / deliverable |
|---|---|---|
| Game generation prompt | 🟡 Ready-to-paste (blocked: needs interactive browser) | §5.1 below |
| Theme generator direction | 🟡 Ready-to-paste | §5.2 below |
| SFX generator direction | 🟡 Ready-to-paste | §5.3 below |
| Code-editor/export-format alignment | ✅ Done locally | Prototype ships as single-file HTML/CSS/JS, Builder's export shape; diffable baseline exists |
| Live-preview iteration vs pacing/discoverability | ⛔ Blocked (user-only) | Owner runs prompts in Builder, exports, replaces/augments `prototype/`; record deltas here |

### 5.1 Builder game-generation prompt (paste into Builder)
> Build a single-file HTML/CSS/JS educational mystery game called "Math Detective" (original concept). One quick case: briefing screen with 4 suspect cards (avatar initials, height attribute, after-school schedule attribute), 2 math evidence stations — a centimeter ruler reading task and an elapsed-time clock-pair task — each earning a constraint chip into a visible case file; then a checkpoint asking which suspects are still possible; then a deduction grid (suspects × constraints) with tap-to-mark ruled-out states; a two-step accusation with auto-generated "Because…" lines; verdict screen where a wrong guess shows the contradicting constraint beside the accused; summary with independence score, skills practiced, coaching sentence. Kid-friendly: ≥48px touch targets, numeric on-screen keypad, aria-live announcements, visible focus rings, no timers, sound off by default, reduced-motion support, never color-only signals (always glyph+word). Pure vanilla JS, no libraries, nothing saved.

### 5.2 Theme generator inputs (visual direction)
> Preset: playful paper-case-file detective agency for ages 6–13. Palette: warm paper cream background #f7f4ec, ink navy text #1c2333, detective blue primary #2456a6, magnifier amber accent #b35a1f, success green #1d7a3e, error brick #a33125 (all state colors paired with icons+words, never color-alone). Style: flat rounded cards, dashed "case file" borders, stamp effects for ALIVE/CASE CLOSED, subtle paper grain, no photorealism, no characters requiring illustration — initials avatars only. Typography: system-ui stack, large friendly numerals.

(Prototype CSS already implements this palette/token set so a generated theme can be diffed against it.)

### 5.3 SFX generator inputs (audio direction)
> Style: Cartoon, quiet. Four cues max, each ≤300 ms, gentle volume: soft wood-block tick (UI press), warm two-note chime up (evidence earned), low soft pulse down (retry — NOT a harsh buzzer), short triumphant arpeggio (case closed). No voices, no music beds, no scary/harsh sounds; classroom-safe.

(Implemented in prototype as oscillator approximations to validate the "quiet, off-by-default, visually-twinned" policy; generated assets replace these later.)

## 6. IP separation record

- All names, cast, case text, and layouts authored fresh for LevelBest (see `engine.js` SUSPECTS/EVIDENCE literals — no external strings).
- Benchmark used only at mechanics level (information-as-evidence, tool-mediated reading, diagnose cadence).
- Token scan clean (§2). Banned-token grep gate proposed for production CI (EPIC_PLAN QA story).

## 7. Carry-forward into the epic

1. Engine seam contracts validated in miniature → stories sized against proven shapes (uniqueness solver is its own testable unit).
2. Checkpoint semantics (diagnostic-only) locked.
3. Hint-cap scoring rule locked with tests.
4. Ruler/countability generation rule added to generator requirements.
5. Builder prompts handed off; owner-run Builder iteration recorded here when done.


