import { IDS, type GameState, type ProductId, type Faction } from "./types";
import type { TownAction, Contract, SupplySource } from "./townTypes";
import { FACTION_IDS } from "./townTypes";
import { quantity, available, consume } from "./inventory";
import {
  CONTACTS,
  RANK_NAMES,
  relationRank,
  relationBenefits,
} from "./relations";
import { townOutlook } from "./forecasts";
import { PRODUCTS, FACTIONS } from "./config";
import { log, reputation } from "./events";
import { isIllegal } from "./economy";
export const transitValue = (s: GameState) =>
  s.town.deliveries.reduce((n, d) => n + d.cost * d.qty, 0);
export const transitQuantity = (s: GameState) =>
  s.town.deliveries.reduce((n, d) => n + d.qty, 0);
export const freeCapacity = (s: GameState) =>
  s.capacity - quantity(s) - transitQuantity(s);
export const activeContracts = (s: GameState) =>
  s.town.contracts.filter((c) => c.status === "active");
/** Allocate promises in acceptance order. A partially stocked pair never reserves each other out. */
export function reservedFor(
  s: GameState,
  id: ProductId,
  except?: string,
): number {
  let left = available(s, id),
    total = 0;
  for (const c of activeContracts(s)) {
    if (!c.reserve) continue;
    const need = c.lines.find((l) => l.product === id)?.qty ?? 0,
      n = Math.min(left, need);
    left -= n;
    if (c.id !== except) total += n;
  }
  return total;
}
export const usable = (s: GameState, id: ProductId, except?: string) =>
  Math.max(0, available(s, id) - reservedFor(s, id, except));
