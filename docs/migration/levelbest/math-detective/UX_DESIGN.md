# Math Detective — UX Design Spec

**Status:** Locked 2026-08-25 · Companion to [`REQUIREMENTS.md`](REQUIREMENTS.md) §references
**Review contract:** project-ux cognitive-load/clarity audit (walk every flow fresh + returning; note hesitations; simplify; report before/after). Findings log: **§14** — all resolved; zero open blockers.

---

## 1. Design principles for this game

1. **The case file is the interface.** Everything the child needs is visible as objects: suspects (cards), evidence (cards), constraints (chips). No instructions paragraphs.
2. **Cause and effect under 150 ms.** Every tap answers immediately — pressed state, sound-off visual tick, and a consequence the child can see move (chip flies to the case file, suspect card dims when eliminated).
3. **Reading is optional at D1–D2.** Icons carry meaning; text is a caption, never the only channel.
4. **Calm by default.** No countdowns in game UI, no red urgency, no loss animations. Pressure is the enemy of thinking.
5. **One decision per screen.** Evidence screen = solve one item. Board = link or accuse. Never both.

## 2. Entry & discovery

- **Hub card** (`/games`, matches GamesHub conventions): title *Math Detective*, blurb "Follow the clues. Solve the math. Crack the case.", tag `Mystery · Grades 1–8`, icon `🔍`. Card sits beside existing games; no modal, zero friction to first play.
- **First-run routing:** tapping Play opens **Case Picker** with two big buttons — *Quick Case* (default-highlighted, "about 2 minutes") and *Full Case* ("about 5 minutes") — plus a rank row (Cadet→Inspector) pre-set to Auto. No account, no tutorial gate: the tutorial *is* the first Quick Case (§3).
- **Returning player:** same picker; if session memory holds an unfinished case, an inline "Continue your case?" row appears above the buttons (session-only; disappears cleanly otherwise).
- **In-app earned-break entry:** break offer card shows Mini Case with neutral countdown owned by the shell; entering is one tap; exiting any time via pause → "Back to practice" (always available, never hidden).

## 3. Onboarding without adult coaching

**Design:** the first Quick Case on every device is the **calibration case** ("The Case of the Missing Muffins") authored to teach by doing:
1. Briefing screen demonstrates the loop in 3 icon-labeled sentences (read-aloud button present).
2. Each of its 2 evidence stations begins with a one-line goal bubble + a pulsing affordance on the single interactive object (pulse suppressed under reduced-motion; replaced by a static arrow glyph).
3. The first item's answer is nearly given (the model), the second requires one real step.
4. Checkpoint-lite shows the mechanic once with 3 suspects.
5. Accusation auto-links constraints; the child only picks the suspect.

**Test protocol (adult-free):** success = a child who has never seen the game completes the calibration case with zero adult input. Method: moderated playtests n ≥ 8 across D1/D3/D5 bands (task exists as follow-up spike; mirrors CONSULTING-158 pattern). Proxy acceptance until live tests run: heuristic expert review by 2 reviewers using the §14 checklist + task-model simulation documented below. **Marked honestly: live-kids validation is a user-only external step, not claimable from this run.**

Task-model walkthrough (documented evidence): each screen lists what a non-reader can do with icons alone; any action requiring text comprehension was redesigned out (see F-03, F-04 in §14).

## 4. Screen-by-screen flows

### S0 · Hub card → Case picker (covered §2)
States: default / hover / focus / pressed on all controls; picker buttons show duration chips ("≈2 min") so expectations are set before commitment.

### S1 · Case briefing
Layout: case title (kid-sized type, ≤ 6 words), one-sentence mystery, suspect lineup (cards with portrait-initial avatar, name, 3 attribute chips), "Start investigating" primary button. Read-aloud toggle top-right (if device TTS enabled; else omitted — never a dead button). Exit (hub) always top-left.
Empty/error: generation fallback swaps silently; if even fallback fails, friendly panel "The chief is writing a new case — try again shortly" + hub button (telemetry `mdetect.error`).

### S2 · Evidence station
Layout zones (portrait phone ≤ 360 px baseline):
```
[goal bubble — 1 line, icon]           [hint button 🛈]
[ presentation payload (ruler/clock/table/map/…) ]
[ answer area: keypad | options | slider | match targets ]
[ Check it ]                            [ progress dots ●●○ ]
```
- Presentation payloads render as physical objects (ruler with marks, two clock faces, table with highlighted active cell after selection).
- Keypad: 0–9, ⌫, fraction keys `/` and mixed-number toggle where tier needs it; large digits; current entry echoed in huge type.
- Feedback zone replaces goal bubble on submit: ✓ states show the earned constraint sentence + chip-fly animation to case-file strip; ✗ states show what the evidence actually shows (never just "wrong").
- Hint ladder button opens sheet (§7). Progress dots show position in chapter only (no timer anywhere).

