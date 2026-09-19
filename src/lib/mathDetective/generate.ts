/**
 * Math Detective — problem generation (seam 2, REQUIREMENTS §13.3).
 *
 * Every generator produces pure payload data plus the single constraint its
 * solution earns. Generators may refine the culprit's own attributes (e.g.,
 * deriving an expression from the badge number) — mutations are part of the
 * deterministic build attempt, so seeded runs stay reproducible.
 */
import { pickInt, pickFrom, shuffled } from "@/lib/games/shared/rng";
import { TIER_META } from "./skills";
import type {
  AnswerPayload,
  CaseMode,
  DifficultyTier,
  GeneratedEvidence,
  HintSet,
  PresentationPayload,
  SkillId,
  Suspect,
  SuspectAttrs,
} from "./types";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Minutes-after-3pm → kid clock text, five-minute granularity. */
export function clockText(minAfter3pm: number): string {
  const hour = 3 + Math.floor(minAfter3pm / 60);
  const minute = minAfter3pm % 60;
  return `${hour}:${String(minute).padStart(2, "0")}`;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

// ---------------------------------------------------------------------------
// Suspect population
// ---------------------------------------------------------------------------

const NAME_POOL: readonly { name: string; icon: string }[] = [
  { name: "Ava", icon: "⚽" },
  { name: "Ben", icon: "🎨" },
  { name: "Chloe", icon: "🎵" },
  { name: "Miles", icon: "📚" },
  { name: "Nia", icon: "🏀" },
  { name: "Omar", icon: "🧩" },
];

const PLACES: readonly string[] = ["gym", "art room", "music room", "library", "cafe"];

export interface SuspectRosterConfig {
  /** Guarantee a duplicate partner for these attrs so equals-clues narrow. */
  duplicateWithCulprit: Array<"itemsTaken" | "spendCents">;
  /** Grid size used to draw unique club-room codes. */
  gridRows: number;
  gridCols: number;
}

function rosterConfig(tier: DifficultyTier, mode: CaseMode): SuspectRosterConfig {
  void mode;
  const gridRows = tier === "D1" || tier === "D2" || tier === "D3" ? 4 : 5;
  return { duplicateWithCulprit: ["itemsTaken", "spendCents"], gridRows, gridCols: gridRows };
}

/**
 * Populate suspects deterministically. Invariants relied on by builders:
 * heights / badgeNo / gridCell / stepsAvg / walletCents / spendCents are
 * pairwise distinct; culprit shares itemsTaken (and spendCents) with at
 * least one other suspect; culprit.madeClaim === false and at least one
 * other suspect has madeClaim === true.
 */
export function makeSuspects(
  rng: () => number,
  tier: DifficultyTier,
  mode: CaseMode,
): { suspects: Suspect[]; culpritId: string } {
  const count = TIER_META[tier].suspects;
  const cfg = rosterConfig(tier, mode);

  const cast = shuffled(rng, NAME_POOL).slice(0, count);
  const suspects: Suspect[] = cast.map((c, i) => ({
    id: `s${i}`,
    name: c.name,
    initial: c.name.charAt(0),
    icon: c.icon,
    attrs: {} as SuspectAttrs,
  }));

  const culpritIdx = pickInt(rng, 0, count - 1);
  const culpritId = suspects[culpritIdx]!.id;

  // Heights: strictly increasing walk ⇒ pairwise unique by construction.
  let heightCursor = pickInt(rng, 116, 128);
  for (const suspectIdx of shuffled(rng, suspects.map((_, i) => i))) {
    suspects[suspectIdx]!.attrs.heightCm = heightCursor;
    heightCursor += pickInt(rng, 4, 6);
  }

  // Schedule windows (minutes after 3pm), five-minute granularity.
  for (const s of suspects) {
    s.attrs.arriveMin = pickInt(rng, 0, 10) * 5;
    s.attrs.leaveMin = Math.min(90, s.attrs.arriveMin + pickInt(rng, 6, 14) * 5);
  }

  // Wallets: unique multiples of 25.
  const walletPool = shuffled(
    rng,
    Array.from({ length: 41 }, (_, i) => 200 + i * 25),
  );
  suspects.forEach((s, i) => {
    s.attrs.walletCents = walletPool[i]!;
  });

  // Spent amounts: unique multiples of 25 (refined by money clues later).
  const spendPool = shuffled(
    rng,
    Array.from({ length: 29 }, (_, i) => 100 + i * 25),
  );
  suspects.forEach((s, i) => {
    s.attrs.spendCents = spendPool[i]!;
  });

  // Items taken: small pool so duplicates arise; force a culprit partner.
  suspects.forEach((s) => {
    s.attrs.itemsTaken = pickInt(rng, 2, 5);
  });
  if (cfg.duplicateWithCulprit.includes("itemsTaken")) {
    const partner = suspects.find((_, i) => i !== culpritIdx)!;
    partner.attrs.itemsTaken = suspects[culpritIdx]!.attrs.itemsTaken;
  }

  // Badge numbers & club-room squares & step averages: unique (pinpoint dims).
  const badgePool = shuffled(
    rng,
    Array.from({ length: 78 }, (_, i) => 21 + i),
  );
  const cellPool = shuffled(
    rng,
    Array.from(
      { length: cfg.gridRows * cfg.gridCols },
      (_, i) => (Math.floor(i / cfg.gridCols) + 1) * 10 + ((i % cfg.gridCols) + 1),
    ),
  );
  const stepsPool = shuffled(
    rng,
    Array.from({ length: 71 }, (_, i) => 2000 + i * 100),
  );
  suspects.forEach((s, i) => {
    s.attrs.badgeNo = badgePool[i]!;
    s.attrs.gridCell = cellPool[i]!;
    s.attrs.stepsAvg = stepsPool[i]!;
  });

  // Wild claims: culprit never made one; at least one other suspect did.
  suspects.forEach((s, i) => {
    s.attrs.madeClaim = i !== culpritIdx && rng() < 0.4;
  });
  if (!suspects.some((s, i) => i !== culpritIdx && s.attrs.madeClaim)) {
    const others = suspects.filter((_, i) => i !== culpritIdx);
    pickFrom(rng, others).attrs.madeClaim = true;
  }

  return { suspects, culpritId };
}

// ---------------------------------------------------------------------------
// Per-station generators
// ---------------------------------------------------------------------------

export type StationGenerator = (ctx: GenContext) => GeneratedEvidence;

export interface GenContext {
  rng: () => number;
  tier: DifficultyTier;
  suspects: Suspect[];
  culprit: Suspect;
  /** Attributes of currently-live suspects (culprit included) for targeting. */
  liveAttrs: SuspectAttrs[];
}

function evidence(
  skillId: SkillId,
  goal: string,
  presentation: PresentationPayload,
  answer: AnswerPayload,
  constraint: GeneratedEvidence["constraint"],
  hints: HintSet,
  misconceptionTag: string,
): GeneratedEvidence {
  return {
    id: "",
    skillId,
    goal,
    presentation,
    answer,
    constraint,
    hints,
    misconceptionTag,
  };
}

type NumericAttrKey = {
  [K in keyof SuspectAttrs]: SuspectAttrs[K] extends number ? K : never;
}[keyof SuspectAttrs];

function thresholdConstraint(
  idBase: string,
  attr: NumericAttrKey,
  op: ">=" | "<=",
  value: number,
  chip: string,
  sentence: string,
): GeneratedEvidence["constraint"] {
  return {
    id: idBase,
    chip,
    sentence,
    kind: "threshold",
    attr,
    op,
    value,
    test: (a) => (op === ">=" ? a[attr] >= value : a[attr] <= value),
  };
}

// --- measure-length ---------------------------------------------------------

function genMeasure(ctx: GenContext): GeneratedEvidence {
  const { culprit, rng, liveAttrs } = ctx;
  const cH = culprit.attrs.heightCm;

  // Direction A ('>='): remove suspects SHORTER than a shelf height.
  const shorterOthers = liveAttrs.filter((a) => a.heightCm < cH);
  // Direction B ('<='): remove suspects TALLER than a clearance.
  const tallerOthers = liveAttrs.filter((a) => a.heightCm > cH);

  type Plan = { op: ">=" | "<="; value: number; removed: number };
  const plans: Plan[] = [];
  if (shorterOthers.length > 0) {
    const victimMax = Math.max(...shorterOthers.map((a) => a.heightCm));
    const keptMin = Math.min(
      ...liveAttrs.filter((a) => a.heightCm > victimMax).map((a) => a.heightCm),
    );
    const value = victimMax + pickInt(rng, 1, Math.max(1, Math.min(3, keptMin - victimMax - 1)));
    if (value < keptMin) {
      const removed = liveAttrs.filter((a) => a.heightCm < value).length;
      plans.push({ op: ">=", value, removed });
    }
  }
  if (tallerOthers.length > 0) {
    const victimMin = Math.min(...tallerOthers.map((a) => a.heightCm));
    const keptMax = Math.max(
      ...liveAttrs.filter((a) => a.heightCm < victimMin).map((a) => a.heightCm),
    );
    const span = victimMin - keptMax;
    const value = victimMin - pickInt(rng, 1, Math.max(1, Math.min(3, span - 1)));
    if (value > keptMax) {
      const removed = liveAttrs.filter((a) => a.heightCm > value).length;
      plans.push({ op: "<=", value, removed });
    }
  }
  if (plans.length === 0) {
    // No targeted plan (culprit is both min and max among live): fall back to
    // an interior shelf that keeps the culprit; builder validity-checks it.
    const value = Math.max(70, cH - pickInt(rng, 4, 18));
    plans.push({ op: ">=", value, removed: -1 });
  }
  const plan = plans.sort((a, b) => a.removed - b.removed)[0]!;
  const shelf = plan.value;

  const chip =
    plan.op === ">="
      ? `At least ${shelf} cm tall`
      : `Under ${shelf} cm tall`;
  const sentence =
    plan.op === ">="
      ? `The culprit is at least ${shelf} cm tall.`
      : `The culprit is under ${shelf} cm tall.`;

  return evidence(
    "measure-length",
    "Measure the marking. How many centimeters tall?",
    { kind: "ruler", shelfTopCm: shelf },
    { type: "number", value: shelf, unit: "cm" },
    thresholdConstraint("c-height", "heightCm", plan.op, shelf, chip, sentence),
    {
      l1: "Look at the ruler. Find where the marked top lines up.",
      l2: "Big labeled numbers go up by 10. Find the nearest label, then read the small mark.",
      l3: "Try this one first: if a box top lines up at 45, the box is 45 cm tall.",
      l4: `The marking lines up at ${shelf} on the ruler, so it is ${shelf} cm tall.`,
    },
    "ruler-read",
  );
}

// --- time-elapsed -----------------------------------------------------------

function genTimeElapsed(ctx: GenContext): GeneratedEvidence {
  const { culprit, rng, liveAttrs } = ctx;
  const c = culprit.attrs;

  // Scene minutes are bounded to [30, 60] so the clock pair never clamps
  // and elapsed answers stay within [20, 60] — which keeps the fixed L3
  // example number (10) leak-free.
  const inBand = (m: number): boolean => m >= 30 && m <= 60;
  // Target a scene minute inside every live window EXCEPT one victim's, so
  // exactly that victim is eliminated when possible.
  let best: { sceneMin: number; removed: number } | null = null;
  for (const victim of liveAttrs) {
    if (victim === c) continue;
    const others = liveAttrs.filter((a) => a !== victim);
    const lo = Math.max(...others.map((a) => a.arriveMin));
    const hi = Math.min(...others.map((a) => a.leaveMin));
    for (let m = lo; m <= hi; m += 5) {
      if (!inBand(m)) continue;
      if (m >= victim.arriveMin && m <= victim.leaveMin) continue;
      if (m < c.arriveMin || m > c.leaveMin) continue;
      const removed = liveAttrs.filter((a) => !(a.arriveMin <= m && a.leaveMin >= m)).length;
      if (!best || removed < best.removed) best = { sceneMin: m, removed };
      break; // first feasible minute for this victim suffices
    }
  }
  const fallbackLo = Math.max(c.arriveMin, 30);
  const fallbackHi = Math.min(c.leaveMin, 60);
  const sceneMin = best
    ? best.sceneMin
    : pickInt(rng, fallbackLo, Math.max(fallbackLo, fallbackHi));

  const startMin = Math.max(0, sceneMin - pickInt(rng, 2, 6) * 5);
  const endMin = Math.min(95, sceneMin + pickInt(rng, 2, 6) * 5);
  const emptyMinutes = endMin - startMin;
  const place = pickFrom(rng, PLACES);
  return evidence(
    "time-elapsed",
    `How many minutes was the ${place} empty?`,
    {
      kind: "clockPair",
      startH: 3 + Math.floor(startMin / 60),
      startM: startMin % 60,
      endH: 3 + Math.floor(endMin / 60),
      endM: endMin % 60,
      startLabel: "Room emptied",
      endLabel: "Adult returned",
    },
    { type: "number", value: emptyMinutes, unit: "min" },
    {
      id: "c-window",
      chip: `Near the ${place} at ${clockText(sceneMin)}`,
      sentence: `The culprit was near the ${place} at about ${clockText(sceneMin)}.`,
      kind: "window",
      attr: "scene-window",
      sceneMin,
      test: (a) => a.arriveMin <= sceneMin && a.leaveMin >= sceneMin,
    },
    {
      l1: "Read both clock faces. Where does the long hand point on each?",
      l2: "Count minutes from the first clock to the second. Each big step is 5 minutes.",
      l3: "Try this one first: from 2:00 to 2:10 is 10 minutes.",
      l4: `From ${clockText(startMin)} to ${clockText(endMin)} is ${emptyMinutes} minutes.`,
    },
    "elapsed-time",
  );
}

// --- data-tables -------------------------------------------------------------

function genDataTable(ctx: GenContext): GeneratedEvidence {
  const { suspects, culprit } = ctx;
  const total = suspects.reduce((sum, s) => sum + s.attrs.itemsTaken, 0);
  const noun = "markers";
  return evidence(
    "data-tables",
    `One log entry smudged out. How many ${noun}?`,
    {
      kind: "dataTable",
      title: "Equipment borrow log",
      unitNoun: noun,
      rows: suspects.map((s) => ({
        label: s.name,
        value: s.id === culprit.id ? null : s.attrs.itemsTaken,
      })),
      total,
    },
    { type: "number", value: culprit.attrs.itemsTaken, unit: noun },
    {
      id: "c-items",
      chip: `Took exactly ${culprit.attrs.itemsTaken}`,
      sentence: `The culprit took exactly ${culprit.attrs.itemsTaken} ${noun}.`,
      kind: "equals",
      attr: "itemsTaken",
      value: culprit.attrs.itemsTaken,
      test: (a) => a.itemsTaken === culprit.attrs.itemsTaken,
    },
    {
      l1: "One name has a ? instead of a number. That row is your answer.",
      l2: "Add the numbers you can see, then subtract that from the Total row.",
      l3: "Try this one first: total 14 with visible rows 6 and 1 means the smudge is 7.",
      l4: `Visible rows add to ${total - culprit.attrs.itemsTaken}, and the total is ${total}, so the smudged entry is ${culprit.attrs.itemsTaken}.`,
    },
    "table-missing-cell",
  );
}

// --- money-receipts ----------------------------------------------------------

function genReceipt(ctx: GenContext): GeneratedEvidence {
  const { culprit, rng, tier } = ctx;
  const step = tier === "D2" ? 25 : 5;
  const price1 = Math.max(step, pickInt(rng, 3, 15) * step);
  const qty1 = pickInt(rng, 2, 4);
  const lines = [{ label: "Snack", unitCents: price1, qty: qty1 }];
  let totalCents = price1 * qty1;
  if (tier !== "D2" && rng() < 0.6) {
    const price2 = Math.max(step, pickInt(rng, 2, 10) * step);
    const qty2 = pickInt(rng, 1, 3);
    lines.push({ label: "Drink", unitCents: price2, qty: qty2 });
    totalCents += price2 * qty2;
  }
  culprit.attrs.spendCents = totalCents;
  return evidence(
    "money-receipts",
    "Add the snack stand receipt. How many cents total?",
    { kind: "receipt", place: "snack stand", lines },
    { type: "number", value: totalCents, unit: "cents" },
    {
      id: "c-spend",
      chip: `Spent ${usd(totalCents)} at the stand`,
      sentence: `The culprit spent ${usd(totalCents)} at the snack stand.`,
      kind: "equals",
      attr: "spendCents",
      value: totalCents,
      test: (a) => a.spendCents === totalCents,
    },
    {
      l1: "Multiply each line: price times how many. Then add the lines.",
      l2: "Work one line at a time. Write the two products, then add.",
      l3: "Try this one first: 2 items at 5\u00A2 each is 10\u00A2.",
      l4: lines
        .map((l) => `${l.qty} \u00D7 ${l.unitCents}\u00A2 = ${l.qty * l.unitCents}\u00A2`)
        .concat(`Total = ${totalCents}\u00A2`)
        .join("; "),
    },
    "receipt-total",
  );
}

// --- fractions-parts ----------------------------------------------------------

function genFractions(ctx: GenContext): GeneratedEvidence {
  const { culprit, rng, tier } = ctx;
  const denominators = tier === "D3" ? [2, 4] : tier === "D4" ? [2, 3, 4] : [2, 3, 4, 6];
  const d = pickFrom(rng, denominators);
  // slicesPerPiece ≥ 2 keeps totalSlices ≥ 2d, so the eaten count can never
  // equal a number printed in the L1/L2 hint text (hint-leak invariant).
  const slicesPerPiece = tier === "D3" ? 2 : pickInt(rng, 2, 3);
  const totalSlices = d * slicesPerPiece * pickInt(rng, 1, 2);
  let n = pickInt(rng, 1, d - 1);
  while (gcd(n, d) !== 1) n = n === d - 1 ? 1 : n + 1;
  const eaten = (totalSlices * n) / d;
  culprit.attrs.itemsTaken = eaten;
  return evidence(
    "fractions-parts",
    `The tray held ${totalSlices} slices. How many were eaten?`,
    {
      kind: "fractionBar",
      totalSlices,
      eatenN: n,
      eatenD: d,
      label: `${n}/${d} of the tray`,
    },
    { type: "number", value: eaten, unit: "slices" },
    {
      id: "c-slices",
      chip: `Left with ${eaten} slices gone`,
      sentence: `The culprit ate ${n}/${d} of the tray \u2014 ${eaten} slices.`,
      kind: "equals",
      attr: "itemsTaken",
      value: eaten,
      test: (a) => a.itemsTaken === eaten,
    },
    {
      l1: "Split the tray into equal groups first \u2014 one group for each piece of the fraction.",
      l2: "Share all the slices evenly into those groups, then count one group per top-number piece.",
      l3: "Try this one first: half of 100 slices is 50 slices.",
      l4: `${totalSlices} \u00F7 ${d} = ${totalSlices / d}; ${n} \u00D7 ${totalSlices / d} = ${eaten} slices eaten.`,
    },
    "fraction-of-set",
  );
}

// --- grid-coordinates ----------------------------------------------------------

function genGrid(ctx: GenContext): GeneratedEvidence {
  const { culprit, tier } = ctx;
  const size = tier === "D3" ? 4 : 5;
  const row = Math.floor(culprit.attrs.gridCell / 10);
  const col = culprit.attrs.gridCell % 10;
  return evidence(
    "grid-coordinates",
    "Which numbered square does the witness point to?",
    {
      kind: "gridMap",
      rows: size,
      cols: size,
      markedRow: row,
      markedCol: col,
      witnessText: "\uD83D\uDC81 saw someone right here",
    },
    { type: "number", value: culprit.attrs.gridCell, unit: "square" },
    {
      id: "c-square",
      chip: `Club meets at square ${culprit.attrs.gridCell}`,
      sentence: `The culprit's club map square is ${culprit.attrs.gridCell}.`,
      kind: "equals",
      attr: "gridCell",
      value: culprit.attrs.gridCell,
      test: (a) => a.gridCell === culprit.attrs.gridCell,
    },
    {
      l1: "The star sits in a square with its own number: row digit then column digit.",
      l2: "Read the row number on the left, then the column number on the top.",
      l3: "Try this one first: row 9, column 8 is written 98.",
      l4: `Row ${row}, column ${col} \u2014 the square is numbered ${culprit.attrs.gridCell}.`,
    },
    "coordinate-read",
  );
}

// --- expressions-codes -----------------------------------------------------------

function genExpression(ctx: GenContext): GeneratedEvidence {
  const { culprit, rng, tier } = ctx;
  const useMultiply = tier !== "D1";
  // D4/D5 use the constructed tile-equation variant (benchmark gap G2);
  // D1–D3 decode with the numeric keypad. Tile targets stay ≥ 21 so the
  // fixed L3 example numbers (10, 2, 5) can never leak the answer.
  const tileMode = tier === "D4" || tier === "D5";
  const minValue = tileMode ? 21 : 10;
  const takenBadges = new Set(
    ctx.suspects.filter((s) => s.id !== culprit.id).map((s) => s.attrs.badgeNo),
  );

  // Draw operands until the expression value lands on an unused badge number,
  // so the displayed code, the answer, and the culprit's badge all agree.
  let a = 0;
  let b = 0;
  let c = 0;
  let firstOp: "\u00D7" | "+" = "+";
  let secondOp: "\u2212" | "+" = "+";
  let value = 0;
  let drawn = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    c = pickInt(rng, 2, 9);
    if (useMultiply) {
      a = pickInt(rng, 3, 9);
      b = pickInt(rng, 3, 9);
      firstOp = "\u00D7";
      secondOp = rng() < 0.6 ? "\u2212" : "+";
      value = secondOp === "\u2212" ? a * b - c : a * b + c;
    } else {
      // a and b stay ≤ 9 so no L2 operand token can equal a two-digit answer.
      a = pickInt(rng, 4, 9);
      b = pickInt(rng, 3, 9);
      firstOp = "+";
      secondOp = "\u2212";
      value = a + b - c;
    }
    if (value >= minValue && !takenBadges.has(value)) {
      drawn = true;
      break;
    }
  }
  if (!drawn) {
    // Deterministic construction with enough candidates to clear any roster.
    if (useMultiply) {
      a = 5;
      b = 5;
      firstOp = "\u00D7";
    } else {
      a = 10;
      b = 10;
      firstOp = "+";
    }
    for (const cc of [2, 3, 4, 5, 6, 7, 8, 9]) {
      const vMinus = useMultiply ? a * b - cc : a + b - cc;
      if (vMinus >= minValue && !takenBadges.has(vMinus)) {
        c = cc;
        secondOp = "\u2212";
        value = vMinus;
        drawn = true;
        break;
      }
      if (useMultiply) {
        const vPlus = a * b + cc;
        if (vPlus >= minValue && !takenBadges.has(vPlus)) {
          c = cc;
          secondOp = "+";
          value = vPlus;
          drawn = true;
          break;
        }
      }
    }
  }
  if (!drawn) value = a * b + 2; // unreachable with ≤6 suspects; keeps types total
  culprit.attrs.badgeNo = value;

  const l3Text =
    tileMode
      ? "Try this one first: to make 10, tiles 2 \u00D7 5 do it."
      : value === 10
        ? "Try this one first: 4 \u00D7 5 \u2212 6 = 14."
        : (() => {
            const cAlt = c + 1;
            const alt = secondOp === "\u2212" ? (useMultiply ? a * b - cAlt : a + b - cAlt) : a * b + cAlt;
            return `Try this one first: ${a} ${firstOp} ${b} ${secondOp} ${cAlt} = ${alt}.`;
          })();

  const presentation: PresentationPayload = tileMode
    ? {
        kind: "tileEquation",
        target: value,
        tiles: shuffled(rng, [
          "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "\u2212", "\u00D7",
        ]),
      }
    : {
        kind: "expressionCode",
        a,
        b,
        c,
        firstOp,
        secondOp,
        label: "Badge code machine",
      };

  return evidence(
    "expressions-codes",
    tileMode ? "Build the badge code from the tiles." : "Crack the code. What number does it make?",
    presentation,
    { type: "number", value, unit: "badge" },
    {
      id: "c-badge",
      chip: `Badge number ${value}`,
      sentence: `The culprit's badge number is ${value}.`,
      kind: "equals",
      attr: "badgeNo",
      value,
      test: (attrs) => attrs.badgeNo === value,
    },
    tileMode
      ? {
          l1: "The badge machine shows the target number. Build it from the tiles.",
          l2: "Multiply two tiles for a big jump, then add or subtract a tile to land on the target.",
          l3: l3Text,
          l4: `The badge is ${value}. One way: ${a} ${firstOp} ${b} ${secondOp} ${c}.`,
        }
      : {
          l1: "Do the \u00D7 or + first, then handle the last number.",
          l2: `Step 1: ${firstOp === "\u00D7" ? `${a} \u00D7 ${b}` : `${a} + ${b}`}. Step 2: ${
            secondOp === "\u2212" ? "subtract" : "add"
          } ${c}.`,
          l3: l3Text,
          l4: `${a} ${firstOp} ${b} ${secondOp} ${c} = ${value}. The badge reads ${value}.`,
        },
    "expression-evaluate",
  );
}

