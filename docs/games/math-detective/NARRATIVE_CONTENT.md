# Math Detective narrative content contract

GAME-245 supplies a deterministic, session-only content layer for the frozen
GAME-136 case engine and the GAME-140 world projection.

## Boundary

`src/lib/mathDetective/narrative.ts` owns four bounded original settings:

- Library archive
- Community garden
- Makers market
- Sky observatory

Every shipped skill has a setting-specific object family. The generator picks
one setting from the seed, tier, and mode without consuming the solver RNG;
the evidence generator remains authoritative for attributes, constraints,
answers, and culprit identity.

`CaseNarrative` contains the briefing, suspect introductions, clue framing,
chapter beats, elimination lines, and verdict framing. These values are
presentation copy only. They do not contain a predicate, answer, or culprit
identifier, and clue framing never replaces the authoritative constraint
sentence.

## Determinism and privacy

The same seed, tier, and mode produce the same setting and authored strings.
The setting selector uses a local stable hash, so narrative selection does not
perturb the existing solver stream. No network call or browser storage is
introduced; case narrative travels only with the in-memory `CaseRun`.

`src/lib/mathDetective/agency.ts` adds the shell-facing agency file counter.
It counts distinct cases and closed cases in module memory, so the header can
frame a multi-case session without introducing scores, comparison language,
browser storage, or a network dependency. A fresh browser session starts with
an empty agency file by design.

## Copy and provenance gates

Every authored value carries `source: "original-authored"`, the content-bank
owner, and `reviewed: false`. The bank is scanned for banned pressure,
comparison, benchmark, and named-IP language. D1–D2 generated narrative is
checked against the 12-word sentence limit.

The automated provenance, readability, and negative seeded-violation checks
are implemented in `tests/mathDetective.narrative.test.ts`. The project owner
approved the final production copy for the 2026-09-20 candidate in the release
task. This contract does not replace the automated checks or claim approval for
future copy changes.
