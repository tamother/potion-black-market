import { describe, it, expect } from "vitest";
import { createGame, act, closeDay, netAssets } from "../src/engine/game";
import { encode, decode } from "../src/engine/persistence";
import { RULES } from "../src/engine/config";
import {
  resolveHazard,
  prepareHazard,
  merchantAvailable,
} from "../src/engine/hazards";

it("charges10G salary each closing including hire day and never in report acknowledgement", () => {
  let s = act(createGame(8), { type: "hire-accountant" }).state;
  let r = closeDay(s, 1).state;
  expect(r.ledger[0].staffSalary).toBe(10);
  expect(r.ledger[0].staffCost).toBe(120);
  expect(r.cash).toBe(500 - 120 - 12 - 4 - 10);
  const c = r.cash;
  r = act(r, { type: "ack" }).state;
  expect(r.cash).toBe(c);
  r = closeDay(r, 2).state;
  expect(r.cash).toBe(c - 12 - 4 - 10);
  expect(r.ledger[1].staffSalary).toBe(10);
});
it("discloses care, handling, storage and weekly costs and conserves profit/assets/cash", () => {
  const s = createGame(8);
  s.batches = [{ id: "stock", product: "mana", qty: 10, cost: 30, day: 1 }];
  const n = closeDay(s, 1).state,
    r = n.ledger[0];
  expect(r.careCost).toBe(4);
  expect(r.serviceCost).toBe(r.sales.mana * 2);
  expect(r.storageCost).toBe(r.stock);
  expect(r.runningPaid).toBe(4 + r.serviceCost! + r.storageCost!);
  expect(r.cashFlow).toBe(r.revenue - r.fixedPaid - r.runningPaid!);
  expect(netAssets(n) - netAssets(s)).toBe(r.operatingProfit);
  const t = createGame(8);
  t.day = 7;
  const weekly = closeDay(t, 7).state.ledger[0];
  expect(weekly.permitCost).toBe(30);
});
it("unpaid salary and operating costs enter the same rescue deadline without negative cash", () => {
  const s = act(createGame(8), { type: "hire-accountant" }).state;
  s.cash = 3;
  s.book.openingCash = 3;
  const n = closeDay(s, 1).state;
  expect(n.cash).toBe(0);
  expect(n.arrears).toBe(23);
  expect(n.defaultSince).toBe(1);
  expect(n.status).toBe("default");
  expect(n.ledger[0].fixedPaid).toBe(3);
  expect(n.ledger[0].runningPaid).toBe(0);
});
it("merchant offers crystal only after five full days and returns if not purchased", () => {
  const s = createGame(8);
  s.day = 5;
  expect(merchantAvailable(s)).toBe(false);
  expect(act(s, { type: "buy-crystal" }).error).toBeTruthy();
  s.day = 6;
  expect(merchantAvailable(s)).toBe(true);
  let n = act(s, { type: "buy-crystal" }).state;
  expect(n.cash).toBe(500 - RULES.crystalUnlock);
  expect(n.book.crystalCost).toBe(RULES.crystalUnlock);
  expect(n.crystalUnlockedDay).toBe(6);
  expect(act(n, { type: "buy-crystal" }).error).toBeTruthy();
  expect(merchantAvailable(n)).toBe(false);
  s.day = 7;
  expect(merchantAvailable(s)).toBe(false);
  s.day = 9;
  expect(merchantAvailable(s)).toBe(true);
});
it("ward charges once, persists on reload, expires by date and cannot be bought on calm days", () => {
  const s = createGame(8);
  s.day = 6;
  s.omen = { kind: "theft", chance: 0.44 };
  let n = act(s, { type: "buy-crystal" }).state;
  const cash = n.cash,
    rng = n.rng;
  n = act(n, { type: "ward" }).state;
  expect(n.cash).toBe(cash - RULES.crystalUse);
  expect(n.rng).toBe(rng);
  expect(n.wardDay).toBe(6);
  expect(act(n, { type: "ward" }).error).toBeTruthy();
  expect(decode(encode(n)).wardDay).toBe(6);
  n.day = 7;
  n.omen = { kind: null, chance: 0 };
  expect(act(n, { type: "ward" }).error).toBeTruthy();
});
describe("losses and protection", () => {
  for (const kind of ["theft", "spill", "blackout", "repair"] as const)
    it(`${kind} has an actual bounded effect`, () => {
      const s = createGame(8);
      s.day = 6;
      s.omen = { kind, chance: 0.44 };
      s.batches = [{ id: "stock", product: "mana", qty: 5, cost: 35, day: 1 }];
      const r = resolveHazard(s, 0.05, 0.5, 0.1)!;
      expect(r.triggered).toBe(true);
      expect(s.lastIncidentDay).toBe(6);
      if (kind === "theft") {
        expect(s.cash).toBe(420);
        expect(r.cashLost).toBe(80);
      }
      if (kind === "spill") {
        expect(s.batches[0].qty).toBe(3);
        expect(r.stockCost).toBe(70);
      }
      if (kind === "blackout") expect(r.demandFactor).toBe(0.65);
      if (kind === "repair") expect(r.repairCost).toBe(48);
    });
  it("uses the same roll with60% relative risk reduction, never claims guaranteed prevention", () => {
    const s = createGame(8);
    s.day = 6;
    s.omen = { kind: "theft", chance: 0.44 };
    s.crystalUnlockedDay = 6;
    s.wardDay = 6;
    const protectedState = structuredClone(s);
    const r = resolveHazard(protectedState, 0.25, 0.5, 0.1)!;
    expect(r.actualChance).toBeCloseTo(0.176);
    expect(r.triggered).toBe(false);
    expect(r.averted).toBe(true);
    expect(protectedState.cash).toBe(500);
    expect(resolveHazard(structuredClone(s), 0.01, 0.5, 0.1)!.triggered).toBe(
      true,
    );
  });
  it("opening days and day after an incident are calm, and forecast is reproducible", () => {
    const s = createGame(8);
    prepareHazard(s);
    expect(s.omen.kind).toBe(null);
    s.day = 2;
    prepareHazard(s);
    expect(s.omen.chance).toBe(0);
    s.day = 6;
    s.lastIncidentDay = 5;
    prepareHazard(s);
    expect(s.omen.chance).toBe(0);
    s.day = 7;
    const t = structuredClone(s);
    prepareHazard(s);
    prepareHazard(t);
    expect(s.omen).toEqual(t.omen);
    expect(s.omen.kind).not.toBe(null);
  });
});
it("old saves retain true history and gain no free crystal or charges", () => {
  const raw = JSON.parse(encode(createGame(8)));
  for (const k of ["omen", "crystalUnlockedDay", "wardDay", "lastIncidentDay"])
    delete raw.state[k];
  delete raw.state.book.crystalCost;
  const s = decode(JSON.stringify(raw));
  expect(s.crystalUnlockedDay).toBe(null);
  expect(s.wardDay).toBe(0);
  expect(s.omen).toEqual({ kind: null, chance: 0 });
  expect(s.book.crystalCost).toBe(0);
  raw.state.wardDay = 99;
  expect(() => decode(JSON.stringify(raw))).toThrow();
});

