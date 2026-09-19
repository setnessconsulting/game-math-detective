# Math Detective — Requirements (PRD + Architecture + Red-Team Synthesis)

**Status:** Requirements locked 2026-08-25 (Phase 1 of the games pipeline; see `GAMES_PLAN.md`)
**Game slug:** `math-detective` · **Epic working title:** "Math Detective — contextual reasoning and evidence engine"
**Comparison quality bar:** Odd Squad: Agent Check-Up (PBS KIDS) — mechanics-level benchmark only. No PBS names, characters, art, audio, writing, or assets are used. See §16.
**Sibling docs:** [`UX_DESIGN.md`](UX_DESIGN.md) · [`PROTOTYPE_NOTES.md`](PROTOTYPE_NOTES.md) · [`EPIC_PLAN.md`](EPIC_PLAN.md) · [`SPRINT_READINESS.md`](SPRINT_READINESS.md)

---

## 0. Document control

| Item | Value |
|---|---|
| Pipeline | PM brief → architecture → adversarial/red-team pass → synthesis → QA review (all roles executed in this run; findings logged in §14) |
| Sources read | `docs/GAMES_PLAN.md`, `docs/NUMBER_LINE_JUMPER.md`, `src/lib/assessment/*`, `src/lib/numberLineJumper/*`, `src/lib/games/*`, `src/app/games/GamesHub.tsx`, `tests/*`, root `README.md` |
| Hard policy inputs | GAMES_PLAN design principles (non-negotiable), hook mechanics policy (banned patterns), cross-game reference quality bar (9 criteria) |
| Prototype evidence | Playable HTML core-loop prototype + Builder prompts recorded in `PROTOTYPE_NOTES.md`; no production `src/` modified by this run |

---

## 1. Product goal

Give grades 1–8 players a narrative reason to do math: each session is a **case** whose clues are math problems, so solving the mystery *requires* the target skills. Math Detective is LevelBest's signature AI-native game: the case generator assembles mysteries around the learner's active skill targets, and a deterministic hint ladder (with an LLM-partner seam reserved for later) intervenes on the learner's actual misconception instead of revealing answers.

It serves both product jobs from GAMES_PLAN:

1. **Free-site magnet** — a story-driven game that feels categorically different from the seven shipped games; shareable "I cracked the case" moments without any account.
2. **In-app earned break** — a bounded ~90 s "Mini Case" that unlocks after a lesson block and returns the child to practice cleanly.

Success means: a Grade-2 child and a Grade-7 child both reach the accusation screen having genuinely done grade-appropriate math, in under five minutes, with zero adult coaching.

## 2. Player personas by grade band

| Persona | Band | Reading level / motor profile | What the game must do for them |
|---|---|---|---|
| **Maya, 6** (Grade 1–2) | D1–D2 | Emerging reader; taps; counts reliably to 20–100 | ≤ 12-word clue sentences, icon-labeled suspects, audio-caption support, numeric keypad input, 3 suspects, constraints phrased as pictures+words |
| **Dev, 9** (Grade 3–4) | D2–D3 | Fluent reader; confident tablet user | Fractions/measurement/multiplication clues; 4 suspects; first taste of the deduction board with light scaffolding |
| **Lena, 11** (Grade 5–6) | D4 | Skilled; enjoys deduction media (mysteries, logic puzzles) | Decimals/ratios/graphs/expressions clues; 5 suspects; multi-step evidence; independence scoring becomes motivating |
| **Marcus, 13** (Grade 7–8) | D5 | Skilled; low tolerance for "baby" framing | Equations/functions/statistics/probability clues; dry-witty case writing tone scales up; 5–6 suspects; optional harder "cold case" variant |

Cross-cutting: all personas include kids who play on a shared phone in landscape, kids using keyboards only, kids with reduced-motion needs, color-vision deficiency (~8% of boys), and kids who cannot read aloud instructions to an adult because no adult is next to them.

## 3. Curriculum skill map — Common Core-aligned grades 1→8

The game's ten **evidence stations** map onto CCSS clusters. The registry below is the single source of truth consumed by problem generation (§13). Codes are alignment targets, not verbatim standard text; bank content is validated against the written cluster intent.

