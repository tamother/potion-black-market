import type { GameState, ProductId } from "./types";
export const quantity = (s: GameState, p?: ProductId) =>
  s.batches.reduce((a, b) => a + (!p || b.product === p ? b.qty : 0), 0);
export const inventoryValue = (s: GameState) =>
  s.batches.reduce((a, b) => a + b.qty * b.cost, 0);
export const validBatch = (p: ProductId, day: number, bought: number) =>
  p !== "healing" || day - bought < 7;
/** Mutates only the already-cloned turn draft. Removes FIFO lots; returns actual units and cost. */
export function consume(s: GameState, p: ProductId, wanted: number) {
  let qty = 0,
    cost = 0;
  s.batches.sort((a, b) => a.day - b.day);
  for (const b of s.batches) {
    if (b.product !== p || !validBatch(p, s.day, b.brewed ?? b.day)) continue;
    const n = Math.min(b.qty, wanted - qty);
    b.qty -= n;
    qty += n;
    cost += n * b.cost;
    if (qty === wanted) break;
  }
  s.batches = s.batches.filter((b) => b.qty > 0);
  return { qty, cost };
}
export function expire(s: GameState) {
  let qty = 0,
    cost = 0;
  s.batches = s.batches.filter((b) => {
    if (b.product === "healing" && s.day - (b.brewed ?? b.day) >= 6) {
      qty += b.qty;
      cost += b.qty * b.cost;
      return false;
    }
    return true;
  });
  return { qty, cost };
}
export function available(s: GameState, p: ProductId) {
  return s.batches.reduce(
    (a, b) =>
      a +
      (b.product === p && validBatch(p, s.day, b.brewed ?? b.day) ? b.qty : 0),
    0,
  );
}
