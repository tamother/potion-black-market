import { createElement } from "react";
import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createGame, act } from "../src/engine/game";
import { prepareTown } from "../src/engine/town";
import { LedgerWindow } from "../src/ui/BooksWindow";

it("includes committed town delivery handling in the basic daily budget", () => {
  let s = createGame(17);
  s.day = 3;
  s.location = "town";
  s.town.met.guild = true;
  prepareTown(s);
  const offer = s.town.offers.find((o) => o.faction === "guild")!;
  s = act(s, { type: "contract", id: offer.id, choice: "accept" }).state;
  s.batches = offer.lines.map((l, i) => ({
    id: `fixture-${i}`,
    product: l.product,
    qty: l.qty,
    cost: 20,
    day: s.day,
  }));
  const result = act(s, { type: "contract", id: offer.id, choice: "deliver" });
  expect(result.error).toBeUndefined();
  s = result.state;
  expect(s.book.townUnits).toBe(5);
  const html = renderToStaticMarkup(
    createElement(LedgerWindow, { s, dispatch: () => true, onClose: () => {} }),
  );
  expect(html).toContain("已交付耗材10 G");
});