| Skill ID | Station (evidence type) | Grades | CCSS alignment targets | Example evidence → constraint |
|---|---|---|---|---|
| `measure-length` | Measure Station (ruler/scale reading) | 1–5 | 1.MD.A.2, 2.MD.A.1–3, 3.MD.B.4, 4.MD.A.1 | Shelf height 120 cm; ruler card shows suspect height marks → culprit height ≥ 120 cm |
| `time-elapsed` | Time Station (clock cards) | 2–5 | 2.MD.C.7, 3.MD.A.1, 4.MD.A.2 | Alibi card: left at 3:15, arrived 3:50 → 35 min away → can't have been at the gym at 3:40 |
| `data-tables` | Table Station (who-did-what table) | 1–6 | 1.MD.C.4, 2.MD.D.10, 3.MD.B.3, 5.MD.B.2 | Sign-in table row/column lookup → suspect B checked out 2 helmets, not 3 |
| `money-receipts` | Money Station (receipts/prices) | 2–6 | 2.MD.C.8, 4.MD.A.2, 5.NBT.B.7, 6.RP.A.3c | Receipt totals + wallet amounts → only two suspects could afford 3 × $1.25 |
| `fractions-parts` | Fraction Station (partitioned objects/cups) | 3–5 | 3.NF.A.1–3, 4.NF.A.1–2, 4.NF.B.3, 5.NF.A.1 | Pizza photo: ⅝ eaten; box held 8 slices → 3 remain → constraint on "took some home" claim |
| `ratio-proportion` | Ratio/Recipe Station | 6–7 | 6.RP.A.1–3, 7.RP.A.2 | Punch recipe scales ×4 → sugar needed 6 cups, jar had 4 → alibi breaks |
| `grid-coordinates` | Map Station (coordinate grid) | 5–6 (+1–2 icon-grid pre-form) | 5.G.A.1–2, 6.NS.C.6, 6.G.A.3 | Witness saw the figure at (B,4); grid overlay eliminates suspects whose route never passes it |
| `expressions-codes` | Code Station (decode via expression) | 3–8 | 3.OA.C.7, 4.OA.A.3, 6.EE.A.1–2, 7.EE.B.4, 8.F.A | Locker code = 7 × 6 − 8 → decodes note naming locker 34 → narrows location claim |
| `stats-summary` | Data Station (mean/median/outliers) | 6–8 | 6.SP.A.2–3, 6.SP.B.5, 8.SP.A.1 | Step-counter list; median vs one wild outlier → whose data was faked |
| `probability-claims` | Probability Station (likelihood audit) | 7–8 | 7.SP.C.5, 7.SP.C.7–8 | Claim "dice rolled six 6s in a row, promise!" → probability check flags implausible alibi |

Supporting fluency substrate (embedded inside station arithmetic, not separate stations): add/sub within 20 and 100 (2.OA.B.2, 2.NBT.B.5), mult/div facts (3.OA.C.7), place value (NBT), decimals (4.NF.C.5–7, 5.NBT.A).

**Coverage statement (for epic):** v1 ships all ten stations across D1–D5 with per-tier knob tables; every band D1–D5 has ≥ 4 stations available so cases vary. Stations not yet reachable at a tier are excluded by the registry, not hidden behind errors.

### Difficulty tiers

Placement signal (`PlacementResult.band {grade, third}` from `src/lib/assessment`) maps deterministically:

| Tier | Placement band | Suspects | Clues/case (full) | Typical numbers |
|---|---|---|---|---|
| D1 | g1 early–mid | 3 | Mini 2 · Full 4 | within 20; whole units; icon grids |
| D2 | g1 late – g2 mid | 3–4 | Mini 2 · Full 4–5 | within 100; time to 5 min; whole money |
| D3 | g2 late – g4 mid | 4 | Mini 3 · Full 5 | facts ×10, simple fractions, cm/m |
| D4 | g4 late – g6 mid | 5 | Mini 3 · Full 5–6 | decimals, ratios setup, coordinates |
| D5 | g6 late – g8 late | 5–6 | Mini 3 · Full 6 | negatives, equations, statistics, probability |

Free-site manual picker shows tiers ("Detective ranks": Cadet → Junior → Agent → Specialist → Inspector) with an auto-suggested rank when placement data exists (in-app). Manual override always allowed (never trap a child at wrong difficulty).

## 4. Core loop