// --- ratio-proportion ------------------------------------------------------------

function genRecipe(ctx: GenContext): GeneratedEvidence {
  const { culprit, rng } = ctx;
  const baseServings = pickInt(rng, 2, 4);
  const k = pickInt(rng, 2, 4);
  const targetServings = baseServings * k;
  const amountPerBase = pickInt(rng, 1, 3);
  const ingredient = pickFrom(rng, ["oats", "flour", "raisins", "lemonade"]);
  const unit = "cups";
  const needed = amountPerBase * k;
  const pricePerCup = pickInt(rng, 5, 19) * 5;
  const costCents = needed * pricePerCup;
  void culprit;
  return evidence(
    "ratio-proportion",
    `Scale the recipe. How many ${unit} of ${ingredient}?`,
    {
      kind: "recipeScale",
      baseServings,
      targetServings,
      ingredient,
      amountPerBase,
      unit,
    },
    { type: "number", value: needed, unit },
    thresholdConstraint(
      "c-budget",
      "walletCents",
      ">=",
      costCents,
      `Could pay ${usd(costCents)} for supplies`,
      `The culprit had at least ${usd(costCents)} to buy ${needed} ${unit} of ${ingredient}.`,
    ),
    {
      l1: "Compare the servings to find how many times bigger the new batch is.",
      l2: "Multiply the per-batch amount by that same number of times.",
      l3: "Try this one first: 5 cups for 5 servings becomes 20 cups for 20 servings.",
      l4: `${amountPerBase} \u00D7 ${k} = ${needed} ${unit} of ${ingredient}.`,
    },
    "recipe-scale",
  );
}

