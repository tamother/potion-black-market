import { it, expect } from "vitest";
import { createGame, act, closeDay, netAssets } from "../src/engine/game";
import { encode, decode } from "../src/engine/persistence";
import { remainingActions } from "../src/engine/actions";
import { quantity } from "../src/engine/inventory";
import { relationRank, relationBenefits } from "../src/engine/relations";
import {
  prepareTown,
  townQuote,
  transitValue,
  freeCapacity,
  reservedFor,
} from "../src/engine/town";
import { townOutlook } from "../src/engine/forecasts";
function town(day = 3) {
  let s = createGame(17);
  s.day = day;
  s = act(s, { type: "travel", location: "town" }).state;
  prepareTown(s);
  return s;
}
function meet(
  s: ReturnType<typeof createGame>,
  faction: "guild" | "kingdom" | "black",
) {
  return act(s, { type: "meet", faction }).state;
}
it("travels and meets for free without changing money,RNG or refreshing offers", () => {
  let s = town();
  const cash = s.cash,
    rng = s.rng,
    offers = JSON.stringify(s.town.offers);
  s = meet(s, "guild");
  s = act(s, { type: "travel", location: "shop" }).state;
  s = act(s, { type: "travel", location: "town" }).state;
  expect(s.cash).toBe(cash);
  expect(s.rng).toBe(rng);
  expect(remainingActions(s)).toBe(8);
  expect(JSON.stringify(s.town.offers)).toBe(offers);
  expect(act(s, { type: "end", day: 3 }).error).toBeTruthy();
});
it("requires meeting,reputation and key cooperation for actual rank privileges", () => {
  let s = town(30);
  s.reputation.guild = 100;
  expect(relationRank(s, "guild")).toBe(0);
  s = meet(s, "guild");
  expect(relationRank(s, "guild")).toBe(1);
  s.town.keys.guild = 1;
  expect(relationRank(s, "guild")).toBe(2);
  s.town.keys.guild = 3;
  expect(relationRank(s, "guild")).toBe(3);
  expect(relationBenefits(s, "guild").join("")).toContain("预订");
});
it("preorders charge once,reserve capacity and assets,then arrive as fresh lots exactly once", () => {
  let s = meet(town(7), "guild");
  s.reputation.guild = 30;
  const quote = townQuote(s, "reserve", "healing"),
    oldCash = s.cash,
    assets = netAssets(s);
  s = act(s, {
    type: "town-buy",
    source: "reserve",
    product: "healing",
    qty: 4,
  }).state;
  expect(s.cash).toBe(oldCash - quote.price * 4);
  expect(quantity(s)).toBe(0);
  expect(freeCapacity(s)).toBe(26);
  expect(transitValue(s)).toBe(quote.price * 4);
  expect(netAssets(s)).toBe(assets);
  expect(
    act(s, { type: "town-buy", source: "reserve", product: "healing", qty: 1 })
      .error,
  ).toBeTruthy();
  s = decode(encode(s));
  s = act(s, { type: "travel", location: "shop" }).state;
  s = closeDay(s, 7).state;
  expect(s.town.deliveries).toHaveLength(0);
  expect(s.batches.find((b) => b.product === "healing")?.day).toBe(8);
  expect(quantity(s)).toBe(4);
  const again = decode(encode(s));
  expect(quantity(again)).toBe(4);
});
it("transit space blocks ordinary purchases and invalid town purchases are atomic", () => {
  let s = meet(town(), "guild");
  s.reputation.guild = 20;
  s.batches = [{ id: "a", product: "mana", qty: 28, cost: 20, day: 1 }];
  const before = encode(s);
  expect(
    act(s, { type: "town-buy", source: "reserve", product: "healing", qty: 4 })
      .error,
  ).toBeTruthy();
  expect(encode(s)).toBe(before);
  s = act(s, {
    type: "town-buy",
    source: "reserve",
    product: "healing",
    qty: 2,
  }).state;
  s = act(s, { type: "travel", location: "shop" }).state;
  expect(act(s, { type: "buy", product: "healing", qty: 1 }).error).toContain(
    "仓库",
  );
});
it("accepted multi-day work reserves real goods from retail and pays only on delivery", () => {
  let s = meet(town(), "guild");
  const offer = s.town.offers.find((o) => o.faction === "guild")!,
    cash = s.cash;
  s = act(s, { type: "contract", id: offer.id, choice: "accept" }).state;
  expect(s.cash).toBe(cash);
  expect(remainingActions(s)).toBe(7);
  s.batches = offer.lines.map((l, i) => ({
    id: "c" + i,
    product: l.product,
    qty: l.qty,
    cost: 10,
    day: s.day,
  }));
  for (const l of offer.lines) expect(reservedFor(s, l.product)).toBe(l.qty);
  s = act(s, { type: "travel", location: "shop" }).state;
  s = closeDay(s, 3).state;
  for (const l of offer.lines) expect(s.ledger[0].sales[l.product]).toBe(0);
  s = act(s, { type: "ack" }).state;
  s = act(s, { type: "travel", location: "town" }).state;
  const old = s.cash;
  s = act(s, { type: "contract", id: offer.id, choice: "deliver" }).state;
  expect(s.cash).toBe(old + offer.reward);
  expect(s.book.townUnits).toBe(offer.lines.reduce((n, l) => n + l.qty, 0));
  expect(s.town.keys.guild).toBe(1);
  expect(
    act(s, { type: "contract", id: offer.id, choice: "deliver" }).error,
  ).toBeTruthy();
});
it("reservation allocation gives the first contract priority instead of deadlocking both", () => {
  let s = town(10);
  s = meet(meet(s, "guild"), "kingdom");
  const a = s.town.offers.find((o) => o.faction === "guild")!,
    b = structuredClone(s.town.offers.find((o) => o.faction === "kingdom")!);
  a.lines = [{ product: "healing", qty: 4 }];
  b.lines = [{ product: "healing", qty: 4 }];
  s.town.offers = s.town.offers.map((o) => (o.faction === "kingdom" ? b : o));
  s = act(s, { type: "contract", id: a.id, choice: "accept" }).state;
  s = act(s, { type: "contract", id: b.id, choice: "accept" }).state;
  s.batches = [{ id: "stock", product: "healing", qty: 4, cost: 10, day: 10 }];
  expect(
    act(s, { type: "contract", id: b.id, choice: "deliver" }).error,
  ).toBeTruthy();
  const n = act(s, { type: "contract", id: a.id, choice: "deliver" });
  expect(n.error).toBeUndefined();
  expect(n.state.town.contracts.find((c) => c.id === a.id)?.status).toBe(
    "fulfilled",
  );
});
it("rejecting unaccepted work is free, committed cancellation and deadline have bounded trust costs", () => {
  let s = meet(town(), "guild");
  const offer = s.town.offers.find((o) => o.faction === "guild")!;
  const declined = act(s, {
    type: "contract",
    id: offer.id,
    choice: "decline",
  }).state;
  expect(declined.reputation.guild).toBe(0);
  expect(remainingActions(declined)).toBe(8);
  s = act(s, { type: "contract", id: offer.id, choice: "accept" }).state;
  const cancel = act(s, {
    type: "contract",
    id: offer.id,
    choice: "cancel",
  }).state;
  expect(cancel.reputation.guild).toBe(-4);
  s.day = offer.deadline;
  s = act(s, { type: "travel", location: "shop" }).state;
  const n = closeDay(s, s.day).state;
  expect(n.reputation.guild).toBe(-8);
  expect(n.town.contracts.find((c) => c.id === offer.id)?.status).toBe(
    "failed",
  );
});
it("actual supply privileges and weekly permit reduction have bounded measurable effects", () => {
  let s = meet(town(7), "kingdom");
  s.reputation.kingdom = 60;
  s.town.keys.kingdom = 1;
  const q = townQuote(s, "official", "mana");
  expect(q.price).toBeLessThan(s.market.mana.buy);
  expect(q.remaining).toBe(3);
  expect(townQuote(s, "official", "invisibility").blocked).toBeTruthy();
  s = act(s, { type: "travel", location: "shop" }).state;
  expect(closeDay(s, 7).state.ledger[0].permitCost).toBe(24);
});
it("black-market supply charges disclosed illegal risk and never grants investigation immunity", () => {
  let s = meet(town(10), "black");
  s.reputation.black = 100;
  s.town.keys.black = 3;
  const n = act(s, {
    type: "town-buy",
    source: "black",
    product: "invisibility",
    qty: 1,
  });
  expect(n.error).toBeUndefined();
  expect(n.state.risk).toBe(s.risk + 3);
  expect(n.state.illegalToday).toBe(true);
  expect(n.state.reputation.kingdom).toBe(-1);
});
it("paid intel charges once without drawing new RNG and rank gates are enforced", () => {
  let s = meet(town(8), "black");
  expect(act(s, { type: "intel" }).error).toBeTruthy();
  s.reputation.black = 60;
  s.town.keys.black = 1;
  const rng = s.rng,
    cash = s.cash;
  s = act(s, { type: "intel" }).state;
  expect(s.cash).toBe(cash - 5);
  expect(s.rng).toBe(rng);
  expect(s.book.townCost).toBe(5);
  expect(remainingActions(s)).toBe(7);
  expect(act(s, { type: "intel" }).error).toBeTruthy();
  expect(decode(encode(s)).town.intelDay).toBe(8);
});
it("forecast remains stable and is announced ahead of an actual future market change", () => {
  const s = town(3),
    f = townOutlook(s)!;
  expect(f.start).toBe(5);
  expect(f.product).toBeTruthy();
  expect(townOutlook(decode(encode(s)))).toEqual(f);
  const next = act(
    closeDay(act(s, { type: "travel", location: "shop" }).state, 3).state,
    { type: "ack" },
  ).state;
  const active = closeDay(next, 4).state;
  expect(active.day).toBe(5);
  expect(
    active.market[f.product].demand !== 1 ||
      active.market[f.product].supply < 5,
  ).toBe(true);
});
it("legacy saves preserve old reputation/assets and receive no invented key history", () => {
  const s: any = createGame(19);
  s.reputation.guild = 100;
  delete s.town;
  delete s.location;
  delete s.book.townCost;
  delete s.book.townUnits;
  const old = s.cash;
  const n = decode(encode(s));
  expect(n.location).toBe("shop");
  expect(n.cash).toBe(old);
  expect(n.town.keys.guild).toBe(0);
  expect(n.reputation.guild).toBe(100);
  expect(() =>
    decode(
      encode({
        ...n,
        town: { ...n.town, keys: { ...n.town.keys, guild: -1 } },
      }),
    ),
  ).toThrow();
});
it("long-running cancelled key offers keep bounded history and survive save reload", () => {
  let s = meet(town(), "guild");
  for (let day = 3; day < 70; day++) {
    s.day = day;
    s.actionPointsUsed = 0;
    prepareTown(s);
    const o = s.town.offers.find((o) => o.faction === "guild")!;
    s = act(s, { type: "contract", id: o.id, choice: "accept" }).state;
    s = act(s, { type: "contract", id: o.id, choice: "cancel" }).state;
    expect(() => decode(encode(s))).not.toThrow();
  }
  expect(s.town.contracts.length).toBeLessThanOrEqual(26);
});
it("declines paid intel for an already public event without consuming cash or actions", () => {
  let s = meet(town(10), "black");
  s.reputation.black = 60;
  s.town.keys.black = 1;
  const before = encode(s),
    result = act(s, { type: "intel" });
  expect(result.error).toBeTruthy();
  expect(encode(s)).toBe(before);
});
it("sale history explains reserved stock instead of claiming purchased bottles did not exist", () => {
  let s = meet(town(), "guild"),
    o = s.town.offers.find((o) => o.faction === "guild")!;
  s = act(s, { type: "contract", id: o.id, choice: "accept" }).state;
  s.batches = o.lines.map((l, i) => ({
    id: "held" + i,
    product: l.product,
    qty: l.qty,
    cost: 10,
    day: 3,
  }));
  s = act(s, { type: "travel", location: "shop" }).state;
  const n = closeDay(s, 3).state;
  for (const l of o.lines)
    expect(n.ledger[0].saleDetails?.[l.product].held).toBe(l.qty);
});
it("aged market stock records actual purchase date separately from its shelf-life origin", () => {
  let s = town(5);
  s.seed = 16;
  const n = act(s, {
    type: "town-buy",
    source: "spot",
    product: "healing",
    qty: 1,
  });
  expect(n.error).toBeUndefined();
  const b = n.state.batches[0];
  expect(b.day).toBe(5);
  expect(b.brewed).toBe(3);
});
it("paid forecast knowledge survives the next day and the same tip cannot be charged again", () => {
  let s = meet(town(8), "black");
  s.reputation.black = 60;
  s.town.keys.black = 1;
  s = act(s, { type: "intel" }).state;
  expect(s.town.knownForecast).toBe(10);
  s = act(s, { type: "travel", location: "shop" }).state;
  s = act(closeDay(s, 8).state, { type: "ack" }).state;
  s = act(s, { type: "travel", location: "town" }).state;
  const cash = s.cash;
  expect(act(s, { type: "intel" }).error).toBeTruthy();
  expect(s.cash).toBe(cash);
  expect(decode(encode(s)).town.knownForecast).toBe(10);
});