```
Case Briefing (whodunit frame, suspect lineup)
   ↓
[Evidence Station] → solve math item(s) → evidence card earned
   ↓                      ↘ stuck? Hint ladder L1–L4 (§8)
repeat until chapter complete (2–3 stations)
   ↓
Checkpoint (30 s): "Who is still in the running?" — mark survivors
   ↓
Deduction Board: link evidence cards ↔ suspect attributes
   ↓
Accusation → verdict scene
   ↓                      ↘ wrong? contradiction spotlighted, re-accuse (max 2)
Case Closed summary: skills practiced, independence score, coaching line
```

One mechanic family only (evidence→constraint→deduction). No physics, no collection meta-economy, no side quests. Every piece of information in a case is either evidence, a suspect attribute, or a constraint derived from them — nothing decorative competes with the math.

**Narrative purpose test (vs comparison game):** information must function as *evidence the learner interprets*, not as disconnected questions between scenes. Acceptance: every math item, when solved, changes exactly one fact on the deduction board. If removing the deduction board leaves the items feeling like a quiz, the case fails review.

## 5. Mechanics detail

### 5.1 Case anatomy
- **Suspects:** 3–6 original characters (name + 3 attribute chips: e.g., height bucket, pet, after-school spot, shoe size, favorite snack). Attributes are chosen from the intersection of what the tier's stations can constrain.
- **Evidence items:** 1 math item each (occasionally 2 sub-steps at D4/D5), producing a constraint sentence added to the **case file**: "✔ The culprit is taller than 120 cm."
- **Uniqueness guarantee:** generator builds suspect set + culprit + ordered constraints such that (a) the full constraint set matches **exactly one** suspect, verified by solver; (b) every strict prefix of clues leaves ≥ 2 candidates (so no single clue ends the case early); (c) each clue eliminates ≥ 1 currently-live suspect (so no filler clues). Solver failure → regenerate (retry budget 20) → fall back to hand-authored seed case for that tier.
- **Chapters:** full case = 3 chapters (evidence → checkpoint), mini case = single chapter. Chapter boundaries are clean exit points.

### 5.2 Evidence interaction formats (beyond multiple choice)
Numeric keypad entry (kid-safe keypad, no keyboard dependency), visual choice among 3–4 rendered options (ruler photos, clock faces, chart segments), drag-to-order timelines, tap-to-match pairs, slider measurement. At least one non-choice format per case at D2+.

### 5.3 Checkpoints
After each chapter, a 15–30 s survivor-marking step ("tap everyone who could still be our culprit"). Purpose: force interpretation, expose misconception early (marking a suspect eliminated by an earlier clue triggers gentle board review, not scolding). Checkpoint performance feeds the learner model but never blocks progress.

### 5.4 Deduction & accusation
Board shows suspects × earned-constraints matrix. Accusation requires selecting a suspect **and** tapping the 2+ constraint chips that rule out others (D1–D2 auto-links constraints; D3+ requires ≥ 2 links; links are scaffolded with hover/tap explainers). This makes guessing accusations expensive and reasoning cheap.

### 5.5 Controls
Touch-first: tap, drag, slide. Keyboard parity: tab order follows visual flow; arrows move board cursor; Enter selects/links; Esc opens pause/settings; visible focus ring everywhere. No hover-only affordances; drag has tap-tap-tap alternative (select source → select target). Minimum target 48×48 px touch / 44×44 CSS px floor everywhere.

## 6. Scoring, streaks, bonuses (honest hooks only)

- **Evidence points:** first-try correct = 10; retry correct = 6; later = 3. Any hint caps that item at 6 (L1–L2) or 3 (L3–L4). Speed never scores — untimed thinking is the product stance.
- **Independence score (0–100):** share of evidence points earned hint-free at first try; this is the headline personal metric, not raw points.
- **Case badges:** "Cracked It" (first accusation correct), "Sharp Eye" (zero hints whole case), "Fair Play" (used hints and still finished — explicitly framed as normal detective work).
- **Streak behavior:** within-case consecutive first-try-no-hint solves build a "sharp streak" chip; it resets silently on hint use (no animation of loss, no copy referencing loss). Cross-session streaks are day-based consistency streaks owned by the app shell, not this game; the game adds nothing punitive for missed days (policy compliance).
- **Beat-your-best records:** best independence score and cases-cracked count per tier, kept session-only on free site, per-account in-app. Personal records only; **no leaderboards between children** (banned).
- **Zero-sum guardrail:** wrong accusations cost nothing; there is no way to lose points, lives, or progress anywhere in the game.

## 7. Session shape & earned-break integration

