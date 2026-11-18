import type { GameState, Faction, OrderKind } from "./types";
export const CONTACTS = {
  guild: { name: "塞拉", place: "冒险者公会", role: "公会联络人" },
  kingdom: { name: "米拉", place: "镇集市", role: "市集执事" },
  black: { name: "阿缇", place: "旧巷", role: "暗巷牵线人" },
};
export const RANK_NAMES = ["初次往来", "熟识", "合作", "信任"];
export function relationRank(s: GameState, f: Faction): number {
  if (!s.town?.met[f] || s.reputation[f] < 20) return 0;
  if (s.reputation[f] >= 80 && s.town.keys[f] >= 3) return 3;
  if (s.reputation[f] >= 50 && s.town.keys[f] >= 1) return 2;
  return 1;
}
export function relationBenefits(s: GameState, f: Faction): string[] {
  const r = relationRank(s, f);
  if (!r) return ["拜访联系人，达到20声望后开放专属合作。"];
  if (f === "guild")
    return [
      `次日预订：现价${[100, 94, 92, 90][r]}%，每日${r === 3 ? 6 : 4}瓶。`,
      ...(r >= 2 ? ["长线合作委托；塞拉会提前安排下一段备药。"] : []),
    ];
  if (f === "kingdom")
    return [
      `独立正规库存，每日${r === 3 ? 4 : 3}瓶合法药品；按进价${[100, 97, 94, 92][r]}%取整。`,
      ...(r >= 2 ? ["每周许可费24 G；违法调查照常。"] : []),
    ];
  return [
    `替代货源：现价${[100, 118, 110, 104][r]}%，每日${r === 3 ? 4 : 3}瓶。`,
    ...(r >= 2 ? ["可靠情报：5 G与1行动，确认即将到来的行情。"] : []),
  ];
}
export function nextRelation(s: GameState, f: Faction): string {
  const r = relationRank(s, f);
  if (!s.town.met[f])
    return `先到${CONTACTS[f].place}认识${CONTACTS[f].name}。`;
  if (!r) return `再积累${Math.max(0, 20 - s.reputation[f])}声望，成为熟面孔。`;
  if (r === 1)
    return `合作需要50声望与1份关键委托；当前${s.reputation[f]}声望、${s.town.keys[f]}份。`;
  if (r === 2)
    return `信任需要80声望与3份关键委托；当前${s.reputation[f]}声望、${s.town.keys[f]}份。`;
  return "关系稳固；新的委托会继续考验备货与取舍。";
}
/** Only repeated small commissions diminish. Story/critical favors retain their authored gains. */
export function routineReputation(
  s: GameState,
  kind: OrderKind,
  base: number,
): number {
  if (!["guild", "royal", "clinic"].includes(kind)) return base;
  const count = s.town.routine[kind] ?? 0;
  s.town.routine[kind] = count + 1;
  return Math.max(
    1,
    Math.round(
      base * [1, 0.75, 0.5, 0.25, 0.125][Math.min(4, Math.floor(count / 3))],
    ),
  );
}
