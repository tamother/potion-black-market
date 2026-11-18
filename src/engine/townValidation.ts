import { IDS, type GameState } from "./types";
import { FACTION_IDS } from "./townTypes";
import { quantity } from "./inventory";
/** Additional save section is validated independently; legacy defaults are installed by the caller. */
export function validateTown(s: GameState, fail: () => never) {
  const obj = (x: unknown): any =>
    x && typeof x === "object" && !Array.isArray(x) ? x : fail();
  const arr = (x: unknown): any[] => (Array.isArray(x) ? x : fail());
  const num = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) => {
    if (typeof x !== "number" || !Number.isSafeInteger(x) || x < min || x > max)
      fail();
  };
  const str = (x: unknown) => {
    if (typeof x !== "string" || x.length > 500) fail();
  };
  const t = obj(s.town);
  for (const k of ["met", "keys", "announced"]) {
    obj(t[k]);
    for (const f of FACTION_IDS) {
      if (k === "met") {
        if (typeof t[k][f] !== "boolean") fail();
      } else num(t[k][f], 0, k === "keys" ? 3 : 3);
    }
  }
  num(t.supplyDay, 0, s.day);
  num(t.intelDay, 0, s.day);
  t.knownForecast ??= 0;
  num(t.knownForecast, 0, s.day + 5);
  obj(t.used);
  for (const k of ["spot", "reserve", "official", "black"])
    num(t.used[k], 0, 6);
  obj(t.routine);
  for (const [k, v] of Object.entries(t.routine)) {
    if (!["guild", "royal", "clinic"].includes(k)) fail();
    num(v);
  }
  const allIds = new Set<string>();
  for (const list of ["offers", "contracts"]) {
    const cs = arr(t[list]);
    if (cs.length > (list === "offers" ? 3 : 40)) fail();
    const seen = new Set<string>();
    for (const raw of cs) {
      const c = obj(raw);
      str(c.id);
      if (seen.has(c.id)) fail();
      seen.add(c.id);
      if (!FACTION_IDS.includes(c.faction)) fail();
      for (const k of ["title", "client"]) str(c[k]);
      num(c.posted, 1, s.day);
      num(c.deadline, c.posted, c.posted + 4);
      num(c.reward, 1);
      num(c.rep, 1, 20);
      num(c.step, 0, 3);
      if (
        ![
          "offered",
          "active",
          "fulfilled",
          "declined",
          "failed",
          "cancelled",
        ].includes(c.status) ||
        typeof c.reserve !== "boolean" ||
        typeof c.key !== "boolean"
      )
        fail();
      if (list === "contracts" && ["offered", "declined"].includes(c.status))
        fail();
      const lines = arr(c.lines);
      if (
        !lines.length ||
        lines.length > 2 ||
        new Set(lines.map((l) => l.product)).size !== lines.length
      )
        fail();
      let units = 0;
      for (const l of lines) {
        obj(l);
        if (!IDS.includes(l.product)) fail();
        num(l.qty, 1, 10);
        units += l.qty;
      }
      if (units > 14) fail();
    }
  }
  if (t.contracts.filter((c: any) => c.status === "active").length > 2) fail();
  let reserved = 0;
  for (const raw of arr(t.deliveries)) {
    const d = obj(raw);
    str(d.id);
    if (allIds.has(d.id)) fail();
    allIds.add(d.id);
    if (!IDS.includes(d.product)) fail();
    num(d.qty, 1, 6);
    num(d.cost, 1);
    num(d.due, s.day, s.day + 1);
    reserved += d.qty;
  }
  if (quantity(s) + reserved > s.capacity) fail();
}