### S3 · Checkpoint
"Who could still be our culprit?" Suspect cards row; tap toggles ALIVE/ELIMINATED stamp (icon + word + color). "That's my hunch" continues. Marking someone eliminated whose attributes contradict an earned constraint triggers the board to gently flash that constraint chip (review affordance, no penalty).

### S4 · Deduction board
Desktop: matrix grid — suspects as columns, earned constraints as rows; each intersection tappable through three states: blank → "ruled out" ✕ → "matches" ✓. Mobile < 700 px: stacked suspect cards each listing constraints with per-constraint toggle. Accusation bar appears once chapter count satisfied: "Name your culprit".
Constraint chips are the shared vocabulary: identical wording/iconography everywhere they appear (station feedback, case file, board rows).

### S5 · Accusation confirm
Sheet: chosen suspect enlarged, selected links listed as "Because…" lines (auto-filled at D1–D2), Confirm / Keep looking. Confirm is deliberately two-step to prevent double-tap accidents (idempotent anyway per REQUIREMENTS §9.11).

### S6 · Verdict scene
Correct: suspect card gets CASE CLOSED stamp, short 2-line resolution, confetti-equivalent = badge reveal (static-friendly, reduced-motion safe). Wrong: side-by-side contradiction view (accused card vs contradicting evidence), copy per REQUIREMENTS §8, button "Follow the evidence again". Second wrong → guided walkthrough: board animates elimination order, Next-steps through logic, then resolution plays regardless.

### S7 · Summary (end-of-session screen)
Cards mirror NLJ end-screen voice: **Skills practiced** (chips with icons), **Evidence solved** X/Y, **Independence score** (big number + one-line meaning), **Badges**, coaching line (one sentence, teaching tone), personal best delta ("New best independence!") when applicable. Buttons: Play another case (primary), Change rank (secondary), All games. Parent-readable footer line: "Practiced: money math, elapsed time." Free-site footer adds nothing saved note.

### S8 · Pause / settings (from Esc or ⏸ anytime)
Resume · Restart case · Accessibility (text size A/A+, reduce motion, sound on/off, colorblind-safe patterns toggle-default-on) · Back to practice/hub. All settings apply instantly and persist for session.

### Earned-break variant
Same screens; shell overlays calm return strip during last 15 s of window ("Wrapping up soon — finish this clue"); at window end, current item completes → verdict-or-summary with "Back to practice" primary. No other UI differences.

## 5. Interaction states (component contract)

| Component | Default | Hover/Focus | Active | Disabled | Error/Edge |
|---|---|---|---|---|---|
| Primary button | filled, high contrast | focus ring 3px offset | scale .97 | 40% opacity + aria-disabled | n/a |
| Keypad key | outlined | focus ring | filled flash 120 ms | — (never disabled) | long-press ⌫ repeats |
| Option card | border 2px neutral | ring | selected = check glyph + thick border | — | rejected shake ≤ 240 ms (off under reduced motion → fade) |
| Slider (measure) | thumb 44px | ring | value bubble follows | — | min/max clamp visual stop |
| Constraint chip | neutral outline | explainer tooltip (tap) | linked = ✓ glyph | — | contradicted = ✕ glyph + label |
| Suspect card | photo-initial + chips | lift 2px | stamped state persists | eliminated = grayscale + ELIMINATED banner (not hidden!) | accused = magnifier badge |

Eliminated suspects never disappear — visibility of reasoning is the point.

## 6. Immediate cause-and-effect feedback model

1. Input echo < 50 ms (key press highlights, slider bubble moves).
2. Semantic ack < 150 ms (Check it → spinner never needed; local compute instant).
3. Consequence < 600 ms (constraint chip animates along a path to case file; suspect card dims the moment a linking ✕ is set).
4. Audio mirrors visuals only if sound enabled: soft tick (chip earned), low thud-free pulse (retry), warm chime (case closed). No buzzers, no sad sounds.
5. Announcements: `aria-live=polite` mirrors every consequence verbally ("Clue earned: the culprit is taller than 120 centimeters").

## 7. Hint ladder UI

Button `🛈 Hint` persistent in S2. Sheet reveals one level at a time; each reveal has "Another hint" except L4 which asks "Show me how? (worth fewer points)" — explicit consent per REQUIREMENTS §8. Levels styled as detective notebook entries (L1 "Look again", L2 "Detective's trick", L3 "Try this one first", L4 "The reveal"). After L3/L4 use, next station may open with L2 already offered (learner model); offer is dismissible and never re-opens itself twice in a row. Auto-offer rule: after 2 misses, sheet slides up with L1 shown, dismissible.

## 8. Keyboard & touch specification

- Global: Tab order = visual order; Esc = pause; Enter/Space activate; arrows navigate matrix/options/slider; number keys work on keypad-focused stations.
- Focus ring: 3 px, offset 2 px, token `--focus-ring`, never removed.
- Targets: ≥ 48×48 px touch intent areas (44 CSS px absolute floor); adjacent interactive elements ≥ 8 px apart; board intersections sized 52×52 px mobile.
- Gestures have button equivalents (drag-to-order ↔ up/down buttons; slider ↔ −/+ steppers).
- Full keyboard completion of a case is an automated e2e gate, not a manual hope.

