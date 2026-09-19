// Prototype validation (design evidence). Run: node engine.test.mjs
import assert from "node:assert/strict";
import MDE from "./engine.js";

const results = [];
function check(name, fn) {
  try { fn(); results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name + " :: " + e.message]); }
}

check("case uniqueness solver passes on authored case", () => {
  const v = MDE.verifyCase();
  assert.equal(v.ok, true, v.problems.join(" | "));
});

check("prefix of clues leaves >=2 candidates", () => {
  const c1 = [MDE.EVIDENCE[0].constraint];
  const mid = MDE.survivorsAfter(c1);
  assert.ok(mid.length >= 2, "after clue 1 survivors=" + mid.length);
  assert.deepEqual(mid.map(s => s.id).sort(), ["ava", "chloe"]);
});

check("full constraint set isolates culprit only", () => {
  const all = MDE.EVIDENCE.map(e => e.constraint);
  assert.deepEqual(MDE.survivorsAfter(all).map(s => s.id), [MDE.CULPRIT_ID]);
});

check("scoring honors attempt taper", () => {
  const item = MDE.EVIDENCE[0];
  assert.equal(MDE.scoreEvidence(item, 0, []), 10);
  assert.equal(MDE.scoreEvidence(item, 1, []), 6);
  assert.equal(MDE.scoreEvidence(item, 3, []), 3);
});

check("hint caps: L1/L2 cap at 6 even on first try", () => {
  const item = MDE.EVIDENCE[0];
  assert.equal(MDE.scoreEvidence(item, 0, [1]), 6);
  assert.equal(MDE.scoreEvidence(item, 0, [2]), 6);
});

check("L3/L4 hint caps at 3", () => {
  const item = MDE.EVIDENCE[0];
  assert.equal(MDE.scoreEvidence(item, 0, [1, 2, 3]), 3);
  assert.equal(MDE.scoreEvidence(item, 0, [4]), 3);
});

check("independence score math + zero case", () => {
  const s = MDE.summarize([
    { points: 10, firstTryNoHint: true },
    { points: 6, firstTryNoHint: false },
  ]);
  assert.equal(s.totalPoints, 16);
  assert.equal(s.independenceScore, 63); // round(10/16*100)
  const z = MDE.summarize([]);
  assert.equal(z.totalPoints, 0);
  assert.equal(z.independenceScore, 0);
  assert.ok(z.coaching.length > 10);
});

check("hint ladder returns authored text for all levels", () => {
  for (const item of MDE.EVIDENCE) {
    for (const lvl of [1, 2, 3, 4]) {
      const h = MDE.getHint(item.id, lvl);
      assert.equal(h.level, lvl);
      assert.equal(h.source, "rule");
      assert.ok(h.text.length > 10, item.id + " l" + lvl);
    }
  }
  assert.equal(MDE.getHint("nope", 1), null);
});

let failed = 0;
for (const [status, name] of results) {
  if (status === "FAIL") failed += 1;
  console.log(status + "  " + name);
}
console.log(failed === 0 ? "\nALL CHECKS PASSED (" + results.length + ")" : "\n" + failed + " FAILURES");
process.exit(failed === 0 ? 0 : 1);


