import { mkdirSync, writeFileSync } from "node:fs";
import { createGame, act, closeDay, netAssets } from "../src/engine/game";
import { PRODUCTS } from "../src/engine/config";
import { IDS } from "../src/engine/types";
import type { GameState, ProductId } from "../src/engine/types";
import { available, quantity } from "../src/engine/inventory";
import { priceBounds, isIllegal } from "../src/engine/economy";
import { decode, encode } from "../src/engine/persistence";
import assert from "node:assert/strict";
import { play, assertDay } from "./strategies";
const runs = Number(process.env.SIM_RUNS ?? 300),
  maxDays = 100;
const results = [];
const raw = [];
for (const strategy of ["conservative", "aggressive", "mixed"] as const) {
  const samples = [];
  const reasons: Record<string, number> = {};
  for (let i = 0; i < runs; i++) {
    let s = createGame(i * 7919 + 17);
    for (let day = 0; day < maxDays && s.status !== "ended"; day++) {
      const prev = s;
      s = play(s, strategy);
      s = closeDay(s, s.day).state;
      assertDay(prev, s);
      if (day % 10 === 0) s = decode(encode(s));
    }
    const reason =
      s.status === "ended"
        ? s.reason?.includes("查封")
          ? "永久查封"
          : "逾期破产"
        : "存活到100天";
    reasons[reason] = (reasons[reason] ?? 0) + 1;
    const sample = {
      strategy,
      seed: i * 7919 + 17,
      days: s.stats.days,
      assets: netAssets(s),
      ended: s.status === "ended",
      reason,
    };
    samples.push(sample);
    raw.push(sample);
  }
  const wealth = samples.map((s) => s.assets).sort((a, b) => a - b),
    avg = (xs: number[]) =>
      Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100,
    q = (p: number) => wealth[Math.floor((wealth.length - 1) * p)];
  results.push({
    strategy,
    runs,
    averageSurvival: avg(samples.map((s) => s.days)),
    bankruptcyRate: (reasons["逾期破产"] ?? 0) / runs,
    closureRate: (reasons["永久查封"] ?? 0) / runs,
    averageFinalAssets: avg(wealth),
    wealth: {
      min: wealth[0],
      p10: q(0.1),
      median: q(0.5),
      p90: q(0.9),
      max: wealth.at(-1),
    },
    failureReasons: reasons,
  });
  console.log(JSON.stringify(results.at(-1)));
}
mkdirSync("docs", { recursive: true });
writeFileSync(
  "docs/simulation-results.json",
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      runsPerStrategy: runs,
      maxDays,
      results,
    },
    null,
    2,
  ),
);
writeFileSync(
  "docs/simulation-runs.csv",
  "strategy,seed,days,assets,ended,reason\n" +
    raw
      .map(
        (r) =>
          `${r.strategy},${r.seed},${r.days},${r.assets},${r.ended},${r.reason}`,
      )
      .join("\n") +
    "\n",
);
