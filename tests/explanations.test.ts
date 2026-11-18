import { it, expect } from "vitest";
import { createGame, act, closeDay } from "../src/engine/game";
import { PRODUCTS } from "../src/engine/config";
import { IDS } from "../src/engine/types";
import { demand, demandBreakdown, demandRange } from "../src/engine/economy";
import { makeOrder } from "../src/engine/events";
import {
  orderTradeoff,
  salesReason,
  profitExplanation,
} from "../src/engine/explanations";
import { encode, decode } from "../src/engine/persistence";
it("persists exact sales explanation without changing realized demand", () => {
  const s = createGame(91);
  s.batches = [{ id: "lot", product: "healing", qty: 10, cost: 20, day: 1 }];
  s.prices.healing = Math.floor(s.market.healing.reference * 1.5);
  const n = closeDay(s, 1).state,
    r = n.ledger[0],
    d = r.saleDetails!.healing;
  expect(d.stock).toBe(10);
  expect(d.sold).toBe(r.sales.healing);
  expect(d.potential).toBe(
    demand(PRODUCTS.healing, s.market.healing, s.prices.healing, d.noise),
  );
  expect(d.priceFactor).toBeCloseTo(
    2 - s.prices.healing / s.market.healing.reference,
  );
  expect(d.revenue).toBe(d.sold * s.prices.healing);
  expect(d.cogs).toBe(d.sold * 20);
  expect(
    IDS.reduce((sum, id) => sum + r.saleDetails![id].revenue, 0) +
      r.orderRevenue,
  ).toBe(r.revenue);
  expect(decode(encode(n))).toEqual(n);
});
it("explains zero sales when fractional low demand floors below one", () => {
  const s = createGame(1),
    m = s.market.invisibility,
    p = PRODUCTS.invisibility;
  const d = demandBreakdown(p, m, Math.floor(m.reference * 1.6), 0.85);
  expect(d.raw).toBeLessThan(1);
  expect(d.potential).toBe(0);
  const detail = { ...d, stock: 5, sold: 0, revenue: 0, cogs: 0, expired: 0 };
  expect(salesReason(detail)).toMatch(/不足 1 瓶/);
});
it("distinguishes stock limits from low demand", () => {
  const s = createGame(1);
  const d = demandBreakdown(
    PRODUCTS.healing,
    s.market.healing,
    s.market.healing.reference,
    1,
  );
  expect(
    salesReason({ ...d, stock: 1, sold: 1, revenue: 28, cogs: 20, expired: 0 }),
  ).toMatch(/库存只有 1 瓶/);
  expect(
    salesReason({
      ...d,
      stock: 10,
      sold: 4,
      revenue: 112,
      cogs: 80,
      expired: 0,
    }),
  ).toMatch(/需求为 4 瓶/);
});
it("offers a demand range that responds to price", () => {
  const s = createGame(1),
    m = s.market.healing;
  const a = demandRange(PRODUCTS.healing, m, m.reference),
    b = demandRange(PRODUCTS.healing, m, Math.floor(m.reference * 1.6));
  expect(a.max).toBeGreaterThan(b.max);
  expect(a.min).toBeLessThanOrEqual(a.max);
});
it("profit explanation ties sales receipts, actual cost and fixed costs together", () => {
  let s = createGame(19);
  s = act(s, { type: "buy", product: "healing", qty: 2 }).state;
  const r = closeDay(s, 1).state.ledger[0];
  const text = profitExplanation(r);
  expect(text).toContain(String(r.revenue));
  expect(text).toContain(String(r.cogs));
  expect(text).toContain(String(r.operatingProfit));
  expect(text).toContain("12");
  expect(text).toContain("库存");
});
it("ordinary offers restore their original quote without random bulk markup", () => {
  for (let seed = 1; seed < 60; seed++) {
    const s = createGame(seed),
      o = makeOrder(s, "guild");
    expect(o.reward).toBe(Math.round(66 * s.market.healing.factor));
    expect(o.bulkRatio).toBeUndefined();
  }
});
it("shows actual FIFO cost plus explicit remaining purchase cost before accepting", () => {
  const s = createGame(2);
  s.batches = [{ id: "old", product: "healing", qty: 1, cost: 30, day: 1 }];
  const o = makeOrder(s, "guild"),
    a = orderTradeoff(s, o);
  expect(a.cost).toBe(30 + s.market.healing.buy);
  expect(a.needBuy).toBe(1);
  expect(a.grossProfit).toBe(o.reward - a.cost);
  expect(a.retailValue).toBe(o.qty * s.prices.healing);
  expect(a.refusal).toContain("不扣声望");
});
it("acceptance preview matches actual order COGS; refusal is a real free choice", () => {
  const s = createGame(2);
  s.batches = [{ id: "old", product: "healing", qty: 2, cost: 31, day: 1 }];
  s.orders = [makeOrder(s, "guild")];
  const o = s.orders[0],
    a = orderTradeoff(s, o);
  const n = act(s, { type: "order", id: o.id, accept: true }).state;
  expect(n.book.orderRevenue - n.book.orderCogs).toBe(a.grossProfit);
  const refused = act(s, { type: "order", id: o.id, accept: false }).state;
  expect([refused.cash, refused.actions, refused.reputation.guild]).toEqual([
    s.cash,
    0,
    0,
  ]);
  expect(refused.batches).toEqual(s.batches);
  expect(refused.orders[0].status).toBe("declined");
});
it("loads old ledgers without fabricating historical demand and rejects invalid new details", () => {
  const n = closeDay(createGame(3), 1).state;
  delete n.ledger[0].saleDetails;
  expect(decode(encode(n))).toEqual(n);
  const x = closeDay(createGame(3), 1).state;
  x.ledger[0].saleDetails!.healing.noise = 5;
  expect(() => decode(encode(x))).toThrow();
});
it("new-day bulk quotes use the displayed reference and stay fixed during planning", () => {
  let s = createGame(18);
  s.cash = 10000;
  let seen = 0;
  for (let day = 0; day < 20; day++) {
    s = act(closeDay(s, s.day).state, { type: "ack" }).state;
    for (const o of s.orders.filter(
      (o) => o.kind === "guild" || o.kind === "royal",
    )) {
      seen++;
      expect(o.bulkRatio).toBeUndefined();
      if (s.day <= 3)
        expect(o.reward).toBe(
          Math.round(
            (o.kind === "guild" ? 66 : 112) * s.market[o.product].factor,
          ),
        );
      else {
        expect(o.qty).toBeGreaterThanOrEqual(2);
        expect(o.qty).toBeLessThanOrEqual(4);
        const ratio = o.reward / (s.market[o.product].reference * o.qty);
        expect(ratio).toBeGreaterThanOrEqual(0.81);
        expect(ratio).toBeLessThanOrEqual(1.13);
      }
      const before = o.reward;
      s = act(s, {
        type: "price",
        product: o.product,
        price: s.market[o.product].reference,
      }).state;
      expect(s.orders.find((n) => n.id === o.id)!.reward).toBe(before);
    }
  }
  expect(seen).toBeGreaterThan(0);
});