export function spotProduct(s: GameState): ProductId {
  return (["healing", "mana", "antidote"] as const)[(s.day + s.seed) % 3];
}
export function townQuote(s: GameState, source: SupplySource, id: ProductId) {
  const f =
      source === "reserve"
        ? "guild"
        : source === "official"
          ? "kingdom"
          : "black",
    r = relationRank(s, f),
    used = s.town.supplyDay === s.day ? s.town.used[source] : 0;
  let ratio = 1,
    cap = 0,
    blocked = "";
  if (source === "spot") {
    ratio = 0.9;
    cap = 4;
    if (id !== spotProduct(s)) blocked = "散货只出售今天这一种药品";
  } else if (!r) blocked = `先与${CONTACTS[f].name}熟识：拜访并达到20声望。`;
  else if (source === "reserve") {
    ratio = [1, 0.94, 0.92, 0.9][r];
    cap = r === 3 ? 6 : 4;
  } else if (source === "official") {
    ratio = [1, 0.97, 0.94, 0.92][r];
    cap = r === 3 ? 4 : 3;
    if (isIllegal(s, id)) blocked = "正规渠道不出售王国管制品";
  } else {
    ratio = [1, 1.18, 1.1, 1.04][r];
    cap = r === 3 ? 4 : 3;
  }
  if (!["spot", "reserve", "official", "black"].includes(source))
    blocked = "未知供货渠道";
  return {
    price: Math.max(1, Math.ceil(s.market[id].buy * ratio)),
    remaining: Math.max(0, cap - used),
    blocked,
    due: source === "reserve" ? s.day + 1 : s.day,
    batchDay:
      source === "spot" && id === "healing" ? Math.max(1, s.day - 2) : s.day,
  };
}
function makeContract(s: GameState, f: Faction): Contract {
  const step = Math.min(3, s.town.keys[f]),
    key = step < 3 && s.day >= [3, 10, 18][step],
    i = FACTION_IDS.indexOf(f),
    h = ((s.seed % 101) + s.day * 7 + i * 11) >>> 0;
  const legal = ["healing", "mana", "antidote"] as const;
  const p: ProductId =
      f === "black" && key ? "invisibility" : legal[(h + step) % 3],
    q = legal[(h + step + 1) % 3];
  const lines = key
    ? [
        { product: p, qty: 3 + step },
        { product: q, qty: 2 + step },
      ]
    : [{ product: p, qty: 3 + (h % 3) }];
  const ratio = key ? 1.04 : [0.88, 1.02, 1.12][h % 3];
  const title = key
    ? {
        guild: ["远征前的备药", "护送队的第二封信", "塞拉的长期名单"],
        kingdom: ["城门药箱", "药监官的复查", "米拉的供货名册"],
        black: ["暗巷的敲门砖", "雨夜的接头", "阿缇的信任"],
      }[f][step]
    : `${FACTIONS[f]}的预订药箱`;
  return {
    id: `promise-${s.day}-${f}`,
    faction: f,
    title,
    client: CONTACTS[f].name,
    lines,
    posted: s.day,
    deadline: s.day + (key ? 3 : 2),
    reward: Math.max(
      1,
      Math.round(
        lines.reduce((n, l) => n + s.market[l.product].reference * l.qty, 0) *
          ratio,
      ),
    ),
    rep: key ? 14 : 8,
    key,
    step,
    status: "offered",
    reserve: true,
  };
}
export function noticeRelations(s: GameState) {
  for (const f of FACTION_IDS) {
    const r = relationRank(s, f);
    if (r > s.town.announced[f]) {
      s.town.announced[f] = r;
      log(
        s,
        `${CONTACTS[f].name}送来回信：${FACTIONS[f]}关系成为「${RANK_NAMES[r]}」。${relationBenefits(s, f)[0]}`,
      );
    }
  }
}
export function prepareTown(s: GameState) {
  const freshDay = s.town.supplyDay !== s.day;
  if (s.town.supplyDay !== s.day) {
    s.town.supplyDay = s.day;
    s.town.used = { spot: 0, reserve: 0, official: 0, black: 0 };
  }
  if (s.day >= 3) {
    if (s.town.offers.some((o) => o.posted !== s.day) || !s.town.offers.length)
      s.town.offers = FACTION_IDS.map((f) => makeContract(s, f));
    if (freshDay && s.day % 5 === 3) {
      const f = townOutlook(s);
      if (f) log(s, `镇上的风声：${f.clue}布告栏留有接下来的线索。`);
    }
  }
  const arriving = s.town.deliveries.filter((d) => d.due <= s.day);
  for (const d of arriving) {
    s.batches.push({
      id: `arrival-${d.id}`,
      product: d.product,
      qty: d.qty,
      cost: d.cost,
      day: s.day,
    });
    log(
      s,
      `公会预订到货：${d.qty}瓶${PRODUCTS[d.product].name}，批次从今天计时。`,
      "trade",
    );
  }
  s.town.deliveries = s.town.deliveries.filter((d) => d.due > s.day);
  noticeRelations(s);
}
export function settleContracts(s: GameState) {
  for (const c of activeContracts(s))
    if (s.day >= c.deadline) {
      c.status = "failed";
      reputation(s, c.faction, -8);
      log(
        s,
        `「${c.title}」未能按约交货，${c.client}的信任受损，${FACTIONS[c.faction]}声望-8；药水仍留在仓库。`,
        "choice",
      );
    }
}
export function handleTownAction(
  s: GameState,
  a: TownAction,
): string | undefined {
  if (a.type === "travel") {
    if (!["shop", "town"].includes(a.location)) return "未知地点";
    s.location = a.location;
    return;
  }
  if (a.type === "reserve-contract") {
    const c = s.town.contracts.find(
      (c) => c.id === a.id && c.status === "active",
    );
    if (!c) return "没有这份在办委托";
    c.reserve = a.reserve;
    return;
  }
  if (s.location !== "town") return "请到镇上与联系人办理";
  if (a.type === "meet") {
    prepareTown(s);
    if (!FACTION_IDS.includes(a.faction)) return "未知联系人";
    if (!s.town.met[a.faction]) {
      s.town.met[a.faction] = true;
      log(
        s,
        `你认识了${CONTACTS[a.faction].place}的${CONTACTS[a.faction].name}。今后的约定，会让这段往来变得不同。`,
        "choice",
      );
    }
    return;
  }
  if (a.type === "town-buy") {
    prepareTown(s);
    if (!IDS.includes(a.product as ProductId)) return "未知药品";
    const id = a.product as ProductId;
    if (s.status !== "active") return "补齐经营欠款后才能采购";
    const q = townQuote(s, a.source, id);
    if (q.blocked) return q.blocked;
    if (!Number.isSafeInteger(a.qty) || a.qty < 1 || a.qty > q.remaining)
      return "数量无效或今日渠道供货已用完";
    if (a.qty > freeCapacity(s)) return "仓库空间不足；在途药品也占仓位";
    const cost = q.price * a.qty;
    if (cost > s.cash) return "现金不足";
    s.cash -= cost;
    s.book.purchases += cost;
    s.town.used[a.source] += a.qty;
    const serial = ++s.serial;
    if (a.source === "reserve")
      s.town.deliveries.push({
        id: `delivery-${serial}`,
        product: id,
        qty: a.qty,
        cost: q.price,
        due: q.due,
      });
    else
      s.batches.push({
        id: `town-lot-${serial}`,
        product: id,
        qty: a.qty,
        cost: q.price,
        day: s.day,
        ...(q.batchDay !== s.day ? { brewed: q.batchDay } : {}),
      });
    if (a.source === "black" && isIllegal(s, id)) {
      s.risk = Math.min(100, s.risk + 3 * a.qty);
      s.illegalToday = true;
      reputation(s, "kingdom", -a.qty);
    }
    log(
      s,
      `${a.source === "reserve" ? "预订" : "购入"}${a.qty}瓶${PRODUCTS[id].name}，支付${cost} G${a.source === "reserve" ? `，第${q.due}天到货并占用仓位` : ""}。`,
      "trade",
    );
    if (a.source === "black" && isIllegal(s, id))
      log(s, `暗巷管制品交易：风险+${3 * a.qty}，王国声望-${a.qty}。`, "risk");
    return;
  }
  if (a.type === "intel") {
    if (relationRank(s, "black") < 2) return "与阿缇建立合作后才能确认可靠情报";
    if (s.town.intelDay === s.day) return "今天的消息已经确认";
    if (!townOutlook(s)) return "暂时没有值得付费确认的消息";
    if (s.town.knownForecast === townOutlook(s)!.start)
      return "这条消息已经确认，不必再次付费";
    if (townOutlook(s)!.start <= s.day) return "这条消息已经发生，不必付费确认";
    if (s.cash < 5) return "情报费不足";
    s.cash -= 5;
    s.book.townCost += 5;
    s.town.intelDay = s.day;
    s.town.knownForecast = townOutlook(s)!.start;
    log(s, `阿缇确认了来路可靠的消息：${townOutlook(s)!.detail}`, "choice");
    return;
  }
  if (a.type === "contract") {
    if (a.choice === "accept" || a.choice === "decline") {
      const c = s.town.offers.find(
        (c) => c.id === a.id && c.posted === s.day && c.status === "offered",
      );
      if (!c) return "这份报价已处理或已过期";
      if (!s.town.met[c.faction]) return "先认识委托人";
      if (a.choice === "decline") {
        c.status = "declined";
        return;
      }
      if (activeContracts(s).length >= 2) return "最多同时保留两份在办委托";
      if (activeContracts(s).some((x) => x.faction === c.faction))
        return "先处理与这位联系人的上一份约定";
      c.status = "active";
      s.town.contracts.push(structuredClone(c));
      s.town.contracts = s.town.contracts
        .filter((c) => c.status === "active")
        .concat(
          s.town.contracts.filter((c) => c.status !== "active").slice(-24),
        );
      log(
        s,
        `答应${c.client}「${c.title}」，请在第${c.deadline}天打烊前到${CONTACTS[c.faction].place}交付；默认留货，不参加零售。`,
        "choice",
      );
      return;
    }
    const c = s.town.contracts.find(
      (c) => c.id === a.id && c.status === "active",
    );
    if (!c) return "委托已处理或不存在";
    if (a.choice === "cancel") {
      c.status = "cancelled";
      reputation(s, c.faction, -4);
      log(
        s,
        `你提前向${c.client}取消「${c.title}」，${FACTIONS[c.faction]}声望-4，货物保留。`,
        "choice",
      );
      return;
    }
    if (s.day > c.deadline) return "交货期限已经过去";
    if (c.lines.some((l) => usable(s, l.product, c.id) < l.qty))
      return "有效库存不足，或药品已优先留给另一份约定";
    let cost = 0;
    for (const l of c.lines) {
      cost += consume(s, l.product, l.qty).cost;
      s.book.townUnits += l.qty;
    }
    c.status = "fulfilled";
    s.cash += c.reward;
    s.book.orderRevenue += c.reward;
    s.book.orderCogs += cost;
    reputation(s, c.faction, c.rep);
    if (c.key)
      s.town.keys[c.faction] = Math.max(s.town.keys[c.faction], c.step + 1);
    const illegal = c.lines
      .filter((l) => isIllegal(s, l.product))
      .reduce((n, l) => n + l.qty, 0);
    if (illegal) {
      s.risk = Math.min(100, s.risk + illegal * 5);
      s.illegalToday = true;
      reputation(s, "kingdom", -illegal);
    }
    log(
      s,
      `${c.client}收到了「${c.title}」，报酬${c.reward} G已付。${illegal ? `管制品交付增加风险${illegal * 5}、王国声望-${illegal}。` : ""}${c.key ? "这段关键合作被记了下来。" : ""}`,
      "choice",
    );
    return;
  }
}
