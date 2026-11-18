import { townMarketFactors } from "./forecasts";
import { IDS } from "./types";
import type { GameState, Market, Product, ProductId } from "./types";
import { PRODUCTS, RULES } from "./config";
import { random, clamp } from "./random";
export const priceBounds = (reference: number): [number, number] => [
  Math.ceil(reference * 0.7),
  Math.floor(reference * 1.6),
];
export function demandBreakdown(
  p: Product,
  m: Market,
  price: number,
  noise: number,
) {
  const priceFactor = clamp(2 - price / m.reference, 0.2, 1.3);
  const raw = p.demand * m.demand * priceFactor * noise;
  return {
    baseDemand: p.demand,
    eventMultiplier: m.demand,
    price,
    reference: m.reference,
    priceFactor,
    noise,
    raw,
    potential: Math.max(0, Math.floor(raw)),
  };
}
export function demand(p: Product, m: Market, price: number, noise: number) {
  return demandBreakdown(p, m, price, noise).potential;
}
export function demandRange(p: Product, m: Market, price: number) {
  return { min: demand(p, m, price, 0.85), max: demand(p, m, price, 1.15) };
}
export const isIllegal = (s: GameState, p: ProductId) =>
  p === "invisibility" || (p === "berserk" && s.chains.war.stage === "active");
export function generateMarket(s: GameState) {
  for (const id of IDS) {
    const p = PRODUCTS[id],
      old = s.market[id];
    let eventBuy = 1,
      eventDemand = 1,
      eventSupply = 1;
    for (const e of s.effects) {
      eventBuy *= e.buy[id] ?? 1;
      eventDemand *= e.demand[id] ?? 1;
      eventSupply *= e.supply[id] ?? 1;
    }
    if (s.chains.war.stage === "active") {
      if (id === "healing" || id === "berserk") {
        eventBuy *= 1.2;
        eventDemand *= 1.8;
      }
      if (id === "berserk") eventSupply *= 0.7;
    }
    if (s.chains.plague.stage === "active" && id === "antidote") {
      eventBuy *= 1.25;
      eventDemand *= 2.2;
    }
    const town = townMarketFactors(s, id);
    eventDemand *= town.demand;
    eventSupply *= town.supply;
    // Smooth AR(1) supply/demand component; event premium is separately removed through gradual convergence.
    const last = old?.factor ?? 1;
    const target = clamp(eventBuy, 0.55, 1.8);
    const factor = clamp(
      last * 0.65 + target * 0.35 + (random(s) - 0.5) * p.volatility * 2,
      eventBuy !== 1 ? 0.55 : 0.75,
      eventBuy !== 1 ? 1.8 : Math.max(1.4, last),
    );
    const buy = Math.max(1, Math.round(p.buy * factor));
    const reference = Math.max(2, Math.round(p.retail * factor));
    const supply = clamp(
      Math.round(RULES.baseSupply[id] * eventSupply + (random(s) - 0.5) * 2),
      eventSupply < 1 ? 1 : 3,
      10,
    );
    s.market[id] = {
      buy,
      previous: old?.buy ?? p.buy,
      reference,
      supply,
      remaining: supply,
      factor,
      demand: eventDemand,
    };
    const [low, high] = priceBounds(reference);
    s.prices[id] = clamp(s.prices[id] ?? reference, low, high);
  }
}
