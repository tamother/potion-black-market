import { newTown } from "./townTypes";
import { validateTown } from "./townValidation";
import { IDS } from "./types";
import type { GameState } from "./types";
import { integer } from "./random";
import { quantity } from "./inventory";
import { priceBounds } from "./economy";
import { RULES } from "./config";
export const SAVE_KEY = "potion-black-market-v1";
const fail = (): never => {
  throw new Error("存档格式无效或数据损坏，请重新开始；原始存档未被自动覆盖。");
};
const obj = (x: unknown): Record<string, any> =>
  x !== null && typeof x === "object" && !Array.isArray(x)
    ? (x as Record<string, any>)
    : fail();
const arr = (x: unknown): any[] => (Array.isArray(x) ? x : fail());
const int = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  if (typeof x !== "number" || !integer(x) || x < min || x > max) fail();
};
const num = (
  x: unknown,
  min = -Number.MAX_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
) => {
  if (typeof x !== "number" || !Number.isFinite(x) || x < min || x > max)
    fail();
};
const str = (x: unknown) => {
  if (typeof x !== "string" || x.length > 3000) fail();
};
const one = (x: unknown, values: readonly unknown[]) => {
  if (!values.includes(x)) fail();
};
const bool = (x: unknown) => one(x, [true, false]);
const rep = (x: unknown) => {
  const o = obj(x);
  for (const id of ["kingdom", "guild", "black"]) num(o[id], -100, 100);
};
const unique = (xs: any[]) => {
  if (new Set(xs.map((x) => obj(x).id)).size !== xs.length) fail();
  for (const x of xs) str(x.id);
};
export function validate(value: unknown): GameState {
  const s = obj(value);
  one(s.version, [2]);
  for (const k of ["seed", "rng"]) int(s[k], 0, 4294967295);
  for (const k of ["cash", "debt", "arrears", "revision", "serial", "strikes"])
    int(s[k]);
  int(s.day, 1);
  s.location ??= "shop";
  one(s.location, ["shop", "town"]);
  s.town ??= newTown();
  s.crystalUnlockedDay ??= null;
  s.wardDay ??= 0;
  s.lastIncidentDay ??= null;
  for (const k of ["crystalUnlockedDay", "lastIncidentDay"])
    if (s[k] !== null) int(s[k], 1, s.day);
  int(s.wardDay, 0, s.day);
  if (
    s.wardDay &&
    (s.crystalUnlockedDay === null || s.wardDay < s.crystalUnlockedDay)
  )
    fail();
  s.omen ??= { kind: null, chance: 0 };
  const omen = obj(s.omen);
  one(omen.kind, [null, "theft", "spill", "blackout", "repair"]);
  num(omen.chance, 0, 1);
  if ((omen.kind === null) !== (omen.chance === 0)) fail();
  s.newsReadDay ??= 0;
  int(s.newsReadDay, 0, s.day);
  s.accountantHiredDay ??= null;
  if (s.accountantHiredDay !== null) int(s.accountantHiredDay, 1, s.day);
  int(s.capacity, 1, 30);
  int(s.risk, 0, 100);
  int(s.actions, 0, 2);
  s.actionPointsUsed ??= s.actions * 2;
  int(s.actionPointsUsed, 0, RULES.dailyActions);
  one(s.status, ["active", "default", "ended"]);
  one(s.phase, ["planning", "report"]);
  for (const k of ["financeUsed", "illegalToday"]) bool(s[k]);
  for (const k of ["defaultSince", "warningDay"])
    if (s[k] !== null) int(s[k], 1, s.day);
  if (s.reason !== null) str(s.reason);
  rep(s.reputation);
  if (s.status === "active" && (s.arrears !== 0 || s.defaultSince !== null))
    fail();
  if (s.status === "default" && (!s.arrears || s.defaultSince === null)) fail();
  if (s.status === "ended" && typeof s.reason !== "string") fail();
  const batches = arr(s.batches);
  unique(batches);
  for (const b of batches) {
    one(b.product, IDS);
    int(b.qty, 1, 30);
    int(b.cost, 1);
    int(b.day, 1, s.day);
    if (b.brewed !== undefined) int(b.brewed, 1, b.day);
  }
  if (quantity(s as GameState) > s.capacity) fail();
  const market = obj(s.market),
    prices = obj(s.prices);
  for (const id of IDS) {
    const m = obj(market[id]);
    int(m.buy, 1);
    int(m.previous, 1);
    int(m.reference, 2);
    int(m.supply, 1, 10);
    int(m.remaining, 0, m.supply);
    num(m.factor, 0.5, 2);
    num(m.demand, 0.05, 20);
    const [lo, hi] = priceBounds(m.reference);
    int(prices[id], lo, hi);
  }
  const chains = obj(s.chains);
  for (const id of ["war", "plague", "smuggling"]) {
    const c = obj(chains[id]);
    one(c.stage, ["idle", "rumor", "active", "cooldown"]);
    for (const k of ["start", "end", "cooldown"]) int(c[k]);
    one(c.choice, [
      null,
      "army",
      "warblack",
      "normal",
      "help",
      "refuse",
      "accept",
    ]);
  }
  const delays = arr(s.delayed);
  unique(delays);
  for (const d of delays) {
    int(d.due, 1);
    int(d.start, 0, s.day);
    one(d.chain, ["war", "plague", "smuggling"]);
    one(d.kind, ["army", "warblack", "clinic", "smuggling"]);
    str(d.choice);
  }
  const effects = arr(s.effects);
  unique(effects);
  for (const e of effects) {
    str(e.title);
    str(e.description);
    int(e.until, 1);
    for (const k of ["buy", "demand", "supply"])
      for (const [key, v] of Object.entries(obj(e[k]))) {
        one(key, IDS);
        num(v, 0.1, 5);
      }
  }
  for (const [k, v] of Object.entries(obj(s.eventCooldowns))) {
    str(k);
    int(v);
  }
  const orders = arr(s.orders);
  unique(orders);
  for (const o of orders) {
    one(o.kind, [
      "army",
      "warblack",
      "doctor",
      "smuggler",
      "guild",
      "royal",
      "collector",
      "clinic",
    ]);
    one(o.product, IDS);
    one(o.status, ["open", "accepted", "declined"]);
    one(o.faction, ["kingdom", "guild", "black"]);
    int(o.qty, 1, 30);
    int(o.reward, 1);
    if (o.bulkRatio !== undefined) {
      one(o.kind, ["guild", "royal"]);
      num(o.bulkRatio, RULES.bulkOrderMin, RULES.bulkOrderMax);
    }
    int(o.day, 1, s.day);
    num(o.rep, -100, 100);
    int(o.risk, 0, 100);
    str(o.title);
    str(o.description);
  }
  const logs = arr(s.log);
  unique(logs);
  for (const l of logs) {
    int(l.day, 1, s.day);
    str(l.text);
    one(l.kind, ["world", "choice", "risk", "trade"]);
  }
  for (const n of arr(s.news)) str(n);
  validateTown(s as GameState, fail);
  const book = obj(s.book);
  book.townCost ??= 0;
  book.townUnits ??= 0;
  int(book.townCost);
  int(book.townUnits);
  book.crystalCost ??= 0;
  int(book.crystalCost);
  book.staffCost ??= 0;
  int(book.staffCost);
  for (const k of [
    "openingCash",
    "purchases",
    "orderRevenue",
    "orderCogs",
    "repaid",
    "arrearsPaid",
    "finance",
    "openingRisk",
  ])
    int(book[k]);
  rep(book.openingRep);
  const rows = arr(s.ledger);
  let prev = 0;
  for (const r of rows) {
    if (r.townCost !== undefined) int(r.townCost);
    if (r.staffCost !== undefined) int(r.staffCost);
    for (const k of [
      "staffSalary",
      "careCost",
      "serviceCost",
      "storageCost",
      "permitCost",
      "runningPaid",
      "crystalCost",
      "incidentCashCost",
      "incidentStockCost",
      "repairCost",
    ])
      if (r[k] !== undefined) int(r[k]);
    if (r.incident !== undefined) {
      const h = obj(r.incident);
      one(h.kind, ["theft", "spill", "blackout", "repair"]);
      num(h.chance, 0, 1);
      num(h.actualChance, 0, h.chance);
      bool(h.triggered);
      bool(h.averted);
      if (h.triggered && h.averted) fail();
      for (const k of ["cashLost", "stockCost", "repairCost"]) int(h[k]);
      one(h.demandFactor, [0.65, 1]);
      if (h.demandFactor !== (h.kind === "blackout" && h.triggered ? 0.65 : 1))
        fail();
      str(h.detail);
    }
    obj(r);
    int(r.day, 1, s.day);
    if (r.day <= prev) fail();
    prev = r.day;
    for (const k of [
      "revenue",
      "orderRevenue",
      "purchases",
      "cogs",
      "expired",
      "expiryCost",
      "fixed",
      "fixedPaid",
      "interest",
      "fine",
      "confiscationCost",
      "cash",
      "debt",
      "arrears",
      "stock",
      "repaid",
      "arrearsPaid",
      "finance",
    ])
      int(r[k]);
    for (const k of [
      "operatingProfit",
      "profit",
      "cashFlow",
      "assets",
      "riskDelta",
    ])
      num(r[k]);
    rep(r.repDelta);
    for (const id of IDS) {
      int(obj(r.sales)[id]);
      const q = obj(obj(r.quotes)[id]);
      int(q.buy, 1);
      int(q.reference, 2);
      num(q.demand, 0.05, 20);
    }
    if (r.saleDetails !== undefined) {
      const details = obj(r.saleDetails);
      let receipts = 0,
        cost = 0,
        expired = 0;
      for (const id of IDS) {
        const d = obj(details[id]);
        for (const k of [
          "baseDemand",
          "potential",
          "stock",
          "sold",
          "revenue",
          "cogs",
          "expired",
        ])
          int(d[k]);
        if (d.held !== undefined) int(d.held, 0, 30);
        int(d.price, 1);
        int(d.reference, 2);
        num(d.eventMultiplier, 0.05, 20);
        num(d.priceFactor, 0.2, 1.3);
        num(d.noise, 0.85, 1.15);
        num(d.raw, 0);
        const expected =
          d.baseDemand * d.eventMultiplier * d.priceFactor * d.noise;
        if (
          Math.abs(d.raw - expected) > 1e-8 ||
          d.potential !== Math.floor(d.raw) ||
          d.sold !== r.sales[id] ||
          d.sold > d.stock ||
          d.sold > d.potential ||
          d.revenue !== d.sold * d.price ||
          d.reference !== r.quotes[id].reference ||
          d.eventMultiplier !==
            r.quotes[id].demand * (r.incident?.demandFactor ?? 1)
        )
          fail();
        receipts += d.revenue;
        cost += d.cogs;
        expired += d.expired;
      }
      if (
        receipts + r.orderRevenue !== r.revenue ||
        cost > r.cogs ||
        expired !== r.expired
      )
        fail();
    }
    for (const n of arr(r.notes)) str(n);
  }
  const stats = obj(s.stats);
  for (const k of ["revenue", "maxLoss", "days"]) int(stats[k]);
  if (stats.days !== rows.length) fail();
  if (s.phase === "report" || s.status === "ended") {
    if (
      !rows.length ||
      rows.at(-1).day !== (s.status === "ended" ? s.day : s.day - 1)
    )
      fail();
  }
  return s as GameState;
}
export function encode(s: GameState) {
  return JSON.stringify({ format: 2, state: s });
}
export function decode(raw: string): GameState {
  let envelope;
  try {
    envelope = obj(JSON.parse(raw));
  } catch {
    fail();
  }
  if (envelope!.format === 1) {
    const s = obj(envelope!.state);
    if (s.version !== 1) fail();
    s.version = 2;
    s.financeUsed ??= false;
    return validate(s);
  }
  if (envelope!.format !== 2) fail();
  return validate(envelope!.state);
}
export function loadGame(storage: Pick<Storage, "getItem">): {
  state: GameState | null;
  error?: string;
} {
  try {
    const raw = storage.getItem(SAVE_KEY);
    return { state: raw ? decode(raw) : null };
  } catch (e) {
    return {
      state: null,
      error: e instanceof Error ? e.message : "无法读取存档",
    };
  }
}
export function saveGame(
  storage: Pick<Storage, "getItem" | "setItem">,
  s: GameState,
  expected?: { seed: number; revision: number },
): string | null {
  try {
    if (expected) {
      const raw = storage.getItem(SAVE_KEY);
      if (raw) {
        const other = decode(raw);
        if (
          other.seed !== expected.seed ||
          other.revision !== expected.revision
        )
          return "存档已在其他标签页更新，请刷新后继续。";
      }
    }
    storage.setItem(SAVE_KEY, encode(s));
    return null;
  } catch {
    return "浏览器无法保存进度。请允许本地存储，或导出备份；关闭页面可能丢失未保存进度。";
  }
}
