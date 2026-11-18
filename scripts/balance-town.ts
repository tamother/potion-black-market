import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { createGame, act, closeDay, netAssets } from "../src/engine/game";
import type {
  Action,
  Faction,
  GameState,
  ProductId,
} from "../src/engine/types";
import { remainingActions } from "../src/engine/actions";
import {
  activeContracts,
  freeCapacity,
  townQuote,
  spotProduct,
  usable,
  transitValue,
} from "../src/engine/town";
import { relationRank } from "../src/engine/relations";
import { available, quantity } from "../src/engine/inventory";
import { encode, decode } from "../src/engine/persistence";
import { baseDailyDue } from "../src/engine/hazards";
import { isIllegal } from "../src/engine/economy";
import { play, assertDay } from "./strategies";
const runs = Number(process.env.TOWN_RUNS ?? 120),
  results = [];
for (const faction of ["local", "guild", "kingdom", "black"] as const) {
  const samples: {
    days: number;
    assets: number;
    ended: boolean;
    accepted: number;
    fulfilled: number;
    missed: number;
    preorders: number;
    days30keys: number;
    days30rank: number;
    dayRank2: number;
    transit: number;
  }[] = [];
  for (let i = 0; i < runs; i++) {
    let s = createGame(17 + i * 7919),
      accepted = 0,
      fulfilled = 0,
      missed = 0,
      preorders = 0,
      days30keys = 0,
      days30rank = 0,
      dayRank2 = 0;
    const perform = (a: Action) => {
      const before = s,
        result = act(s, a);
      if (result.error) {
        assert.equal(result.state, before);
        return false;
      }
      s = result.state;
      assert(remainingActions(s) >= 0 && remainingActions(s) <= 8);
      assert(freeCapacity(s) >= 0);
      return true;
    };
    for (let d = 0; d < 100 && s.status !== "ended"; d++) {
      const prev = s;
      if (faction === "local") s = play(s, "conservative");
      else {
        if (s.phase === "report") perform({ type: "ack" });
        if (s.arrears && s.cash >= s.arrears)
          perform({ type: "arrears", amount: s.arrears });
        perform({ type: "travel", location: "town" });
        perform({ type: "meet", faction });
        if (
          !activeContracts(s).length &&
          s.day >= 3 &&
          remainingActions(s) >= 4 &&
          s.status === "active"
        ) {
          const o = s.town.offers.find(
            (o) => o.faction === faction && o.status === "offered",
          );
          if (o) {
            const budget = o.lines.reduce(
                (n, l) =>
                  n +
                  Math.max(0, l.qty - available(s, l.product)) *
                    s.market[l.product].buy,
                0,
              ),
              margin =
                o.reward -
                o.lines.reduce(
                  (n, l) => n + l.qty * s.market[l.product].buy,
                  0,
                );
            if (
              budget < s.cash - baseDailyDue(s) - 35 &&
              margin > o.lines.reduce((n, l) => n + l.qty * 2, 0) + 10 &&
              (faction !== "black" || s.risk < 40)
            )
              if (perform({ type: "contract", id: o.id, choice: "accept" }))
                accepted++;
          }
        }
        for (const c of activeContracts(s)) {
          for (const line of c.lines) {
            const incoming = s.town.deliveries
                .filter((x) => x.product === line.product)
                .reduce((n, x) => n + x.qty, 0),
              need = Math.max(
                0,
                line.qty - available(s, line.product) - incoming,
              );
            if (!need || remainingActions(s) < 1) continue;
            const source =
              faction === "guild" &&
              relationRank(s, "guild") >= 1 &&
              c.deadline > s.day
                ? "reserve"
                : faction === "kingdom" && relationRank(s, "kingdom") >= 1
                  ? "official"
                  : spotProduct(s) === line.product
                    ? "spot"
                    : null;
            let left = need;
            if (source) {
              const q = townQuote(s, source, line.product),
                n = Math.min(
                  left,
                  q.remaining,
                  freeCapacity(s),
                  Math.floor((s.cash - baseDailyDue(s)) / q.price),
                );
              if (
                n > 0 &&
                !q.blocked &&
                perform({
                  type: "town-buy",
                  source,
                  product: line.product,
                  qty: n,
                })
              ) {
                left -= n;
                if (source === "reserve") preorders++;
              }
            }
            if (left > 0 && remainingActions(s) > 0) {
              perform({ type: "travel", location: "shop" });
              const n = Math.min(
                left,
                s.market[line.product].remaining,
                freeCapacity(s),
                Math.floor(
                  (s.cash - baseDailyDue(s)) / s.market[line.product].buy,
                ),
              );
              if (n > 0)
                perform({ type: "buy", product: line.product, qty: n });
              perform({ type: "travel", location: "town" });
            }
          }
          if (
            c.lines.every((l) => usable(s, l.product, c.id) >= l.qty) &&
            remainingActions(s) >= 2
          )
            if (perform({ type: "contract", id: c.id, choice: "deliver" }))
              fulfilled++;
        }
        perform({ type: "travel", location: "shop" });
        // A reserve is a real decision: use remaining actions for ordinary legal retail/orders.
        s = play(s, "conservative");
        if (d === 29) {
          days30keys = s.town.keys[faction];
          days30rank = relationRank(s, faction);
        }
        if (!dayRank2 && relationRank(s, faction) >= 2) dayRank2 = s.day;
      }
      if (s.location !== "shop") perform({ type: "travel", location: "shop" });
      const beforeKeys = s.town.contracts.filter(
        (c) => c.status === "failed",
      ).length;
      const ended = closeDay(s, s.day);
      assert.equal(ended.error, undefined);
      s = ended.state;
      missed +=
        s.town.contracts.filter((c) => c.status === "failed").length -
        beforeKeys;
      assertDay(prev, s);
      assert.equal(netAssets(s) - netAssets(prev), s.ledger.at(-1)!.profit);
      if (d % 5 === 0) s = decode(encode(s));
    }
    samples.push({
      days: s.stats.days,
      assets: netAssets(s),
      ended: s.status === "ended",
      accepted,
      fulfilled,
      missed,
      preorders,
      days30keys,
      days30rank,
      dayRank2,
      transit: transitValue(s),
    });
  }
  const mean = (k: keyof (typeof samples)[number]) =>
    Math.round((samples.reduce((n, s) => n + Number(s[k]), 0) / runs) * 100) /
    100;
  const row = {
    faction,
    runs,
    days: mean("days"),
    ended: samples.filter((s) => s.ended).length,
    assets: mean("assets"),
    accepted: mean("accepted"),
    fulfilled: mean("fulfilled"),
    missed: mean("missed"),
    preorders: mean("preorders"),
    keysAt30: mean("days30keys"),
    rankAt30: mean("days30rank"),
    meanCooperationDay: mean("dayRank2"),
    minAssets: Math.min(...samples.map((s) => s.assets)),
  };
  results.push(row);
  console.log(JSON.stringify(row));
}
writeFileSync(
  "docs/town-balance-results.json",
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      runs,
      maxDays: 100,
      guards: [
        "cash/stock/AP/capacity",
        "cashflow",
        "profit=asset-change",
        "prepaid-transit",
        "reload-every5days",
        "no-double-settlement",
      ],
      results,
    },
    null,
    2,
  ),
);
