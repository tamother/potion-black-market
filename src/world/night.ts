import { IDS, type Ledger, type ProductId } from "../engine/types";
export interface Basket {
  items: { product: ProductId; price: number }[];
  revenue: number;
  person: number;
}
/** Presentation only: no RNG draws or economic mutations. Each guest buys1–3 actual bottles. */
export function nightBaskets(row: Ledger): Basket[] {
  const items = IDS.flatMap((id) =>
    Array.from({ length: row.sales[id] }, () => ({
      product: id,
      price: row.saleDetails?.[id].price ?? 0,
    })),
  );
  const baskets: Basket[] = [];
  for (let i = 0; i < items.length;) {
    const size = 1 + ((row.day + baskets.length) % 3),
      group = items.slice(i, i + size);
    baskets.push({
      items: group,
      revenue: group.reduce((n, item) => n + item.price, 0),
      person: (baskets.length + row.day) % 4,
    });
    i += group.length;
  }
  return baskets;
}
export interface NightSession {
  before: import("../engine/types").GameState;
  row: Ledger;
}
export const GUEST_INTERVAL = 1100;
export const GUEST_SALE = 2200;
export const GUEST_EXIT = 4000;
export const guestStart = (index: number) => index * GUEST_INTERVAL;
export const nightDuration = (count: number) =>
  count ? guestStart(count - 1) + GUEST_EXIT + 600 : 1800;
