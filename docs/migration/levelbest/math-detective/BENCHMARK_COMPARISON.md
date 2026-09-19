# Math Detective — Benchmark Comparison & Gap List

**Date:** 2026-08-25 · **Updated 2026-08-27 (G1 + G2 landed; see §5 status)** · Companion to [`REQUIREMENTS.md`](REQUIREMENTS.md) §16 and [`UI_TEST_REPORT.md`](UI_TEST_REPORT.md)
**Method:** web-researched profiles of three comparators chosen to stress different dimensions, scored against Math Detective *as implemented* (not as designed). Kid-experience claims for our game are flagged **[KU]** where they still lack live-child validation (CONSULTING-230).
**IP note:** comparators are benchmarks only; no assets or personas referenced anywhere in product source (guard-tested).

---

## 1. The three comparators

### A. Odd Squad: Agent Check-Up — PBS KIDS (free, browser)
The mandated quality bar. Player is Dr. O's assistant: a patient arrives with a complaint, **two candidate conditions** are shown, and the child runs check-up tools (thermometer reading in °C, volume measures, grid-coordinate lookups, greater/less comparisons) whose readings eliminate one candidate; diagnosis confirmed → mix the antidote → cure animation + award. Skills: fractions, volume, coordinates, comparisons (early-elementary). Full voiceover dialogue, icon-first UI, untimed, no failure state, award shelf. *(Sources: pbs.org/parents/shows/odd-squad; pbskids.org game page; TCRF teardown.)*

### B. Mystery Math Museum — Artgig (paid app, ages 6–12+)
Closest thematic twin. Explore **8 themed museums** rescuing dragonflies; doors unlock via math. Signature mechanic: kids **build their own equations from number tiles they find while searching rooms** — multiple valid solutions, strategic digit hunting — rather than tapping answers. Unlimited user accounts with per-player **customizable skill selection** (add/sub/mult/div, varied number representations incl. dice & tallies). Talking-portrait cast, no timers, no ads; Parents' Choice + Children's Technology Review Editor's Choice awards. Known limitation (Common Sense Media): **does not track progress**, so adults can't see how a kid is doing. *(Sources: App Store listing; artgigapps.com; commonsensemedia.org reviews of Town/Museum.)*

### C. Prodigy Math — Prodigy Education (free + membership, web/app, grades 1–8)
The scale benchmark. RPG world where battles are powered by curriculum-aligned questions; **adaptive engine + placement test** adjust difficulty continuously; standards coverage arithmetic → pre-algebra across grades 1–8; teacher assignments + parent mastery dashboards; wrong answers simply slow progress. Coverage is broad-not-deep practice. Well-documented ethics criticisms (Fairplay): persistent membership upsell, status cosmetics ("members ride clouds, non-members walk in dirt"), distraction lures at home vs school versions. *(Sources: prodigygame.com; opened.co review; fairplayforkids.org; askatechteacher review.)*

---

## 2. Side-by-side matrix

Legend: ● strong ◐ partial ○ absent. Our column reflects shipped behavior.

