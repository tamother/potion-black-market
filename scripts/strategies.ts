import { usable, freeCapacity, transitValue } from "../src/engine/town";
import { remainingActions, actionCost } from "../src/engine/actions";
import type { Action } from "../src/engine/types";
import { mkdirSync, writeFileSync } from "node:fs";
import { createGame, act, closeDay, netAssets } from "../src/engine/game";
import { PRODUCTS } from "../src/engine/config";
import { IDS } from "../src/engine/types";
import type { GameState, ProductId } from "../src/engine/types";
import { available, quantity } from "../src/engine/inventory";
import { priceBounds, isIllegal } from "../src/engine/economy";
import { decode, encode } from "../src/engine/persistence";
import assert from "node:assert/strict";
export type Strategy = "conservative" | "aggressive" | "mixed";
export function play(
  s: GameState,
  strategy: Strategy,
  reserveActions = 0,
): GameState {
  const perform = (state: GameState, action: Action) =>
    actionCost(state, action) >
    Math.max(0, remainingActions(state) - reserveActions)
      ? { state }
      : act(state, action);
  if (s.phase === "report") s = perform(s, { type: "ack" }).state;
  if (s.status === "ended") return s;
  if (s.arrears && s.cash >= s.arrears)
    s = perform(s, { type: "arrears", amount: s.arrears }).state;
  if (s.status === "default" && s.reputation.guild >= 20 && !s.financeUsed) {
    s = perform(s, { type: "finance" }).state;
    if (s.cash >= s.arrears)
      s = perform(s, { type: "arrears", amount: s.arrears }).state;
  }
  const legal = IDS.filter((id) => !isIllegal(s, id));
  const orderPriority = s.orders.filter(
    (o) =>
      o.status === "open" &&
      (strategy === "aggressive" ||
        o.risk === 0 ||
        (strategy === "mixed" && s.risk < 25 && o.kind === "smuggler")),
  );
  for (const o of orderPriority) {
    if (s.actions >= 2) break;
    const missing = Math.max(0, o.qty - usable(s, o.product));
    const cost = missing * s.market[o.product].buy;
    const cogs = o.qty * s.market[o.product].buy;
    const good =
      o.kind === "doctor" ? strategy !== "aggressive" : o.reward - cogs >= 4;
    if (!good) continue;
    if (missing > 0 && s.cash - cost >= (strategy === "aggressive" ? 0 : 30))
      s = perform(s, { type: "buy", product: o.product, qty: missing }).state;
    s = perform(s, { type: "order", id: o.id, accept: true }).state;
  }
  const priority = [...IDS].sort(
    (a, b) =>
      (s.market[b].reference - s.market[b].buy) * PRODUCTS[b].demand -
      (s.market[a].reference - s.market[a].buy) * PRODUCTS[a].demand,
  );
  for (const id of priority) {
    if (strategy !== "aggressive" && !legal.includes(id)) continue;
    const m = s.market[id],
      p = PRODUCTS[id],
      [lo, hi] = priceBounds(m.reference);
    const ratio =
      strategy === "conservative" ? 1 : strategy === "aggressive" ? 1.3 : 1.03;
    const price = Math.max(lo, Math.min(hi, Math.round(m.reference * ratio)));
    s = perform(s, { type: "price", product: id, price }).state;
    const target =
      strategy === "aggressive"
        ? Math.ceil(p.demand * m.demand * (m.factor < 0.95 ? 3 : 1.6))
        : Math.max(
            1,
            Math.floor(
              p.demand * m.demand * (strategy === "conservative" ? 0.9 : 1.05),
            ),
          );
    const reserve =
      strategy === "aggressive" ? 0 : strategy === "conservative" ? 40 : 28;
    const want = Math.min(
      target - usable(s, id),
      m.remaining,
      freeCapacity(s),
      Math.floor((s.cash - reserve) / m.buy),
    );
    if (want > 0) s = perform(s, { type: "buy", product: id, qty: want }).state;
  }
  if (
    s.status === "active" &&
    s.cash > (strategy === "conservative" ? 650 : 1000) &&
    s.debt > 0
  )
    s = perform(s, {
      type: "repay",
      amount: Math.min(s.debt, s.cash - 500),
    }).state;
  return s;
}
export function assertDay(prev: GameState, s: GameState) {
  const r = s.ledger.at(-1)!;
  assert(s.cash >= 0 && Number.isSafeInteger(s.cash));
  assert(s.debt >= 0 && Number.isSafeInteger(s.debt));
  assert(quantity(s) <= s.capacity);
  assert(s.batches.every((b) => Number.isInteger(b.qty) && b.qty > 0));
  assert(s.risk >= 0 && s.risk <= 100);
  assert(Object.values(s.reputation).every((r) => r >= -100 && r <= 100));
  assert.equal(new Set(s.orders.map((o) => o.id)).size, s.orders.length);
  assert.equal(s.stats.days, prev.stats.days + 1);
  assert.equal(
    r.cashFlow,
    r.revenue -
      r.purchases -
      r.fixedPaid -
      (r.runningPaid ?? 0) -
      (r.incidentCashCost ?? 0) -
      (r.crystalCost ?? 0) -
      (r.townCost ?? 0) -
      r.fine -
      r.repaid -
      r.arrearsPaid +
      -(r.staffCost ?? 0) +
      r.finance,
  );
  assert.equal(r.profit, r.operatingProfit - r.interest);
  assert.equal(
    r.assets,
    r.cash +
      s.batches.reduce((sum, b) => sum + b.cost * b.qty, 0) +
      transitValue(s) -
      r.debt -
      r.arrears,
  );

  assert(closeDay(s, prev.day).error);
}
