import { it, expect } from "vitest";
import { createGame, closeDay } from "../src/engine/game";
import { IDS } from "../src/engine/types";
import { nightBaskets } from "../src/world/night";
it("builds real1–3 bottle customers with exact retail receipts, excluding prepaid orders", () => {
  const s = createGame(19);
  s.batches = IDS.map((id, i) => ({
    id: String(i),
    product: id,
    qty: 6,
    cost: s.market[id].buy,
    day: 1,
  }));
  s.book.orderRevenue = 123;
  const r = closeDay(s, 1).state.ledger[0],
    baskets = nightBaskets(r);
  expect(baskets.reduce((n, b) => n + b.revenue, 0)).toBe(
    r.revenue - r.orderRevenue,
  );
  expect(baskets.every((b) => b.items.length >= 1 && b.items.length <= 3)).toBe(
    true,
  );
  for (const id of IDS)
    expect(
      baskets.flatMap((b) => b.items).filter((i) => i.product === id).length,
    ).toBe(r.sales[id]);
  expect(nightBaskets(r)).toEqual(baskets);
});
it("does not invent customers or gold on a night with no retail sales", () => {
  const r = closeDay(createGame(19), 1).state.ledger[0];
  expect(nightBaskets(r)).toEqual([]);
});
