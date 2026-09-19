# Math Detective — Real-Child Discoverability Playtest Protocol

**Status:** Protocol finalized 2026-08-27 · **Owner step** (cannot be executed by an automated agent)
**Jira:** CONSULTING-230 (MD-15) · Epic CONSULTING-190
**Basis:** UX_DESIGN §3 test protocol + GAMES_PLAN discoverability bar. This document makes the protocol executable by a facilitator: recruiting, script, rubric, pass bar, and evidence recording.

---

## 1. What this gate decides

MD-15's closure requires **live-child evidence** that a first-time player can complete the calibration/onboarding path with zero adult coaching. Machine-verifiable equivalents (heuristic expert review, task-model walkthrough, E2E journeys) are complete and recorded in `UI_TEST_REPORT.md`; they do not substitute for this study. **The Epic must not be marked Done until this gate passes.**

## 2. Study design

| Item | Requirement |
|---|---|
| Participants | n ≥ 8 children, mixed genders, no prior exposure to the game |
| Age/difficulty spread | At least 2 children per placement band D1, D3, D5 (roughly: D1 = grades 1–2, D3 = grades 3–4, D5 = grades 6–8). Recruit via the rank row: set **Cadet / Agent / Inspector** manually so the band is controlled regardless of placement signal. |
| Setting | Quiet room, one facilitator + one child at a time; parent/guardian consent required; session recorded (screen + audio) with permission |
| Device | The device the child normally uses (tablet or phone preferred; laptop acceptable). Include at least 3 phone sessions and at least 2 keyboard-only sessions. |
| Duration | One Quick Case per child (≈ 90 s target); optionally one more case if the child asks |
| Facilitator behavior | **Zero coaching.** Do not name buttons, do not point, do not explain mechanics. If the child asks a question, respond only with "What would you try?" Facilitator may read nothing aloud unless the child taps the read-aloud button themselves. |

## 3. Task script (per child)

1. Hand the device with `/games` open. Say exactly: "These are math games. Try the one that looks like a mystery." (No further help.)
2. **T0 — discoverability:** child taps the Math Detective card and starts a case.
3. **T1 — calibration completion:** child reaches the case summary. No time limit; record wall-clock minutes for pacing evidence (target median 75–110 s for the case itself).
4. **T2 — evidence interpretation:** afterwards, ask the child to explain in their own words how they knew who the culprit was. Record whether they reference at least one earned clue (constraint sentence).
5. **T3 — recovery:** (observed, not forced) if the child makes a wrong accusation or wrong answer, record whether they continue without frustration and without adult help.
6. Thank the child; ask one preference question: "What was the best part? What was the most confusing part?"

## 4. Pass bar (matches EPIC_PLAN MD-15 AC)

- **Primary:** ≥ 7 of 8 children complete the calibration/first case with zero adult input (T0–T1 unassisted).
- **Secondary:** ≥ 6 of 8 reference at least one clue when explaining their accusation (T2) — evidence the deduction loop is understood, not guessed.
- **Recovery:** wrong-answer/wrong-accusation moments do not produce abandonment in more than 1 of 8 sessions (T3).

## 5. Recording template (one row per child)

| # | Band (rank) | Age | Device/input | Completed unassisted? (Y/N) | Minutes | Explained with a clue? (Y/N) | Hesitations / confusion points | Fixes indicated |
|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | |

Where a hesitation maps to a code/design fix, file it against MD-15 with the row number as evidence; where it is a polish/copy matter, log it in the gap list (`BENCHMARK_COMPARISON.md`).

## 6. Ethics & privacy

- Guardian consent form before recording; child verbal assent.
- Sessions are stored locally by the owner only; no child PII enters the repository or Jira beyond first-name-or-initial + band + age.
- The game itself is session-only (nothing saved) — state this to the guardian from the `/safety` page wording.

## 7. After the study

1. Record the completed table + pass-bar verdict as a comment on CONSULTING-230.
2. Map hesitations to fixes; remediate in-scope items and re-run the ladder (`typecheck && lint && test && build` + the Math Detective E2E suites).
3. Only then mark MD-15 Done and update the Epic with the final implementation summary.


