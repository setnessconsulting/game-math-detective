# Math Detective — Single-Tester Discoverability Playtest Protocol

**Status:** Protocol revised 2026-09-20 · **Owner step** (cannot be executed by an automated agent)
**Jira:** CONSULTING-230 (MD-15) · Epic CONSULTING-190
**Basis:** UX_DESIGN §3 test protocol + GAMES_PLAN discoverability bar. The release decision uses one owner-selected tester as a lightweight qualitative gate, not as a statistically representative study. This document makes the protocol executable by a facilitator: script, rubric, pass bar, and evidence recording.

---

## 1. What this gate decides

MD-15's closure requires **live-child evidence** that one player can complete the calibration/onboarding path with zero adult coaching. Machine-verifiable equivalents (heuristic expert review, task-model walkthrough, E2E journeys) are complete and recorded in `UI_TEST_REPORT.md`; they do not substitute for this owner-run check. The revised gate is intentionally one tester: it answers whether this candidate is playable enough to ship, without claiming population-level usability. **The Epic must not be marked Done until this gate passes.**

## 2. Study design

| Item | Requirement |
|---|---|
| Participants | Exactly one owner-selected child tester. No prior exposure is preferred; record if the tester has seen the game before. |
| Age/difficulty spread | No recruitment quota. Record the approximate placement band if known; the single session is a qualitative release signal, not a claim across D1, D3, and D5. |
| Setting | Quiet room, one facilitator + one child at a time; parent/guardian consent required; session recorded (screen + audio) with permission |
| Device | The device the child normally uses (tablet, phone, or laptop). Record device, browser, and input method when available; there are no phone or keyboard quotas. |
| Duration | One Quick Case (≈ 90 s target); optionally one more case if the child asks |
| Facilitator behavior | **Zero coaching.** Do not name buttons, do not point, do not explain mechanics. If the child asks a question, respond only with "What would you try?" Facilitator may read nothing aloud unless the child taps the read-aloud button themselves. |

## 3. Task script (per child)

1. Hand the device with `/games` open. Say exactly: "These are math games. Try the one that looks like a mystery." (No further help.)
2. **T0 — discoverability:** child taps the Math Detective card and starts a case.
3. **T1 — calibration completion:** child reaches the case summary. No time limit; record wall-clock minutes for pacing evidence (target median 75–110 s for the case itself).
4. **T2 — evidence interpretation:** afterwards, ask the child to explain in their own words how they knew who the culprit was. Record whether they reference at least one earned clue (constraint sentence).
5. **T3 — recovery:** (observed, not forced) if the child makes a wrong accusation or wrong answer, record whether they continue without frustration and without adult help.
6. Thank the child; ask one preference question: "What was the best part? What was the most confusing part?"

## 4. Pass bar (matches EPIC_PLAN MD-15 AC)

- **Primary:** the single tester completes the calibration/first case with zero adult input (T0–T1 unassisted), or the owner records why the observed flow was acceptable under the qualitative release decision.
- **Secondary:** the tester references at least one clue when explaining their accusation (T2), when the question is asked — evidence the deduction loop is understood, not guessed.
- **Recovery:** if a wrong answer or accusation occurs, the tester can continue without adult help (T3); record any abandonment or blocking confusion.

## 5. Recording template (one row per child)

| # | Band (rank) | Age | Device/input | Completed unassisted? (Y/N) | Minutes | Explained with a clue? (Y/N) | Hesitations / confusion points | Fixes indicated |
|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | |

Where a hesitation maps to a code/design fix, file it against MD-15 with the row number as evidence; where it is a polish/copy matter, log it in the gap list (`BENCHMARK_COMPARISON.md`).

## 6. Current release evidence

On 2026-09-20 the owner reported that one child tester played the hosted Math Detective candidate and judged it good enough for production. No name or other child PII is recorded here. Device, input method, timing, and structured T0–T3 fields were not captured in the release task, so this is recorded as a qualitative owner acceptance signal rather than a measured usability study. The single-tester requirement is satisfied for this release decision; future sessions may add structured rows without changing the policy.

## 7. Ethics & privacy

- Guardian consent form before recording; child verbal assent.
- Sessions are stored locally by the owner only; no child PII enters the repository or Jira beyond first-name-or-initial + band + age.
- The game itself is session-only (nothing saved) — state this to the guardian from the `/safety` page wording.

## 8. After the study

1. Record the completed table when available, plus the pass-bar verdict, as a comment on CONSULTING-230.
2. Map hesitations to fixes; remediate in-scope items and re-run the ladder (`typecheck && lint && test && build` + the Math Detective E2E suites).
3. After the owner records the one-tester outcome and the remaining release records are linked,
   mark MD-15 Done and update the Epic with the final implementation summary.