## 9. Captions & audio cues

- Every narrated/readable line has written text on screen (read-aloud is enhancement, never requirement).
- Sound design (direction in PROTOTYPE_NOTES): 4 cues max, ≤ 300 ms, −18 LUFS-ish quiet, off by default, session-persisted toggle in S8.
- Non-speech audio info (e.g., correct chime) always duplicated visually; nothing audio-only.

## 10. Untimed / reduced-pressure mode

Default experience is already untimed (no visible clocks in game UI). Settings add **Relaxed mode**: hides progress dots and streak chips, keeps everything else — for kids who find any progress framing anxious. Earned-break shell countdown remains (product requirement) but is neutral-styled and outside game chrome.

## 11. Color-independence system

- Tokens: semantic colors always paired with glyphs (✓/✕/★/🔍) AND words; chart series get patterns (stripes/dots) over hue; ALIVE/ELIMINATED stamps include words.
- De-colorization invariant: grayscale screenshot of any screen must remain fully usable — included in DoD as a manual review artifact + automated contrast checks.
- Colorblind-safe palette pairs (blue/orange, purple/green) chosen so deuteranopia/protanopia/tritanopia distinguishable; patterns make it moot regardless.

## 12. Copy voice rules

- Sentence caps by tier: D1–D2 ≤ 12 words; D3–D4 ≤ 18; D5 prose allowed but never walls.
- Detective tone: playful, respectful, zero baby-talk at D4–D5 ("suspect", "alibi", "evidence" taught in-context via icons).
- Banned copy (hard list): any loss framing ("you lost", "out of time"), comparison to other kids, urgency ("hurry!", "last chance!"), superiority claims, internal jargon. Grep gate in DoD.

## 13. Accessibility conformance targets

WCAG 2.1 AA minimum: contrast ≥ 4.5:1 text / 3:1 large+UI; reflow at 320 px; zoom 200%; reduced-motion honored globally; SR labels per §4/§6; keyboard-complete (automated); axe-core zero critical/serious in CI (mirrors repo precedent CONSULTING-182 gates). Child-specific extras: tap-target and reading-level rules above; captions; no hover-only info.

---

## 14. UX review pass — audit findings log (project-ux contract)

Method: cognitive walkthrough of every flow (fresh + returning personas Maya/Dev/Lena/Marcus), plus heuristic checklist (clarity, load, states, hierarchy, defaults). Before/after reported per finding; all folded back into this doc + REQUIREMENTS.md; none deferred silently.

| # | Flow (before) | Finding | Severity | Resolution (after) |
|---|---|---|---|---|
| F-01 | Case picker offered 4 choices (mode × difficulty) on first run | Choice overload at entry; returning users fine, fresh users hesitated (simulated) | High | First-run shows exactly 2 buttons + Auto rank; rank picker collapsed into "Change rank" reachable from summary/pause. Folded into §2. |
| F-02 | Briefing showed all attribute chips as text | Non-readers stuck at S1 | High | Attribute chips carry icons (dog, basketball, ruler…); text is caption. §4 S1 updated; added to discoverability test criteria. |
| F-03 | Original S2 draft had hint button inside overflow menu | Hints are core scaffolding, must be one tap | Med | Persistent 🛈 button in station layout (§4 S2, §7). |
| F-04 | Draft used color-only ALIVE/Eliminated toggle at checkpoint | Color-independence violation | High | Stamps carry words + icons; grayscale invariant added to DoD (§5, §11). |
| F-05 | Draft accusation allowed single-tap commit | Double-tap misfires; also skipped reflection | Med | Two-step confirm sheet with "Because…" lines (§4 S5); idempotency retained. |
| F-06 | Summary draft led with points total | Points invite speed-framing; independence is the honest headline | Med | Independence score leads; points demoted to detail line (§4 S7); consistent with untimed philosophy. |
| F-07 | Empty-state for generation fallback unspecified | Dead-end risk on failure | Med | Friendly fallback panel + silent seed-case swap specified (§4 S1; telemetry wired). |
| F-08 | Returning-player resume row absent | Fresh/returning asymmetry unhandled | Low | Session-only continue row on picker (§2). |
| F-09 | Draft had streak chip animating reset visibly | Loss-aversion adjacency (policy risk) | Policy-critical | Silent reset mandated (REQUIREMENTS §6; §12 bans loss copy). |
| F-10 | Relaxed mode didn't exist in first draft | Anxiety-prone kids had no pressure valve | Med | Relaxed mode added (§10). |

**Audit outcome:** every main flow shortened or clarified (F-01, F-03, F-05, F-06); all states communicate intent (F-07, F-08); product reads calm (F-04, F-09, F-10). **Open blockers remaining: 0.** Live-kid playtest validation explicitly carried as user-only step in EPIC_PLAN (not claimable here).


