import { PRODUCTS } from "../engine/config";
import type { Order } from "../engine/types";
import type { GameState, OrderKind } from "../engine/types";
export const ORDER_WORDS: Record<OrderKind, string> = {
  guild: "公会的补给箱又见底了。两瓶治疗药水，今天能替我们留一份吗？",
  royal: "法师塔需要补充药水。品质合格，王国会按约付钱。",
  army: "边境的伤员还在等药。军需官让我来问，你愿不愿意帮这个忙？",
  warblack:
    "有些生意，不必惊动城门的守卫。你准备好了，我们就一手交钱、一手交货。",
  doctor: "诊所外排着长队。我手里的钱不多，但这两瓶药能救急。",
  clinic: "诊所的病人记着你。这回我们备好了采购的钱，还是想向你订药。",
  smuggler: "这封信没有署名。买家要两瓶隐身药剂，钱不会少你的。",
  collector: "有位藏家对你的魔力药水很感兴趣。这是他托我送来的委托。",
};
export function visitorFor(s: GameState) {
  const kinds = s.orders.map((o) => o.kind);
  if (kinds.length && kinds.every((k) => k === "doctor" || k === "clinic"))
    return {
      name: "伊芙琳",
      role: "巷里的医生",
      sprite: 1,
      greeting: "门外又起风了。谢谢你肯听我说。",
    };
  if (kinds.length && kinds.every((k) => k === "army" || k === "royal"))
    return {
      name: "莱恩",
      role: "王国采购官",
      sprite: 2,
      greeting: "午安，店主。我带来了今天的采购单。",
    };
  return {
    name: "诺尔",
    role: kinds.some((k) => k === "smuggler" || k === "warblack")
      ? "夜巷信使"
      : "公会信使",
    sprite: 0,
    greeting: "店里的药香，隔着街都闻得到。我把今天的委托带来了。",
  };
}

export function visitorWords(s: GameState, o: Order): string {
  if (o.kind !== "guild" || s.day <= 3) return ORDER_WORDS[o.kind];
  const openings = [
    "新来的队伍在整理药箱。",
    "远行的人已经开始收拾行囊。",
    "上趟带回的药箱快空了。",
    "熟面孔让我先来问问你。",
  ][s.day % 4];
  return `${openings}这回需要${o.qty}瓶${PRODUCTS[o.product].name}，今天能备齐吗？`;
}