it("blackout details roundtrip with effective demand while retaining original market quotes", () => {
  const s = createGame(8);
  s.day = 6;
  s.omen = { kind: "blackout", chance: 1 };
  s.batches = [{ id: "stock", product: "healing", qty: 8, cost: 20, day: 1 }];
  const before = structuredClone(s),
    n = closeDay(s, 6).state,
    r = n.ledger[0];
  expect(r.incident?.demandFactor).toBe(0.65);
  expect(r.saleDetails?.healing.eventMultiplier).toBe(
    s.market.healing.demand * 0.65,
  );
  expect(r.quotes.healing.demand).toBe(s.market.healing.demand);
  expect(decode(encode(n))).toEqual(n);
  expect(s).toEqual(before);
});
it("keeps incident and operating charge notes when the bounded history is full", () => {
  const s = createGame(8);
  s.day = 6;
  s.omen = { kind: "repair", chance: 1 };
  s.log = Array.from({ length: 600 }, (_, i) => ({
    id: `past-${i}`,
    day: 1,
    kind: "world" as const,
    text: "旧时的纪事",
  }));
  const n = closeDay(s, 6).state,
    r = n.ledger[0];
  expect(r.incident?.triggered).toBe(true);
  expect(r.notes.join("")).toContain("修缮费用");
  expect(r.notes.join("")).toContain("今日经营费用");
  expect(r.notes.join("")).not.toContain("旧时的纪事");
  expect(n.log.length).toBe(600);
});
for (const kind of ["theft", "spill", "blackout", "repair"] as const)
  it(`${kind} closing reconciles accrued profit, actual payments and saved inventory under both cash levels`, () => {
    for (const cash of [0, 500]) {
      const s = createGame(8);
      s.day = 6;
      s.cash = cash;
      s.book.openingCash = cash;
      s.omen = { kind, chance: 1 };
      s.batches = [
        { id: "inventory", product: "mana", qty: 5, cost: 35, day: 1 },
      ];
      const n = closeDay(s, 6).state,
        r = n.ledger[0];
      expect(r.incident?.triggered).toBe(true);
      expect(r.operatingProfit).toBe(netAssets(n) - netAssets(s));
      expect(r.cashFlow).toBe(
        r.revenue -
          r.fixedPaid -
          (r.runningPaid ?? 0) -
          (r.incidentCashCost ?? 0),
      );
      expect(decode(encode(n))).toEqual(n);
      expect(n.cash).toBeGreaterThanOrEqual(0);
    }
  });
