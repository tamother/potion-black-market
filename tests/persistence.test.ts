import { it, expect } from "vitest";
import { createGame, act, closeDay } from "../src/engine/game";
import {
  encode,
  decode,
  saveGame,
  loadGame,
  SAVE_KEY,
} from "../src/engine/persistence";
it("round trips full state with pending consequences and RNG", () => {
  let s = createGame(81);
  s = act(s, { type: "buy", product: "healing", qty: 2 }).state;
  s = closeDay(s, 1).state;
  expect(decode(encode(s))).toEqual(s);
  expect(act(decode(encode(s)), { type: "ack" }).state).toEqual(
    act(s, { type: "ack" }).state,
  );
});
it("refuses corrupt, future-version and structurally invalid saves", () => {
  for (const x of [
    "oops",
    "{}",
    "null",
    JSON.stringify({ format: 99, state: createGame(1) }),
  ])
    expect(() => decode(x)).toThrow();
  for (const edit of [
    (s: any) => (s.cash = -1),
    (s: any) => (s.debt = NaN),
    (s: any) => (s.rng = "bad"),
    (s: any) => (s.market.healing.remaining = 99),
    (s: any) => (s.chains.war.stage = "oops"),
    (s: any) => (s.book.purchases = -10),
    (s: any) => (s.orders = [{ id: "x" }]),
    (s: any) => (s.delayed = [{ kind: "free-money" }]),
    (s: any) => (s.effects = [{ buy: { healing: Infinity } }]),
    (s: any) => (s.log = [null]),
    (s: any) => (s.ledger = [{}]),
    (s: any) => (s.stats = null),
  ]) {
    const s = createGame(1);
    edit(s);
    expect(() => decode(JSON.stringify({ format: 2, state: s }))).toThrow();
  }
});
it("migrates known v1 envelope without changing economic data", () => {
  const s = createGame(7);
  const old: any = structuredClone(s);
  old.version = 1;
  delete old.financeUsed;
  expect(decode(JSON.stringify({ format: 1, state: old }))).toEqual(s);
});
it("save reload cannot repeat orders or end-day and keeps same RNG", () => {
  let s = createGame(12);
  s = closeDay(s, 1).state;
  const n = decode(encode(s));
  expect(closeDay(n, 1).error).toBeTruthy();
  expect(n.rng).toBe(s.rng);
});
it("storage unavailability and cross-tab conflicts are explicit", () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
  let s = createGame(12);
  expect(saveGame(storage, s)).toBeNull();
  expect(loadGame(storage).state).toEqual(s);
  const old = s;
  s = act(s, { type: "buy", product: "healing", qty: 1 }).state;
  expect(
    saveGame(storage, s, { seed: old.seed, revision: old.revision }),
  ).toBeNull();
  expect(
    saveGame(storage, old, { seed: old.seed, revision: old.revision }),
  ).toMatch(/其他/);
  expect(
    loadGame({
      getItem: () => {
        throw new Error("disabled");
      },
    }).error,
  ).toBeTruthy();
  expect(
    saveGame(
      {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota");
        },
      },
      s,
    ),
  ).toBeTruthy();
  expect(data.has(SAVE_KEY)).toBe(true);
});
it("rejects report phase without a matching settled-day ledger", () => {
  const s = createGame(1);
  s.phase = "report";
  expect(() => decode(encode(s))).toThrow();
  const n = closeDay(createGame(1), 1).state;
  n.day = 5;
  expect(() => decode(encode(n))).toThrow();
});
