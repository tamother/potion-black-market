import { it, expect, describe } from "vitest";
import { createGame, act, closeDay, netAssets } from "../src/engine/game";
import { quantity } from "../src/engine/inventory";
import {
  advanceEvents,
  makeOrder,
  investigate,
  INDEPENDENTS,
} from "../src/engine/events";
const next = (s: ReturnType<typeof createGame>) =>
  act(closeDay(s, s.day).state, { type: "ack" }).state;
describe("debt and survival", () => {
  it("capitalizes interest only each seventh day and does not charge cash", () => {
    const s = createGame(1);
    s.day = 7;
    const n = closeDay(s, 7).state;
    expect(n.debt).toBe(315);
    expect(n.cash).toBe(454);
    expect(n.ledger[0].interest).toBe(15);
    expect(n.ledger[0].cashFlow).toBe(-46);
    expect(n.ledger[0].operatingProfit).toBe(-46);
    expect(netAssets(n)).toBe(139);
  });
  it("allows partial debt repayment, rejects overpayment and negative/NaN", () => {
    const s = createGame(1);
    const n = act(s, { type: "repay", amount: 100 }).state;
    expect([n.cash, n.debt]).toEqual([400, 200]);
    for (const amount of [-1, NaN, 301, 501])
      expect(act(s, { type: "repay", amount }).error).toBeTruthy();
  });
  it("gives two subsequent closing days to remedy default and forbids buying", () => {
    const s = createGame(1);
    s.cash = 0;
    const n = next(s);
    expect(n.status).toBe("default");
    expect(n.arrears).toBe(16);
    expect(n.defaultSince).toBe(1);
    expect(
      act(n, { type: "buy", product: "healing", qty: 1 }).error,
    ).toBeTruthy();
    const m = next(n);
    expect(m.status).toBe("default");
    const end = next(m);
    expect(end.status).toBe("ended");
    expect(end.reason).toMatch(/逾期/);
  });
  it("zero cash is not bankruptcy and arrears may be repaid during grace", () => {
    const s = createGame(1);
    s.cash = 0;
    let n = next(s);
    n.cash = 60;
    n = act(n, { type: "arrears", amount: n.arrears }).state;
    expect(n.status).toBe("active");
    expect(n.arrears).toBe(0);
    expect(n.defaultSince).toBeNull();
    expect(next(n).status).toBe("active");
  });
  it("emergency finance unlocks via guild, may only be used once, is debt not revenue", () => {
    let s = createGame(1);
    s.status = "default";
    s.arrears = 12;
    s.defaultSince = 1;
    expect(act(s, { type: "finance" }).error).toBeTruthy();
    s.reputation.guild = 20;
    s = act(s, { type: "finance" }).state;
    expect(s.debt).toBe(400);
    expect(s.cash).toBe(600);
    expect(act(s, { type: "finance" }).error).toBeTruthy();
  });
});
describe("factions, risk and order safety", () => {
  it("fulfills an order immediately once, consumes real stock and action", () => {
    const s = createGame(1);
    s.batches = [{ id: "x", product: "healing", qty: 3, cost: 20, day: 1 }];
    s.orders = [makeOrder(s, "guild")];
    const o = s.orders[0],
      n = act(s, { type: "order", id: o.id, accept: true }).state;
    expect(n.cash).toBe(s.cash + o.reward);
    expect(quantity(n, "healing")).toBe(1);
    expect(n.actions).toBe(1);
    expect(n.reputation.guild).toBeGreaterThan(0);
    expect(
      act(n, { type: "order", id: o.id, accept: true }).error,
    ).toBeTruthy();
  });
  it("rejects order with insufficient stock and caps special actions at two", () => {
    const s = createGame(1);
    s.orders = [makeOrder(s, "guild")];
    expect(
      act(s, { type: "order", id: s.orders[0].id, accept: true }).error,
    ).toBeTruthy();
    s.batches = [{ id: "x", product: "healing", qty: 10, cost: 20, day: 1 }];
    s.actions = 2;
    expect(
      act(s, { type: "order", id: s.orders[0].id, accept: true }).error,
    ).toBeTruthy();
  });
  it("declining is permanent for day and costs no action", () => {
    const s = createGame(1);
    s.orders = [makeOrder(s, "guild")];
    const n = act(s, {
      type: "order",
      id: s.orders[0].id,
      accept: false,
    }).state;
    expect(n.actions).toBe(0);
    expect(
      act(n, { type: "order", id: s.orders[0].id, accept: true }).error,
    ).toBeTruthy();
  });
  it("legal day reduces risk 5; illegal sales increase risk; clamps reputation", () => {
    const s = createGame(1);
    s.risk = 40;
    expect(next(s).risk).toBe(35);
    s.chains.smuggling = {
      stage: "active",
      start: 1,
      end: 4,
      cooldown: 0,
      choice: null,
    };
    s.orders = [makeOrder(s, "smuggler")];
    s.batches = [
      { id: "x", product: "invisibility", qty: 2, cost: 60, day: 1 },
    ];
    s.reputation.black = 99;
    const n = act(s, { type: "order", id: s.orders[0].id, accept: true }).state;
    expect(n.risk).toBeGreaterThan(40);
    expect(n.reputation.black).toBe(100);
  });
  it("first offense cannot be permanently closed; repeated severe violation after warning can", () => {
    const s = createGame(1);
    s.risk = 100;
    s.illegalToday = true;
    investigate(s, 0);
    expect(s.status).not.toBe("ended");
    expect(s.warningDay).toBe(1);
    s.day = 3;
    s.risk = 100;
    s.illegalToday = true;
    investigate(s, 0);
    expect(s.status).toBe("ended");
    expect(s.reason).toMatch(/查封/);
  });
});
describe("causal event system", () => {
  it("war advances rumor to active then resolves according to supply choice", () => {
    const s = createGame(2);
    s.day = 5;
    s.chains.war = {
      stage: "rumor",
      start: 3,
      end: 0,
      cooldown: 0,
      choice: null,
    };
    advanceEvents(s);
    expect(s.chains.war.stage).toBe("active");
    expect(s.chains.war.end - s.day).toBeGreaterThanOrEqual(2);
    s.batches = [{ id: "w", product: "healing", qty: 2, cost: 20, day: 5 }];
    const o = s.orders.find((o) => o.kind === "army")!;
    expect(o).toBeTruthy();
    let n = act(s, { type: "order", id: o.id, accept: true }).state;
    expect(n.chains.war.choice).toBe("army");
    n.day += 2;
    advanceEvents(n);
    expect(n.log.some((l) => l.text.includes("军需官"))).toBe(true);
  });
  it("doctor choice uses inventory, delayed collaboration checks matching chain", () => {
    const s = createGame(2);
    s.day = 5;
    s.chains.plague = {
      stage: "rumor",
      start: 3,
      end: 0,
      cooldown: 0,
      choice: null,
    };
    advanceEvents(s);
    const o = s.orders.find((o) => o.kind === "doctor")!;
    expect(o).toBeTruthy();
    expect(
      act(s, { type: "order", id: o.id, accept: true }).error,
    ).toBeTruthy();
    s.batches = [{ id: "p", product: "antidote", qty: 2, cost: 25, day: 5 }];
    const n = act(s, { type: "order", id: o.id, accept: true }).state;
    expect(n.chains.plague.choice).toBe("help");
    n.day += 2;
    advanceEvents(n);
    expect(n.log.some((l) => l.text.includes("诊所合作"))).toBe(true);
    const count = n.log.length;
    advanceEvents(n);
    expect(n.log.length).toBe(count);
  });
  it("smuggling acceptance schedules one delayed consequence; rejection grants no reward", () => {
    const s = createGame(2);
    s.chains.smuggling = {
      stage: "active",
      start: 1,
      end: 4,
      cooldown: 0,
      choice: null,
    };
    s.orders = [makeOrder(s, "smuggler")];
    s.batches = [
      { id: "i", product: "invisibility", qty: 2, cost: 60, day: 1 },
    ];
    const n = act(s, { type: "order", id: s.orders[0].id, accept: true }).state;
    expect(n.delayed.length).toBe(1);
    const cash = n.cash;
    n.day = 3;
    advanceEvents(n);
    expect(n.delayed.length).toBe(0);
    expect(n.cash).toBe(cash);
    expect(n.log.some((l) => l.text.includes("走私"))).toBe(true);
  });
  it("delayed effect with invalid chain precondition is discarded", () => {
    const s = createGame(2);
    s.delayed = [
      {
        id: "invalid",
        due: 1,
        chain: "plague",
        start: 1,
        choice: "help",
        kind: "clinic",
      },
    ];
    advanceEvents(s);
    expect(s.reputation.guild).toBe(0);
    expect(s.delayed).toEqual([]);
  });
  it("contains six independent events with concrete market effects", () => {
    expect(INDEPENDENTS).toHaveLength(6);
    for (const e of INDEPENDENTS) {
      expect(
        Object.keys(e.buy).length +
          Object.keys(e.demand).length +
          Object.keys(e.supply).length,
      ).toBeGreaterThan(0);
    }
  });
  it("supports 100 days with conservation and bounded numbers", () => {
    let s = createGame(77);
    s.cash = 100000;
    for (let i = 0; i < 100; i++) {
      s = next(s);
      expect(s.cash).toBeGreaterThanOrEqual(0);
      expect(s.debt).toBeGreaterThanOrEqual(0);
      expect(s.risk).toBeLessThanOrEqual(100);
      expect(s.batches.every((b) => b.qty >= 0)).toBe(true);
      expect(s.status).not.toBe("ended");
    }
    expect(s.day).toBe(101);
  });
});
it("war lasts between 3 and 6 inclusive operating days", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const s = createGame(seed);
    s.day = 5;
    s.chains.war = {
      stage: "rumor",
      start: 3,
      end: 0,
      cooldown: 0,
      choice: null,
    };
    advanceEvents(s);
    const days = s.chains.war.end - s.day + 1;
    expect(days).toBeGreaterThanOrEqual(3);
    expect(days).toBeLessThanOrEqual(6);
  }
});
it("uses final grace-day ordinary sale proceeds to pay arrears and survive", () => {
  const s = createGame(10);
  s.day = 3;
  s.status = "default";
  s.defaultSince = 1;
  s.arrears = 24;
  s.cash = 0;
  s.batches = [{ id: "grace", product: "healing", qty: 3, cost: 20, day: 1 }];
  const n = closeDay(s, 3).state;
  expect(n.status).toBe("active");
  expect(n.arrears).toBe(0);
  expect(n.defaultSince).toBeNull();
  expect(n.ledger.at(-1)!.arrearsPaid).toBe(24);
});
it("final grace-day partial payment keeps original deadline and ends", () => {
  const s = createGame(10);
  s.day = 3;
  s.status = "default";
  s.defaultSince = 1;
  s.arrears = 24;
  s.cash = 10;
  const n = closeDay(s, 3).state;
  expect(n.status).toBe("ended");
  expect(n.defaultSince).toBe(1);
  expect(n.arrears).toBe(30);
});
