import { it, expect } from "vitest";
import { createGame, act, closeDay } from "../src/engine/game";
import { encode, decode } from "../src/engine/persistence";
import { remainingActions } from "../src/engine/actions";
it("limits real decisions to8 points and failed/no-op/free actions are atomic", () => {
  let s = createGame(19);
  expect(remainingActions(s)).toBe(8);
  const same = act(s, {
    type: "price",
    product: "mana",
    price: s.prices.mana,
  }).state;
  expect(remainingActions(same)).toBe(8);
  expect(act(s, { type: "buy", product: "mana", qty: 99 }).state).toBe(s);
  for (let i = 0; i < 8; i++) {
    const n = act(s, {
      type: "price",
      product: "healing",
      price: s.prices.healing === 20 ? 21 : 20,
    });
    expect(n.error).toBeUndefined();
    s = n.state;
  }
  expect(remainingActions(s)).toBe(0);
  const frozen = encode(s);
  const fail = act(s, { type: "buy", product: "mana", qty: 1 });
  expect(fail.error).toContain("行动");
  expect(fail.state).toBe(s);
  expect(encode(s)).toBe(frozen);
  expect(act(s, { type: "repay", amount: 1 }).error).toBeUndefined();
  expect(
    act(s, { type: "order", id: s.orders[0].id, accept: false }).error,
  ).toBeUndefined();
  expect(act(s, { type: "ack-news" }).error).toBeUndefined();
  expect(remainingActions(decode(encode(s)))).toBe(0);
  const next = closeDay(s, 1);
  expect(next.error).toBeUndefined();
  expect(remainingActions(next.state)).toBe(8);
});
it("charges successful purchases1, fulfillment2, hire/crystal/ward1, never retries", () => {
  let s = createGame(19);
  s.cash = 2000;
  const o = s.orders[0];
  s = act(s, { type: "buy", product: o.product, qty: o.qty }).state;
  expect(remainingActions(s)).toBe(7);
  s = act(s, { type: "order", id: o.id, accept: true }).state;
  expect(remainingActions(s)).toBe(5);
  expect(act(s, { type: "order", id: o.id, accept: true }).state).toBe(s);
  s = act(s, { type: "hire-accountant" }).state;
  expect(remainingActions(s)).toBe(4);
  s.day = 6;
  s.omen = { kind: "theft", chance: 0.44 };
  s = act(s, { type: "buy-crystal" }).state;
  expect(remainingActions(s)).toBe(3);
  s = act(s, { type: "ward" }).state;
  expect(remainingActions(s)).toBe(2);
  expect(act(s, { type: "ward" }).state).toBe(s);
});
it("migrates old budgets once and rejects invalid stored points", () => {
  const old: any = createGame(19);
  delete old.actionPointsUsed;
  old.actions = 1;
  expect(remainingActions(decode(encode(old)))).toBe(6);
  for (const n of [-1, 9, 0.5, "2"])
    expect(() =>
      decode(encode({ ...createGame(19), actionPointsUsed: n } as any)),
    ).toThrow();
});
it("zero AP cannot partially spend2 points on a delivery, yet can rescue arrears", () => {
  const s = createGame(19);
  s.actionPointsUsed = 7;
  const o = s.orders[0];
  s.batches = [
    { id: "stock", product: o.product, qty: o.qty, cost: 20, day: 1 },
  ];
  const before = encode(s);
  expect(act(s, { type: "order", id: o.id, accept: true }).error).toContain(
    "行动",
  );
  expect(encode(s)).toBe(before);
  s.actionPointsUsed = 8;
  s.status = "default";
  s.arrears = 20;
  s.defaultSince = 1;
  expect(act(s, { type: "arrears", amount: 20 }).state.status).toBe("active");
});
