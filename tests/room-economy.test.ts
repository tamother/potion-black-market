import { it, expect } from "vitest";
import { createGame, act, closeDay, netAssets } from "../src/engine/game";
import { encode, decode } from "../src/engine/persistence";
import { makeOrder } from "../src/engine/events";
it("hiring is paid once, saved, and reconciles cash, profit and net assets", () => {
  const s = createGame(7),
    n = act(s, { type: "hire-accountant" }).state;
  expect(n.accountantHiredDay).toBe(1);
  expect(n.cash).toBe(380);
  expect(n.actions).toBe(0);
  expect(s.accountantHiredDay).toBe(null);
  expect(s.cash).toBe(500);
  expect(act(n, { type: "hire-accountant" }).error).toBeTruthy();
  expect(decode(encode(n))).toEqual(n);
  const end = closeDay(n, 1).state,
    r = end.ledger[0];
  expect(r.staffCost).toBe(120);
  expect(r.cashFlow).toBe(-146);
  expect(r.operatingProfit).toBe(-146);
  expect(netAssets(end)).toBe(netAssets(s) - 146);
});
it("hiring cannot happen with insufficient funds, debt default, ended game or pending report", () => {
  const s = createGame(2);
  s.cash = 119;
  expect(act(s, { type: "hire-accountant" }).error).toBeTruthy();
  s.cash = 500;
  s.status = "default";
  s.arrears = 12;
  s.defaultSince = 1;
  expect(act(s, { type: "hire-accountant" }).error).toBeTruthy();
  s.status = "ended";
  expect(act(s, { type: "hire-accountant" }).error).toBeTruthy();
  const n = closeDay(createGame(3), 1).state;
  expect(act(n, { type: "hire-accountant" }).error).toBeTruthy();
});
it("legacy saves gain no accountant and no phantom staff expense", () => {
  const raw = JSON.parse(encode(closeDay(createGame(3), 1).state));
  delete raw.state.accountantHiredDay;
  delete raw.state.book.staffCost;
  delete raw.state.ledger[0].staffCost;
  const s = decode(JSON.stringify(raw));
  expect(s.accountantHiredDay).toBe(null);
  expect(s.book.staffCost).toBe(0);
  expect(s.cash).toBe(484);
  const bad = JSON.parse(encode(createGame(2)));
  bad.state.accountantHiredDay = 8;
  expect(() => decode(JSON.stringify(bad))).toThrow();
});
it("every new day has a commission and ordinary orders evolve from the introductory quote", () => {
  let s = createGame(8);
  s.cash = 10000;
  for (let i = 0; i < 15; i++) {
    expect(s.orders.length).toBeGreaterThan(0);
    for (const o of s.orders.filter(
      (o) => o.kind === "guild" || o.kind === "royal",
    ))
      if (s.day <= 3)
        expect(o.reward).toBe(
          Math.round(
            (o.kind === "guild" ? 66 : 112) * s.market[o.product].factor,
          ),
        );
      else
        expect(
          o.reward / (s.market[o.product].reference * o.qty),
        ).toBeGreaterThanOrEqual(0.81);
    const o = makeOrder(s, "guild");
    expect(o.bulkRatio).toBeUndefined();
    s = act(closeDay(s, s.day).state, { type: "ack" }).state;
  }
});