// --- stats-summary -----------------------------------------------------------------

function genStats(ctx: GenContext): GeneratedEvidence {
  const { culprit, rng, suspects, liveAttrs } = ctx;
  const cSteps = culprit.attrs.stepsAvg;

  // The roster assigns unique step averages, so a "culprit equals median"
  // constraint would always reduce the board to one suspect — final-slot
  // only, which the builder can never place. Give one LIVE twin suspect the
  // culprit's value instead: the constraint keeps exactly the pair and
  // eliminates everyone else (mirrors the receipt's spend rewrite).
  const twin = suspects.find((s) => s.id !== culprit.id && liveAttrs.includes(s.attrs));
  if (!twin) throw new Error("stats-unavailable: no live twin suspect");
  twin.attrs.stepsAvg = cSteps;

  // Median construction: one/two readings below and above cSteps make the
  // culprit's value the sample median by construction.
  const others = suspects.filter((s) => s.attrs !== culprit.attrs && s.attrs !== twin.attrs);
  const below = shuffled(rng, others.filter((s) => s.attrs.stepsAvg < cSteps).map((s) => s.attrs.stepsAvg));
  const above = shuffled(rng, others.filter((s) => s.attrs.stepsAvg > cSteps).map((s) => s.attrs.stepsAvg));
  let picked: number[];
  if (below.length >= 2 && above.length >= 2) {
    picked = [below[0]!, below[1]!, above[0]!, above[1]!];
  } else if (below.length >= 1 && above.length >= 1) {
    picked = [below[0]!, above[0]!];
  } else {
    // No valid median construction against this roster — let the builder
    // skip the candidate for this slot.
    throw new Error("stats-unavailable: no below/above pairing around culprit");
  }
  const readings = shuffled(rng, [cSteps, ...picked]);
  const sorted = [...readings].sort((x, y) => x - y);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  return evidence(
    "stats-summary",
    "Find the median of the step averages.",
    { kind: "statList", unit: "steps", readings },
    { type: "number", value: median, unit: "steps" },
    {
      id: "c-steps",
      chip: `Averages ${median} steps`,
      sentence: `The culprit's step average is the median, ${median}.`,
      kind: "equals",
      attr: "stepsAvg",
      value: median,
      test: (a) => a.stepsAvg === median,
    },
    {
      l1: "Line the numbers up from smallest to largest first.",
      l2: "The median is the middle number once they are ordered.",
      l3: "Try this one first: the median of 3, 9, 4 is 4.",
      l4: `Ordered, the middle value is ${median} \u2014 that is the median.`,
    },
    "median-find",
  );
}

