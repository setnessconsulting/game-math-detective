/* Math Detective — throwaway prototype engine (design evidence only)
 * Mirrors the seam contracts sketched in REQUIREMENTS.md §13.3:
 *   generation -> pure payloads; scoring; hint ladder; uniqueness solver.
 * Not production code. Runs in browser (window.MDEngine) and node (module.exports).
 */
(function (root) {
  "use strict";

  // ---- PRNG (same algorithm family as repo convention) --------------------
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- Authored calibration case (D3) -------------------------------------
  // Suspect attributes are the deduction vocabulary. Culprit: Ava.
  var SUSPECTS = [
    { id: "ava",   name: "Ava",   initial: "A", heightCm: 132, afterSchool: "Walks past the gym, 3:35", icon: "⚽" },
    { id: "ben",   name: "Ben",   initial: "B", heightCm: 125, afterSchool: "Art room until 4:00",     icon: "🎨" },
    { id: "chloe", name: "Chloe", initial: "C", heightCm: 140, afterSchool: "Choir until 4:00",        icon: "🎵" },
    { id: "miles", name: "Miles", initial: "M", heightCm: 118, afterSchool: "Library until 4:00",      icon: "📚" }
  ];
  var CULPRIT_ID = "ava";

  // Evidence items: pure payloads (presentation + answer + constraint template)
  var EVIDENCE = [
    {
      id: "ev-shelf",
      skillId: "measure-length",
      goal: "Measure the shelf. How many centimeters tall is it?",
      presentation: { kind: "ruler", cmMarks: true, shelfTopCm: 130 },
      answer: { type: "number", value: 130, unit: "cm", tolerance: 0 },
      points: { firstTry: 10, retry: 6, later: 3 },
      constraint: {
        id: "c-height",
        chip: "At least 130 cm tall",
        sentence: "The culprit is at least 130 cm tall.",
        test: function (s) { return s.heightCm >= 130; }
      },
      hints: {
        l1: "Look at the ruler. Find where the top of the shelf lines up.",
        l2: "Each big number on the ruler is 10 cm. Count from 100 upward.",
        l3: "Try this one first: if a box top lines up with 120, the box is 120 cm tall.",
        l4: "The shelf top lines up halfway between 120 and 140 — that mark is 130. It is 130 cm tall."
      },
      misconceptionTag: "ruler-read"
    },
    {
      id: "ev-clock",
      skillId: "time-elapsed",
      goal: "How many minutes was the gym empty between these two clocks?",
      presentation: { kind: "clockPair", startLabel: "Everyone left", endLabel: "Coach returned", startH: 3, startM: 0, endH: 3, endM: 35 },
      answer: { type: "number", value: 35, unit: "min", tolerance: 0 },
      points: { firstTry: 10, retry: 6, later: 3 },
      constraint: {
        id: "c-gym",
        chip: "Near the gym after 3:35",
        sentence: "The culprit went past the gym after 3:35.",
        test: function (s) { return s.id === "ava"; } // authored: only Ava's route passes post-3:35
      },
      hints: {
        l1: "Read both clock faces. Where does the short hand point on each?",
        l2: "Count minutes from the first clock to the second. A quarter face is 15 minutes.",
        l3: "Try this one first: from 2:00 to 2:20 is how many minutes? (20.)",
        l4: "From 3:00 to 3:35 is 35 minutes. The gym was empty for 35 minutes."
      },
      misconceptionTag: "elapsed-time"
    }
  ];

  // ---- Case assembly + uniqueness verification (solver seam) --------------
  function survivorsAfter(constraintsUpTo) {
    return SUSPECTS.filter(function (s) {
      return constraintsUpTo.every(function (c) { return c.test(s); });
    });
  }

  /** Property checks from REQUIREMENTS §5.1: unique solution, no early solve,
   *  every clue eliminates >= 1 live suspect. Returns {ok, problems[]}. */
  function verifyCase() {
    var problems = [];
    var all = EVIDENCE.map(function (e) { return e.constraint; });
    var finals = survivorsAfter(all);
    if (finals.length !== 1 || finals[0].id !== CULPRIT_ID) {
      problems.push("full set does not uniquely identify culprit (got " +
        finals.map(function (s) { return s.id; }).join(",") + ")");
    }
    for (var i = 0; i < all.length - 1; i += 1) {
      var mid = survivorsAfter(all.slice(0, i + 1));
      if (mid.length < 2) problems.push("prefix " + i + " solves case early");
    }
    var live = SUSPECTS;
    for (var j = 0; j < all.length; j += 1) {
      var nextLive = live.filter(all[j].test);
      if (nextLive.length === live.length) problems.push("clue " + j + " eliminates nobody");
      live = nextLive;
    }
    return { ok: problems.length === 0, problems: problems };
  }

  // ---- Scoring (REQUIREMENTS §6) ------------------------------------------
  function scoreEvidence(item, attemptIndex, hintsUsedLevels) {
    var base = attemptIndex <= 0 ? item.points.firstTry
      : attemptIndex === 1 ? item.points.retry : item.points.later;
    var maxHint = 0;
    (hintsUsedLevels || []).forEach(function (l) { maxHint = Math.max(maxHint, l); });
    var cap = maxHint >= 3 ? 3 : maxHint === 2 ? 6 : maxHint === 1 ? 6 : base;
    return Math.min(base, cap);
  }

  function summarize(results) { // results: [{points, firstTryNoHint}]
    var total = 0, indep = 0;
    results.forEach(function (r) {
      total += r.points;
      if (r.firstTryNoHint) indep += r.points;
    });
    var independence = total === 0 ? 0 : Math.round((indep / total) * 100);
    var coaching;
    if (independence >= 80) coaching = "Sharp detective work — you cracked the clues mostly on your own.";
    else if (independence >= 50) coaching = "Good instincts. Next case, try the trick hint before the reveal.";
    else coaching = "Every detective uses help sometimes. Picture the steps, then check your answer.";
    return { totalPoints: total, independenceScore: independence, coaching: coaching };
  }

  // ---- Hint ladder ----------------------------------------------------------
  function getHint(itemId, level) {
    var item = EVIDENCE.filter(function (e) { return e.id === itemId; })[0];
    if (!item) return null;
    var key = "l" + level;
    return { level: level, source: "rule", text: item.hints[key] };
  }

  var MDEngine = {
    mulberry32: mulberry32,
    SUSPECTS: SUSPECTS,
    CULPRIT_ID: CULPRIT_ID,
    EVIDENCE: EVIDENCE,
    verifyCase: verifyCase,
    scoreEvidence: scoreEvidence,
    summarize: summarize,
    getHint: getHint,
    survivorsAfter: survivorsAfter
  };

  if (typeof module !== "undefined" && module.exports) module.exports = MDEngine;
  if (root) root.MDEngine = MDEngine;
})(typeof window !== "undefined" ? window : globalThis);


