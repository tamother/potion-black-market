import type { GameState, ProductId } from "./types";
import { IDS } from "./types";
import { PRODUCTS } from "./config";
export interface Outlook {
  start: number;
  until: number;
  product: ProductId;
  kind: "festival" | "shortage";
  clue: string;
  detail: string;
}
function outlook(seed: number, start: number): Outlook {
  const block = (start - 5) / 5,
    product = IDS[(block + (seed % 5)) % 5],
    kind = (block + (seed % 2)) % 2 === 0 ? "festival" : "shortage";
  return {
    start,
    until: start + 1,
    product,
    kind,
    clue:
      kind === "festival"
        ? `外乡客正在安排庆典，${PRODUCTS[product].name}也许会更受欢迎。`
        : `商队正调整路线，${PRODUCTS[product].name}的供货可能吃紧。`,
    detail:
      kind === "festival"
        ? `第${start}–${start + 1}天，${PRODUCTS[product].name}零售需求约为平日1.7倍（其他事件仍会叠加）。`
        : `第${start}–${start + 1}天，${PRODUCTS[product].name}商队供应约降至平日45%。`,
  };
}
export function townOutlook(
  s: Pick<GameState, "seed" | "day">,
): Outlook | null {
  if (s.day < 3) return null;
  let start = 5 + Math.max(0, Math.floor((s.day - 5) / 5)) * 5;
  if (s.day > start + 1) start += 5;
  return s.day < start - 2 ? null : outlook(s.seed, start);
}
export function townMarketFactors(s: GameState, id: ProductId) {
  const f = townOutlook(s),
    active = f && s.day >= f.start && s.day <= f.until && id === f.product;
  return {
    demand: active ? (f.kind === "festival" ? 1.7 : 1.15) : 1,
    supply: active && f.kind === "shortage" ? 0.45 : 1,
  };
}
/** Separate from wholesale factor: everyday bids must not track purchase margins in lockstep. */
export function ordinaryTerms(s: GameState, kind: "guild" | "royal") {
  if (s.day <= 3)
    return {
      product: kind === "guild" ? "healing" : "mana",
      qty: 2,
      reward: Math.round(
        (kind === "guild" ? 66 : 112) *
          s.market[kind === "guild" ? "healing" : "mana"].factor,
      ),
    } as { product: ProductId; qty: number; reward: number };
  const h =
    ((s.seed % 997) * 17 + s.day * 13 + (kind === "royal" ? 7 : 0)) >>> 0;
  const product: ProductId =
      kind === "royal"
        ? "mana"
        : (["healing", "mana", "antidote"] as const)[h % 3],
    qty = 2 + (Math.floor(h / 3) % 3),
    ratio = [0.82, 0.94, 1.04, 1.12][Math.floor(h / 7) % 4];
  return {
    product,
    qty,
    reward: Math.round(s.market[product].reference * qty * ratio),
  };
}
