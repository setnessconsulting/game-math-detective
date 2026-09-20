# Deterministic parity evidence

The migrated golden and contract suites exercise the authoritative output boundary rather than React or Phaser implementation details.

## Fixture coverage

src/lib/mathDetective/golden/index.ts defines representative fixtures:

- D1 full, seed 42
- D2 full, seed 42
- D3 full, seed 42
- D4 full, seed 42
- D5 full, seed 42
- D3 mini, seed 17

For each fixture the suite regenerates the case, verifies uniqueness, records evidence sequencing and elimination, drives wrong-answer recovery, records hint/scoring behavior, exercises wrong accusations and retry/guided recovery, then verifies the correct verdict and summary. Reducer timestamps use the fixed value 1700000000000.

The projected comparison intentionally omits constraint predicate functions because closures are not serializable. It compares the contract fields that cross the core boundary: case identity, roster attributes, evidence presentation, numeric answers, constraints, hints, misconception tags, checkpoint positions, elimination sequence, scoring, verdict, and telemetry event names.

## Normalization

The only normalization is closure omission in the serializable projection and fixed test timestamps. There is no mathematical or educational normalization. The migrated source is byte-preserved from the recorded LevelBest commit; standalone tests run the same projections from the standalone path.

## Evidence commands

    npm test -- tests/mathDetective.golden.test.ts tests/mathDetective.engine.test.ts tests/mathDetective.integrity.test.ts
    npm test -- tests/mathDetective.phaserAdapter.test.ts tests/mathDetective.scene.test.ts

The standalone tests are the executable parity record for GAME-298 and the migrated GAME-136/137/138 foundation. The focused engine, scene-contract, and Phaser-adapter suites were re-run on 2026-09-20; they pass against this repository. Jira issue closure and any separate human sign-off remain owner-managed workflow steps rather than claims made by the test suite.

The checked-in fixture material hashes are:

| Fixture | SHA-256 |
| --- | --- |
| D1-full | 463be044a91470e731836692d42c5a6627bcff3898729de735f587fe4273e5f1 |
| D2-full | 039d9e8232c656a42224c63121da165e966b6aa4716126a494bc26bb3bb1c597 |
| D3-full | 27dd118b40c9946cafe9e8d12b443887181d18e2b65211e882b2b2a37ad01715 |
| D4-full | 0ceff9e237a6a5ac1dc76c3542c1f8254ff62699760939e41cfcba3cde93fdfd |
| D5-full | aa0a271ef2d59b3d3b6e10105995a682a364c11caf3b49e23e9ba29d4427325b |
| D3-mini | 55680cbfd21034831c732ed53e996e5933009e3424321d5836ae00befc8930d3 |