| Mode | Structure | Target length | Hard cap |
|---|---|---|---|
| **Mini Case** (earned-break mode; free-site quick mode) | briefing → 2 evidence stations → checkpoint-lite → accuse | ~90 s | 150 s auto-wrap to summary |
| **Full Case** (free-site default) | 3 chapters × (2–3 stations + checkpoint) → board → accuse | ~5 min | 10 min soft wrap cue, then auto-summary |

Earned-break integration (Tier 1 contract):
1. Lesson block completes → break offer appears with Mini Case as one option.
2. Break window opens (~90 s): game runs; a **calm return countdown** is visible in the shell (game UI stays timer-free; the countdown belongs to the app shell, styled as neutral, never red/pulsing).
3. At window end the current item completes gracefully → verdict-or-summary screen → automatic return to practice with a completion tick. Nothing is lost, nothing is framed as interruption.
4. If the child is mid-evidence at window end: finish that item, then wrap. Never cuts mid-item.

Free site: hard stop at cap with clean exit back to `/games` hub; no "keep playing" nag beyond a single neutral "Play another case" button on the summary.

## 8. Failure & error recovery

- **Wrong evidence answer:** inline feedback states what the evidence actually shows ("The clock reads 3:50, not 3:15") → retry same item, unlimited, points taper per §6. After 2 misses the hint ladder auto-offers L1 (declinable).
- **Hint ladder (deterministic v1):**
  - L1 *Orient* — restates what the item asks in fewer words / highlights the relevant object.
  - L2 *Strategy* — names the move ("Find how many minutes passed between the two clocks").
  - L3 *Micro-example* — works a parallel example with different numbers, then returns the child to their own item.
  - L4 *Reveal-with-reasoning* — shows the answer **and** the reasoning chain; item scores 3; board still gets the constraint.
  - Ladder is strictly request-or-offer based; L3/L4 require explicit tap. Each level logs to telemetry with misconception tag.
- **Wrong accusation:** verdict scene shows the accused suspect's card next to the contradicting evidence card, side by side, and says why it can't be them. Second accusation allowed immediately. Second miss → guided resolution walkthrough (board animates elimination order, child taps Next through the logic), case still completes, badge omitted. Copy never shames ("Real detectives follow the evidence — let's re-read it together").
- **Abandonment:** exiting mid-case returns to hub with a neutral state (no guilt copy). In-app: session-only resume within the same browser session where supported.
- **Item bug/generation failure:** fallback seed cases per tier ship in the bundle; a generation failure swaps silently and logs a telemetry error event.

## 9. Edge cases

1. RNG degeneracy: duplicate display values, empty candidate sets after a constraint, fraction formats not in simplest form — generator unit tests assert none occur over 10k seeds per tier.
2. Solver retry exhaustion → deterministic fallback case (hand-authored, still tier-valid).
3. Tab visibility: timers pause (there are no pressure timers anyway); audio stops; state intact on return.
4. Orientation/resize: evidence card layouts reflow to portrait phone ≤ 360 px wide without horizontal scroll; board switches to stacked card layout < 700 px.
5. Zoom 200% and OS font scaling: no clipped controls; text wraps, never truncates meaning-bearing strings.
6. Screen readers: board is an ARIA grid with per-cell summaries; live region announces constraint earn + feedback lines; all charts have data-table equivalents (§ UX doc).
7. Color-independence: every state carries icon + text label; patterns distinguish chart series; constraint chips show ✓/✕ glyphs plus wording.
8. Reduced motion: reveal animations become fades ≤ 120 ms; no parallax/confetti.
9. Audio off by default; captions always present for any narrated line; SFX optional toggle persisted per session.
10. Storage guard: free site writes nothing outside session memory (extends existing `tests/storage-guard.test.ts` contract to new keys).
11. Double-tap/double-submit on accusation: idempotent handlers.
12. Clock/timezone irrelevant (no real-time dependence).
13. Very fast answering (< 1.5 s repeated) flagged as probable mashing → learner model drops difficulty one notch and inserts an L2 strategy prompt; no accusatory copy.

## 10. Analytics & telemetry

Cookieless, session-only on free site (page-view analytics only, matching repo posture). In-app events feed mastery + parent brief. Event schema (names versioned `mdetect.*`):