// --- probability-claims ----------------------------------------------------------------

function genClaims(ctx: GenContext): GeneratedEvidence {
  const { rng } = ctx;
  // The house rule rules claims out past 1-in-20 odds, so the generated
  // outcome count must exceed 20 for the constraint to hold (flips ≥ 5).
  const flips = pickInt(rng, 5, 6);
  const outcomes = 2 ** flips;
  return evidence(
    "probability-claims",
    "All flips heads! Enter the number in \u201C1 in __\u201D.",
    {
      kind: "claimCard",
      claim: `${flips} coin flips, all heads! Odds: 1 in ___`,
      flips,
    },
    { type: "number", value: outcomes, unit: "outcomes" },
    {
      id: "c-claim",
      chip: "Did not make the wild claim",
      sentence: "Anything less likely than 1 in 20 gets ruled out \u2014 the culprit stayed quiet.",
      kind: "equals",
      attr: "madeClaim",
      value: false,
      test: (a) => !a.madeClaim,
    },
    {
      l1: "Each flip has 2 results. Multiply 2 by itself for every flip.",
      l2: `You need 2 \u00D7 2 \u2026 ${flips} times. Write the product.`,
      l3: "Try this one first: 2 flips give 2 \u00D7 2 = 4 outcomes.",
      l4: `2^${flips} = ${outcomes}, so the odds are 1 in ${outcomes} \u2014 past the 1-in-20 cutoff, so the claim gets ruled out.`,
    },
    "compound-outcomes",
  );
}

export const STATION_GENERATORS: Record<SkillId, StationGenerator> = {
  "measure-length": genMeasure,
  "time-elapsed": genTimeElapsed,
  "data-tables": genDataTable,
  "expressions-codes": genExpression,
  "money-receipts": genReceipt,
  "fractions-parts": genFractions,
  "grid-coordinates": genGrid,
  "ratio-proportion": genRecipe,
  "stats-summary": genStats,
  "probability-claims": genClaims,
};
