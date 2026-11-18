import type { Action, GameState } from "./types";
import { RULES } from "./config";
/** Reads, navigation, debt relief and opening must remain possible at zero AP. */
export function actionCost(s: GameState, a: Action): number {
  if (a.type === "contract")
    return a.choice === "accept" ? 1 : a.choice === "deliver" ? 2 : 0;
  if (a.type === "town-buy" || a.type === "intel") return 1;
  if (a.type === "order") return a.accept ? 2 : 0;
  if (a.type === "price")
    return s.prices[a.product as keyof typeof s.prices] === a.price ? 0 : 1;
  return ["buy", "hire-accountant", "buy-crystal", "ward"].includes(a.type)
    ? 1
    : 0;
}
export const remainingActions = (s: GameState) =>
  RULES.dailyActions - (s.actionPointsUsed ?? s.actions * 2);