| Event | Payload |
|---|---|
| `mdetect.case_started` | tier, mode, caseId(seed-derived), stationIds[], suspectCount |
| `mdetect.evidence_presented` | itemId, skillId, format, difficultyKnob |
| `mdetect.evidence_answered` | itemId, correct, attemptCount, hintsUsed[], latencyBucket(ms: <5s/5-15s/15-45s/>45s), misconceptionTag? |
| `mdetect.hint_shown` | itemId, level, source(user/auto-offer) |
| `mdetect.checkpoint_marked` | chapter, markedSurvivors, trueSurvivors |
| `mdetect.accusation_made` | attemptIndex, accusedCorrect, linksSelected |
| `mdetect.case_completed` | outcome(closed/guided/abandoned-at-cap), independenceScore, minutesSpentBucket, skills[] |
| `mdetect.error` | context, code (generation-failure, fallback-used) |

Privacy rules: no PII, no free-text, no cross-site identifiers; latency buckets not raw timestamps; event stream dies with the tab on free site.

## 11. Parent-brief itemization

Parent brief keeps its learning-vs-total split; game minutes stay **inside total** and are itemized:

- Per session: `Games — Math Detective: X min (total Y min)`; learning-share gate ≥ 80% enforced at brief level (games inflate only the denominator).
- Per case row: tier/rank, stations played → skills practiced (human labels from `DOMAIN_LABELS`-style registry), evidence attempted/correct, hints by level, accusation attempts, independence score, one coaching sentence generated from the round stats (teaching tone, never shaming — reuse NLJ coaching voice rules).
- Parent-visible honesty rule: if a case was completed mostly via L4 reveals, the brief says so plainly ("Solved with step-by-step reveals — ready for a slightly easier case next time").

## 12. Non-goals (v1)

Multiplayer/class duels; cosmetic economies; paid game-only content; playtime leaderboards; character illustration pipelines (text+icon cast only); voice-required gameplay; LLM network calls on the free site; accounts/storage on free site; a second mechanic layered on deduction; recreating any PBS asset or persona; daily-challenge rotation (stays with Tier 2 plan item).

## 13. Architecture

### 13.1 Principle
One polished shell, four replaceable seams. The engine knows deduction flow, scoring, accessibility, telemetry emission — it never contains a math fact, a case string, or a mastery rule. This is the shared architectural goal stated in GAMES_PLAN for all five backlog games, and Math Detective is the reference implementation of the seams.

### 13.2 Module layout (target)

```
src/lib/games/shared/
  rng.ts            // mulberry32 moved/kept here; NLJ re-exports (no dup)
  session.ts        // SessionClock, cap enforcement, visibility pause
  telemetry.ts      // emit(event) port + cookieless sink + parent-brief reducer
  learnerModel.ts   // LearnerSignal types, adjustDifficulty()
  hintLadder.ts     // HintRequest → HintResponse ladder contract + deterministic impl
src/lib/mathDetective/
  types.ts          // Case, Suspect, Constraint, EvidenceItem, payloads
  skills.ts         // SKILL_REGISTRY (skill defs + knobs + misconception tags)
  generator/        // per-station generators + case assembler + uniqueness solver
  engine.ts         // pure state machine: briefing→station→checkpoint→board→verdict
  coach.ts          // end-of-case coaching line selection
src/app/games/MathDetective.tsx  // React shell consuming engine (demo-panel pattern)
tests/mathDetective/*.test.ts    // Vitest, mirrors numberLineJumper.test.ts style
```

### 13.3 Seam contracts (TypeScript sketches — normative)

