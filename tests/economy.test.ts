import { describe, it, expect } from "vitest";
import { createGame, act, closeDay } from "../src/engine/game";
import { quantity, inventoryValue } from "../src/engine/inventory";
import { demand, priceBounds } from "../src/engine/economy";
import { PRODUCTS } from "../src/engine/config";
const buy = (s: ReturnType<typeof createGame>, product = "healing", qty = 1) =>
  act(s, { type: "buy", product, qty }).state;
describe("economy and transactions", () => {
  it("starts at the specified state and net assets", () => {
    const s = createGame(42);
    expect([s.day, s.cash, s.debt, s.capacity, s.risk]).toEqual([
      1, 500, 300, 30, 0,
    ]);
    expect(inventoryValue(s) - s.debt + s.cash).toBe(200);
  });
  it("charges fixed daily quote, adds a dated batch and never mutates input", () => {
    const s = createGame(42),
      p = s.market.healing.buy;
    const n = buy(s, "healing", 2);
    expect(n.cash).toBe(500 - 2 * p);
    expect(quantity(n, "healing")).toBe(2);
    expect(n.batches[0].day).toBe(1);
    expect(s.batches).toEqual([]);
    expect(n.market.healing.buy).toBe(p);
  });
  it("rejects bad quantities, ids, insufficient cash and supply", () => {
    for (const qty of [-1, 0, 0.1, NaN, Infinity, 1000]) {
      const s = createGame(42);
      expect(
        act(s, { type: "buy", product: "healing", qty }).error,
      ).toBeTruthy();
    }
    expect(
      act(createGame(1), { type: "buy", product: "oops", qty: 1 }).error,
    ).toBeTruthy();
    const s = createGame(2);
    s.cash = 0;
    expect(
      act(s, { type: "buy", product: "healing", qty: 1 }).error,
    ).toBeTruthy();
  });
  it("enforces capacity", () => {
    const s = createGame(2);
    s.capacity = 1;
    expect(quantity(buy(s, "healing", 2), "healing")).toBe(0);
  });
  it("enforces daily supply across repeated purchases", () => {
    let s = createGame(2);
    s.cash = 10000;
    const cap = s.market.healing.supply;
    s = buy(s, "healing", cap);
    expect(
      act(s, { type: "buy", product: "healing", qty: 1 }).error,
    ).toBeTruthy();
  });
  it("validates price boundaries and demand is price sensitive", () => {
    const s = createGame(2),
      m = s.market.healing,
      [low, high] = priceBounds(m.reference);
    expect(
      act(s, { type: "price", product: "healing", price: low - 1 }).error,
    ).toBeTruthy();
    expect(
      act(s, { type: "price", product: "healing", price: high + 1 }).error,
    ).toBeTruthy();
    expect(demand(PRODUCTS.healing, m, low, 1)).toBeGreaterThan(
      demand(PRODUCTS.healing, m, high, 1),
    );
    expect(
      demand(PRODUCTS.invisibility, s.market.invisibility, high * 10, 0.85),
    ).toBe(0);
  });
  it("sells only stock; FIFO and cost basis reconcile", () => {
    let s = createGame(9);
    s.batches = [
      { id: "old", product: "healing", qty: 1, cost: 10, day: 1 },
      { id: "new", product: "healing", qty: 2, cost: 20, day: 1 },
    ];
    s.prices.healing = s.market.healing.reference;
    const n = closeDay(s, 1).state;
    expect(quantity(n, "healing")).toBe(0);
    expect(n.ledger[0].cogs).toBe(50);
    expect(n.ledger[0].revenue).toBe(s.prices.healing * 3);
  });
  it("expires healing at end of seventh day after last valid sale", () => {
    let s = createGame(3);
    s.day = 7;
    s.batches = [{ id: "old", product: "healing", qty: 10, cost: 20, day: 1 }];
    const n = closeDay(s, 7).state;
    expect(quantity(n, "healing")).toBe(0);
    expect(n.ledger[0].expired).toBeGreaterThan(0);
    expect(n.ledger[0].sales.healing).toBeGreaterThan(0);
  });
  it("never sells already expired batches", () => {
    const s = createGame(3);
    s.day = 8;
    s.batches = [{ id: "old", product: "healing", qty: 3, cost: 20, day: 1 }];
    const n = closeDay(s, 8).state;
    expect(n.ledger[0].sales.healing).toBe(0);
    expect(n.ledger[0].expired).toBe(3);
  });
  it("rejects duplicate/stale settlement and requires report acknowledgement", () => {
    const s = createGame(3),
      n = closeDay(s, 1).state;
    expect(n.day).toBe(2);
    expect(closeDay(n, 1).error).toBeTruthy();
    expect(closeDay(n, 2).error).toBeTruthy();
    expect(
      act(n, { type: "buy", product: "healing", qty: 1 }).error,
    ).toBeTruthy();
    expect(closeDay(act(n, { type: "ack" }).state, 2).state.day).toBe(3);
  });
  it("reproduces daily prices and results with seed", () => {
    let a = createGame(99),
      b = createGame(99);
    for (let i = 0; i < 12; i++) {
      a = act(closeDay(buy(a), a.day).state, { type: "ack" }).state;
      b = act(closeDay(buy(b), b.day).state, { type: "ack" }).state;
    }
    expect(a).toEqual(b);
  });
});
it("keeps previous snapshots immutable across many transactions and event days", () => {
  function freeze<T>(x: T): T {
    if (x && typeof x === "object") {
      Object.freeze(x);
      for (const v of Object.values(x)) freeze(v);
    }
    return x;
  }
  let s = createGame(19);
  for (let day = 0; day < 25 && s.status !== "ended"; day++) {
    const before = JSON.stringify(s);
    freeze(s);
    const bought = act(s, { type: "buy", product: "healing", qty: 1 }).state;
    const n = closeDay(bought, bought.day).state;
    expect(JSON.stringify(s)).toBe(before);
    s = act(n, { type: "ack" }).state;
  }
});
