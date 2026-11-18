import { writeFileSync } from "node:fs";
import { createGame, act, closeDay, netAssets } from "../src/engine/game";
import { RULES, PRODUCTS } from "../src/engine/config";
import { IDS, type GameState } from "../src/engine/types";
import { quantity, available, inventoryValue } from "../src/engine/inventory";
import { baseDailyDue, merchantAvailable } from "../src/engine/hazards";
import { decode, encode } from "../src/engine/persistence";
import { play, assertDay } from "./strategies";
const runs = 300,
  results = [];
for (const policy of ["diversified", "selective-ward", "guild-only"] as const) {
  const samples = [];
  let triggered = 0,
    averted = 0,
    wardUses = 0,
    crystalSpent = 0,
    expense = 0,
    shortfalls = 0;
  for (let i = 0; i < runs; i++) {
    let s = createGame(i * 7919 + 17),
      n = 0;
    for (; n < 100 && s.status !== "ended"; n++) {
      const prev = s;
      if (policy === "guild-only") {
        if (s.phase === "report") s = act(s, { type: "ack" }).state;
        if (s.arrears && s.cash >= s.arrears)
          s = act(s, { type: "arrears", amount: s.arrears }).state;
        const order = s.orders.find(
          (o) => o.kind === "guild" && o.status === "open",
        );
        if (order) {
          const need = Math.max(0, order.qty - available(s, order.product));
          if (need)
            s = act(s, {
              type: "buy",
              product: order.product,
              qty: need,
            }).state;
          s = act(s, { type: "order", id: order.id, accept: true }).state;
        }
      } else
        s = play(
          s,
          "conservative",
          policy === "selective-ward" &&
            ((s.crystalUnlockedDay !== null && s.omen.kind !== null) ||
              (merchantAvailable(s) && s.cash > RULES.crystalUnlock + 160))
            ? 1
            : 0,
        );
      if (policy === "selective-ward") {
        if (merchantAvailable(s) && s.cash > RULES.crystalUnlock + 160)
          s = act(s, { type: "buy-crystal" }).state;
        let loss = 0;
        if (s.omen.kind === "theft") loss = Math.min(80, s.cash * 0.16);
        if (s.omen.kind === "spill")
          loss = quantity(s)
            ? (inventoryValue(s) / quantity(s)) * Math.min(2, quantity(s))
            : 0;
        if (s.omen.kind === "repair") loss = 48;
        if (s.omen.kind === "blackout")
          loss = IDS.reduce(
            (a, id) =>
              a +
              Math.max(0, s.prices[id] - s.market[id].buy) *
                Math.min(
                  available(s, id),
                  PRODUCTS[id].demand * s.market[id].demand,
                ) *
                0.35,
            0,
          );
        if (
          s.crystalUnlockedDay !== null &&
          s.omen.chance * RULES.wardReduction * loss > RULES.crystalUse &&
          s.cash > RULES.crystalUse + baseDailyDue(s) + 40
        ) {
          const next = act(s, { type: "ward" });
          if (!next.error) {
            wardUses++;
            s = next.state;
          }
        }
      }
      s = closeDay(s, s.day).state;
      assertDay(prev, s);
      if (n % 10 === 0) s = decode(encode(s));
      const r = s.ledger.at(-1)!;
      triggered += Number(r.incident?.triggered ?? false);
      averted += Number(r.incident?.averted ?? false);
      crystalSpent += r.crystalCost ?? 0;
      expense +=
        r.fixed +
        (r.staffSalary ?? 0) +
        (r.careCost ?? 0) +
        (r.serviceCost ?? 0) +
        (r.storageCost ?? 0) +
        (r.permitCost ?? 0);
      shortfalls += Number(s.arrears > 0);
    }
    samples.push({
      days: n,
      assets: netAssets(s),
      bankrupt: s.status === "ended",
    });
  }
  const avg = (a: number[]) =>
    Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 100) / 100;
  const sorted = samples.map((s) => s.assets).sort((a, b) => a - b);
  results.push({
    policy,
    runs,
    averageDays: avg(samples.map((s) => s.days)),
    bankrupt: samples.filter((s) => s.bankrupt).length,
    averageAssets: avg(sorted),
    p10: sorted[Math.floor(0.1 * (runs - 1))],
    median: sorted[Math.floor(0.5 * (runs - 1))],
    averageIncidents: triggered / runs,
    averageAverted: averted / runs,
    averageWardUses: wardUses / runs,
    averageCrystalSpend: crystalSpent / runs,
    averageOperatingCosts: expense / runs,
    shortfallDays: shortfalls,
  });
  console.log(JSON.stringify(results.at(-1)));
}
writeFileSync(
  "docs/risk-balance-results.json",
  JSON.stringify(
    { generatedAt: new Date().toISOString(), runsPerPolicy: runs, results },
    null,
    2,
  ),
);