```ts
// ---- Seam 1: Skill definition (skills.ts) -------------------------------
export interface SkillDef {
  id: SkillId;                       // 'money-receipts' | ...
  domain: Domain;                    // reused from assessment/types.ts
  tiers: TierRange;                  // which D1–D5 rows include this station
  ccss: string[];                    // alignment targets, e.g. ["2.MD.C.8"]
  knobs: Record<DifficultyTier, KnobSet>;  // numeric ranges/format options per tier
  misconceptions: Record<string, MisconceptionTag>; // id → tag driving hint text
}

// ---- Seam 2: Problem generation -----------------------------------------
export interface GenerateArgs { tier: DifficultyTier; knob: KnobSet;
  rng: () => number; targetSkill?: SkillId; avoidSeeds?: string[]; }
export interface GeneratedEvidence {           // pure payload, renderable anywhere
  id: string; skillId: SkillId;
  presentation: PresentationPayload;  // discriminated union: RulerCard | ClockPair |
                                      // DataTable | Receipt | GridMap | FractionBar |
                                      // ExpressionCode | StatList | RecipeScale | ClaimAudit
  answer: AnswerPayload;              // exact value(s)/selection set + equivalence rules
  constraintTemplate: string;         // "culprit.height >= {value}cm"
  misconceptionHints: Record<MisconceptionTag, [string, string, string]>; // L1..L3 text
}
export function generateEvidence(args: GenerateArgs): GeneratedEvidence;

// ---- Seam 3: Engine ------------------------------------------------------
export type DetectivePhase = "briefing"|"evidence"|"checkpoint"|"board"|"accuse"
  |"verdict"|"summary";
export interface EngineState { phase: DetectivePhase; case_: CaseRun;
  score: ScoreState; hintsUsed: HintLog[]; }
export type EngineAction =
  | { t:"submit_answer"; itemId:string; value:AnswerPayload }
  | { t:"request_hint"; itemId:string }
  | { t:"checkpoint_mark"; suspectId:string; alive:boolean }
  | { t:"link_evidence"; constraintId:string; suspectId:string }
  | { t:"accuse"; suspectId:string } | { t:"exit" };
export function reduce(state: EngineState, action: EngineAction):
  { next: EngineState; effects: Effect[] };   // pure; effects = telemetry/audio/announce

// ---- Seam 4: Learner model ----------------------------------------------
export interface LearnerSignal {                 // built from placement + in-session
  placementBand: { grade:number; third:Third } | null;  // assessment/types.ts
  recentAccuracyBySkill: Partial<Record<SkillId, { ok:number; n:number }>>;
  hintRate: number; mashFlags: number;
}
export function initialTier(s: LearnerSignal): DifficultyTier;     // §3 mapping
export function adjustTier(tier: DifficultyTier, s: LearnerSignal,
  last: EvidenceOutcome[]): { tier: DifficultyTier; reason: string };

// ---- Seam 5: AI-tutor intervention --------------------------------------
export interface HintRequest { itemId:string; level:1|2|3|4;
  misconceptionTag?:MisconceptionTag; priorAttempts:number; }
export interface HintResponse { level:1|2|3|4; text:string;
  source:"rule"|"llm"; }                     // llm adapter reserved; free site = rule
export function getHint(req:HintRequest, ev:GeneratedEvidence): HintResponse;
```

Rules binding the seams:
- Generator output is **pure data** (mirrors NLJ `Target`). Rendering, scoring, and hints consume payloads only — new stations never require engine edits.
- Determinism: same seed + tier + learner signal ⇒ identical case (Vitest golden fixtures, mirroring NLJ determinism tests).
- The uniqueness solver is part of generation, exported and separately unit-tested.
- Telemetry and hint sources are injected ports; free site binds the cookieless/no-network implementations; future in-app binds account-backed ones without engine changes.
- Reused primitives: `mulberry32` PRNG algorithm, `TrialRecord/RoundSummary`-style aggregate pattern for summaries, band labels approach (`BAND_META` analog `TIER_META`), storage-guard test pattern, GamesHub card + `GameReference` component conventions.

## 14. Adversarial pass — findings and resolutions (synthesis complete)