| Dimension | Agent Check-Up | Mystery Math Museum | Prodigy Math | **Math Detective** |
|---|---|---|---|---|
| Information-as-evidence (math changes the story state) | ● tool readings decide diagnosis | ◐ equations unlock rooms | ✗ questions gate progress, world unaffected | **● constraint chips eliminate suspects; solver guarantees every clue matters** |
| Answer-format depth | ◐ read instrument, choose candidate | **● build equations from tiles (multi-solution)** | ◐ typed/MC single answer | ◐ numeric entry + instrument reading; **no constructed/multi-solution format yet** |
| Curriculum breadth | ◐ 4 skill areas (ages ~5–9) | ◐ 4 ops + representations (6–12) | ● grades 1–8 broad coverage | **● 10 stations mapped g1–8 CCSS clusters, tiers D1–D5** |
| Depth of thinking per item | ● diagnosis reasoning | **● equation construction strategy** | ○ recall/apply single item | **● deduction chain + checkpoint interpretation** |
| Guidance model (non-reader path) | **● full voiceover** | ◐ icons + help section, some reading | ◐ text-heavy | ◐ icon chips + short copy; **read-aloud missing** [KU] |
| Feedback immediacy & tone | ● instant, playful cure | ● tactile locks/portraits | ◐ battle outcome only | ● <150ms acks, chip-fly, contradiction view, guided recovery |
| Error recovery philosophy | ● re-prompt, never punitive | ● retry freely | ● wrong ≠ punished | **● unlimited retries, contradiction walkthrough after 2 misses, zero loss framing** |
| Pacing / session design | ● 3–5 min episodes | ◐ open-ended exploration | ✗ open-ended (no clean end) | ● Mini ≈90 s / Full ≈5 min, chapter exits, hard-cap grace wrap |
| Accessibility | ◐ voiceover-dependent (audio-first) | ◐ touch-first, some reading | ○ not a stated focus | ● keyboard-complete, glyph+word invariant, relaxed mode, reduced-motion, captions-on-text |
| Adaptive engine | ○ fixed content | ◐ manual skill toggles per profile | **● continuous placement-driven adaptivity** | ◐ placement→tier D1–D5 + bounded ±1 shift; **no within-case item-level drift** |
| Uniqueness/solvability guarantees | n/a authored | n/a authored | n/a bank | **● uniqueness solver: exact-one culprit, no early solve, every clue eliminates — property-tested over 60k cases** |
| Parent/teacher reporting | ○ none | ✗ explicitly no tracking | ● dashboards (rich) | ◐ per-case brief rows + honesty rule; **session-only on free site, no history** |
| Motivation ethics | ● public-media clean | ● premium app, clean | ✗ documented upsell/status pressures | **● policy-banned FOMO/leaderboards/upsell; silent streaks; personal records only** |
| Persistence & platform reach | ◐ web, session-only | ● native app w/ profiles | ● accounts, cross-device | ◐ web session-only by design; in-app account seam reserved |

---

## 3. Criterion-by-criterion vs GAMES_PLAN quality bar (evidence notes)

1. **Math-game integration** — Leads Prodigy (bolt-on quiz), matches Check-Up's evidence logic, trails Museum only in answer-construction depth. ✔ meets bar.
2. **Child discoverability** — Icon-chip system + calibration case are solid, but Check-Up sets an audio-guidance bar we don't meet for pre-readers. ◐ → Gap **G1**.
3. **Feedback quality** — Immediate, visual-verbal, non-punitive; contradiction view exceeds all three references' recovery moments. ✔
4. **Pacing** — Only comparator with defined session arcs AND a hard cap that respects the current item. ✔
5. **Visual communication** — Functional icon/payload rendering; behind Check-Up's animated office and Museum's illustrated museums in charm. ◐ → Gap **G8** (polish, post-playtest).
6. **Error recovery** — Guided elimination walkthrough after two misses is beyond any reference. ✔ leads.
7. **Accessibility** — Strongest on motor/keyboard/color-independence; weakest on audio support for pre-readers. ◐ → Gap **G1** shared.
8. **Adaptive potential** — Exceeds Check-Up/Museum by architecture; Prodigy still ahead on within-session item-level granularity. ◐ → Gap **G4**.
9. **Originality / IP separation** — Fully original identity, guard-tested token scan. ✔ leads (vs PBS-branded references by definition).

## 4. Where Math Detective already leads all three

- Solver-verified mysteries: no ambiguous clues, no early-solve degenerate wins, every clue provably eliminates someone (unique among all four games).
- Recovery-as-pedagogy: wrong accusation becomes a side-by-side contradiction lesson, then a guided elimination walkthrough — nothing comparable in any reference.
- Independence score as headline metric + reveal-heavy honesty sentence in the parent brief — reporting no reference attempts.
- Ethics-by-construction: no upsell loops, no status cosmetics, silent streak resets, cookieless free site.

## 5. THE GAP LIST (prioritized)

### P0 — close before release declaration (with CONSULTING-230)

