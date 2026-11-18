import type { GameState } from "./types";
/** Copy mutable turn data; historical entries and effect definitions are immutable values.
 * Sharing their contents keeps long-running games responsive without mutating past states.
 */
export function draft(s: GameState): GameState {
  return {
    ...s,
    town: structuredClone(s.town),
    batches: s.batches.map((b) => ({ ...b })),
    market: Object.fromEntries(
      Object.entries(s.market).map(([k, v]) => [k, { ...v }]),
    ) as GameState["market"],
    prices: { ...s.prices },
    reputation: { ...s.reputation },
    chains: {
      war: { ...s.chains.war },
      plague: { ...s.chains.plague },
      smuggling: { ...s.chains.smuggling },
    },
    orders: s.orders.map((o) => ({ ...o })),
    delayed: [...s.delayed],
    effects: [...s.effects],
    eventCooldowns: { ...s.eventCooldowns },
    log: [...s.log],
    news: [...s.news],
    ledger: [...s.ledger],
    book: { ...s.book, openingRep: { ...s.book.openingRep } },
    stats: { ...s.stats },
  };
}