| # | Attack | Severity | Resolution (folded into spec above) |
|---|---|---|---|
| A1 | Brute-force accusation guessing (small suspect pools make random accusing viable) | Major | §5.4: accusation requires ≥ 2 evidence-link selections (D3+); links are scored; wrong accusations trigger contradiction walkthrough that teaches; guessing twice yields *lower* reward than solving one clue honestly. Residual risk accepted for D1–D2 (auto-linked) since stakes are zero and pedagogy targets orientation, not testing. |
| A2 | Multiple-choice mashing on evidence items | Major | §5.2: ≥ 1 non-choice format per case at D2+; §9.13 mash detector reduces difficulty and inserts strategy prompt; attempt taper removes reward from mashing. |
| A3 | Degenerate generated cases: ambiguous evidence, zero-survivor prefixes, or clue that uniquely identifies culprit too early | Major | §5.1 uniqueness solver checks all three properties; retry budget + deterministic fallback case; 10k-seed property tests required before merge. |
| A4 | FOMO/loss aversion creeping in via streaks or timers | Policy-critical | §6: silent streak reset, no loss animations/copy; §7: no in-game timers at all; return countdown owned by app shell, neutral styling mandated; banned-pattern checklist added to QA gate (§17). |
| A5 | Leaderboards/social comparison drift | Policy-critical | §6: personal records only; brief language bans any "compared to other detectives" phrasing in copy review. |
| A6 | Reading burden locks out Maya (Grade 1–2 persona) | Major | UX doc §onboarding + caption rules: ≤ 12-word sentences at D1–D2, icon-labeled attributes, audio captions; kid-discoverability test protocol requires adult-free first-run success. |
| A7 | Color-only signaling on charts/board | Accessibility-critical | §9.7 + UX doc: glyph+label invariant, patterned series; axe + manual de-colorization check (grayscale screenshot review) in DoD. |
| A8 | Hint ladder becomes answer vending machine (L4 spam to speed-run) | Minor | §8: L4 requires confirmation tap, caps item at 3 pts, lowers independence score visibly; learner model routes subsequent items easier + L2 pre-teach. Honest, not punitive. |
| A9 | IP leakage: medical/virus theme or Odd Squad characters/names imported via "detective" trope | IP-critical | §16: original agency theme, original cast, original case names; banned-token list in QA gate ("Odd Squad", character names, virus names, "Dr. O"); theme/SFX directions documented independently in PROTOTYPE_NOTES. |
| A10 | Earned-break window expires mid-item causing frustration or cheating the return | Major | §7 rule 4: finish-current-item grace, then wrap; countdown never interrupts input; covered by shell-level integration test scenario. |
| A11 | Free-site privacy regression (events leaking identifiers) | Privacy-critical | §10 payload allowlist; storage-guard extension; brief/export contents constrained to aggregate fields (mirrors CONSULTING-182 amendment precedent). |
| A12 | Difficulty whiplash when placement missing (first-run free-site visitors) | Minor | Default tier D2 + first-case calibration chapter (one easy item per station kind); manual rank picker always visible. |
| A13 | Solver O(2^n) blowup on large suspect sets freezing low-end phones | Minor | Suspect count ≤ 6; solver prunes by constraint propagation; generation happens once per case with 20-retry budget; worst-case falls back synchronously. |
| A14 | Audio autoplays in classrooms | Minor | Audio off by default; toggle persists per session; captions mandatory regardless. |

All fourteen findings are resolved in this document; none remains open.

## 15. Success signals (per GAMES_PLAN)

Product-level: returning visitors; `/games` → waitlist conversion; session-completion rate holds or rises with breaks enabled; parent-brief learning share ≥ 80%; voluntary next-day return.
Game-level (instrumented via §10): ≥ 60 % of case starts reach verdict; median Mini Case duration 75–110 s; hint-ladder usage concentrated at L1–L2 (≥ 70 %); restart-after-wrong-accusation rate ≥ 80 % (recovery works); zero banned-pattern audit findings; D5 players' evidence accuracy within 65–85 % (flow band) across tiers.

## 16. Comparison-game posture (IP separation)

Benchmark: **Odd Squad: Agent Check-Up** — player assists a doctor diagnosing agent patients: hear symptoms, run check-up tools, compare against two candidate conditions, verify measurements (temperature etc.), mix antidote, cure patient; teaches fractions, volume, coordinates, greater/less comparisons; voiceover-guided. What we take: *information-as-evidence*, tool-mediated data collection, short diagnose→treat cadence, playful non-punitive feedback, varied math representations. What we never take: name, characters, office/hospital setting, virus/ailment lore, art style, audio, scripts, or any asset. Our independent identity: neighborhood **Math Detective Agency**, case-file aesthetic, original suspects and mysteries, text+icon cast, original SFX direction. Legal-token scan gate ships in QA (§17).

## 17. QA review sign-off (pipeline close)

Checklist applied to this document: ✅ product goal tied to both product jobs; ✅ personas cover full grade range + accessibility profiles; ✅ curriculum map spans grades 1–8 with named CCSS clusters and coverage statement; ✅ core loop single-mechanic and evidence-driven; ✅ scoring/streaks comply with hook policy; ✅ session shapes fit 90 s earned-break window with grace rule; ✅ failure flows non-punitive; ✅ edge cases enumerated incl. privacy and a11y; ✅ telemetry schema minimal + cookieless; ✅ parent brief itemization satisfies honesty principle; ✅ architecture separates all four seams with normative payload contracts and reuse list; ✅ adversarial log complete, every finding resolved; ✅ non-goals explicit; ✅ success signals measurable. **QA verdict: PASS — requirements baseline ready for UX design.**