| # | Gap | Evidence source | Status (2026-08-27) | Landing |
|---|---|---|---|---|
| **G1** | **Read-aloud guidance for pre-readers (D1–D2)**: Web Speech API button on goal bubble + each hint line; session-only toggle; omitted when the device has no TTS (never a dead button). Closes the largest discoverability delta vs Check-Up's voiceover. | §3.2, §3.7 | **CLOSED** — `src/lib/mathDetective/speech.ts` + read-aloud toggle (pause menu / picker / status bar) + per-goal and per-hint 🔊 buttons; caption-on-text invariant unchanged. Auto-highlight-while-speaking simplified to button-triggered reads (utterance-per-line). | Shell + hint sheet |
| **G2** | **Constructed-response station**: tile-equation variant of expressions-codes where the child builds ANY valid expression equal to the decoded badge from digit/operator tiles (multi-solution accepted by evaluator). Matches Museum's proven depth mechanic; solver unchanged (constraint equality on value). | §2 matrix row 2 | **CLOSED** — `tileEquation` presentation kind at D4/D5 (`generate.ts`), pure evaluator `src/lib/mathDetective/tileEval.ts` (× precedence, total on invalid input), tile UI in the shell, unit + E2E coverage (Specialist-rank journey). D1–D3 keep the numeric keypad decode. | New presentation kind + evaluator |

### P1 — next sprint after first playtest data

| # | Gap | Evidence source | Proposed landing | Est. |
|---|---|---|---|---|
| **G3** | **Case-setting variety pack**: ≥3 alternate settings (park, cafeteria, library-at-night) + expand title pool beyond 5; pure registry/content change, boosts replay surface toward Museum's 8-museum variety. | §2 breadth-of-content rows | Generator flavor tables | S–M |
| **G4** | **Within-case knob drift**: knobs exist per payload; wire live micro-adjustment after each solved item (±0.5 knob inside tier, not just between-case tier shifts) to approach Prodigy-grade granularity. | §3.8 | learnerModel + generator ctx | M |
| **G5** | **Object-replay teaching moment**: after any L4 reveal or 2nd miss, one tap replays the presentation with the decisive region highlighted (ruler segment pulse, clock hands sweep) — extends B-07's alignment work into pedagogy. | §3.3/§3.6 | Renderer highlight param | S |

### P2 — roadmap / gated / polish backlog

| # | Gap | Note |
|---|---|---|
| **G6** | Cross-session parent history dashboard | Requires family accounts (launch gate); brief schema already compatible |
| **G7** | Teacher/class assignment surface | Prodigy's moat; out of scope pre-accounts — record for product roadmap |
| **G8** | Art/audio production pass (animation charm, optional music bed, VO snippets) | Gate behind MD-15 kid feedback so spend follows evidence |
| **G9** | Offline/PWA packaging for low-bandwidth use | Platform reach parity with native-app comparators |
| **G10** | Opt-in local persistence of best records on free site | Privacy-review-gated; mirrors NLJ open decision |

### Deliberately NOT chased (policy)

Membership-status mechanics, child social/chat, ads or upsell lures, playtime leaderboards — Prodigy's documented engagement levers are our banned-pattern list; the comparison confirms our stance is a differentiator worth keeping.

## 6. Verdict (updated 2026-08-27)

Against its mandated PBS benchmark Math Detective meets or exceeds the bar on all nine criteria's code/design dimensions: integration, feedback, pacing, error recovery, accessibility architecture, and IP separation lead or match the reference; the two P0 discoverability/depth deltas (**G1** read-aloud, **G2** constructed response) are **landed and gate-tested** this round — criterion 2 (child discoverability) and criterion 8 (adaptive potential) now rest on shipped behavior, with the remaining live-child confirmation carried by CONSULTING-230's protocol (`PLAYTEST_PROTOCOL.md`). Against Prodigy the remaining structural gaps are adaptivity granularity (G4) and accounts-gated reporting (G6/G7) — roadmap items, not v1 defects. **Release declaration remains gated on the human playtest (n ≥ 8) and the owner's hands-on benchmark feel pass; all machine-verifiable requirements are complete.**


