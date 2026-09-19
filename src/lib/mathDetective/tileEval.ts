/**
 * Math Detective — tile-equation evaluator (constructed-response station,
 * benchmark gap G2). The child builds ANY valid expression from single-digit
 * and operator tiles that evaluates to the badge target; multi-solution by
 * design. Pure functions; used by the shell before dispatching the numeric
 * SUBMIT_ANSWER the engine already understands.
 */

export type TileOp = "+" | "\u2212" | "\u00D7";

export type TileToken = { t: "num"; v: number } | { t: "op"; v: TileOp };

export const TILE_OPS: readonly TileOp[] = ["+", "\u2212", "\u00D7"];

export function isTileOp(tile: string): tile is TileOp {
  return (TILE_OPS as readonly string[]).includes(tile);
}

/**
 * Evaluate a tile sequence with × before +/−. Returns null for sequences
 * that are empty, start/end on an operator, or contain adjacent same-kind
 * tokens (the UI cannot produce those, but the evaluator stays total).
 */
export function evaluateTileExpression(tiles: readonly string[]): number | null {
  if (tiles.length === 0 || tiles.length % 2 === 0) return null;
  const tokens: TileToken[] = [];
  for (let i = 0; i < tiles.length; i += 1) {
    const tile = tiles[i]!;
    if (i % 2 === 0) {
      const v = Number(tile);
      if (!Number.isInteger(v) || v < 0 || v > 9) return null;
      tokens.push({ t: "num", v });
    } else {
      if (!isTileOp(tile)) return null;
      tokens.push({ t: "op", v: tile });
    }
  }
  // Fold × first.
  const terms: Array<{ op: "+" | "\u2212"; value: number }> = [];
  let pendingProduct = tokens[0]!.t === "num" ? tokens[0]!.v : 0;
  let pendingOp: "+" | "\u2212" = "+";
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i]!;
    const num = tokens[i + 1]!;
    if (op.t !== "op" || num.t !== "num") return null;
    if (op.v === "\u00D7") {
      pendingProduct = pendingProduct * num.v;
    } else {
      terms.push({ op: pendingOp, value: pendingProduct });
      pendingOp = op.v as "+" | "\u2212";
      pendingProduct = num.v;
    }
  }
  terms.push({ op: pendingOp, value: pendingProduct });
  return terms.reduce((sum, t) => (t.op === "+" ? sum + t.value : sum - t.value), 0);
}
