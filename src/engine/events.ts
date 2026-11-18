import { ordinaryTerms } from "./forecasts";
import { routineReputation } from "./relations";
import type {
  GameState,
  Order,
  OrderKind,
  Effect,
  Faction,
  ChainId,
} from "./types";
import { RULES, PRODUCTS, FACTIONS } from "./config";
import { random, clamp } from "./random";
import { consume } from "./inventory";
export function log(
  s: GameState,
  text: string,
  kind: "world" | "choice" | "risk" | "trade" = "world",
) {
  s.log.push({ id: `log-${++s.serial}`, day: s.day, text, kind });
  if (s.log.length > 600) s.log.shift();
  if (kind === "world" || kind === "risk") s.news.push(text);
}
export function reputation(s: GameState, faction: Faction, n: number) {
  s.reputation[faction] = clamp(s.reputation[faction] + n, -100, 100);
}
const effect = (
  id: string,
  title: string,
  description: string,
  buy: Effect["buy"],
  demand: Effect["demand"],
  supply: Effect["supply"],
): Omit<Effect, "until"> => ({ id, title, description, buy, demand, supply });
export const INDEPENDENTS = [
  effect(
    "sale",
    "供应商促销",
    "批发商清仓：治疗与魔力进价走低，供货增加，持续 2 天。",
    { healing: 0.8, mana: 0.8 },
    {},
    { healing: 1.3, mana: 1.3 },
  ),
  effect(
    "raid",
    "商队遇袭",
    "林道不再安全：所有进价承压上涨，供货减半，持续 2 天。",
    { healing: 1.3, mana: 1.3, antidote: 1.3, invisibility: 1.3, berserk: 1.3 },
    {},
    { healing: 0.5, mana: 0.5, antidote: 0.5, invisibility: 0.5, berserk: 0.5 },
  ),
  effect(
    "victory",
    "冒险者凯旋",
    "战利品与伤员一起归来：治疗、魔力需求上涨，持续 2 天。",
    {},
    { healing: 1.5, mana: 1.5 },
    {},
  ),
  effect(
    "accident",
    "魔法事故",
    "法师塔封锁：魔力供货减少、解毒需求上涨，持续 2 天。",
    { mana: 1.3 },
    { antidote: 1.6 },
    { mana: 0.5 },
  ),
  effect(
    "collector",
    "神秘收藏家",
    "收藏家进城：隐身需求增加，并带来限时收购单，持续 2 天。",
    {},
    { invisibility: 1.5 },
    {},
  ),
  effect(
    "harvest",
    "丰收季节",
    "药草丰收：治疗、解毒成本下降、供货增加，持续 2 天。",
    { healing: 0.8, antidote: 0.8 },
    {},
    { healing: 1.3, antidote: 1.3 },
  ),
];
export function makeOrder(s: GameState, kind: OrderKind): Order {
  const configs: Record<
    OrderKind,
    [Order["product"], number, number, string, string, Faction, number, number]
  > = {
    army: [
      "healing",
      2,
      66,
      "军方征购",
      "交付 2 瓶治疗药水，王国 +8；两天后军需官回访。",
      "kingdom",
      8,
      0,
    ],
    warblack: [
      "berserk",
      2,
      160,
      "暗巷军火商",
      "交付 2 瓶狂暴药剂，黑市 +12、风险 +20、王国 -5。",
      "black",
      12,
      20,
    ],
    doctor: [
      "antidote",
      2,
      42,
      "医生的请求",
      "低价援助 2 瓶解毒药剂，公会 +12；两天后开启诊所合作。",
      "guild",
      12,
      0,
    ],
    smuggler: [
      "invisibility",
      2,
      204,
      "没有署名的订单",
      "交付 2 瓶隐身药剂，黑市 +12、风险 +20、王国 -5。后果将在两天后浮现。",
      "black",
      12,
      20,
    ],
    guild: [
      "healing",
      2,
      66,
      "公会的补给箱",
      "交付 2 瓶治疗药水，公会 +8。",
      "guild",
      8,
      0,
    ],
    royal: [
      "mana",
      2,
      112,
      "王国法师采购",
      "交付 2 瓶魔力药水，王国 +8。",
      "kingdom",
      8,
      0,
    ],
    collector: [
      "mana",
      2,
      124,
      "收藏家的藏品",
      "交付 2 瓶魔力药水，公会 +5。",
      "guild",
      5,
      0,
    ],
    clinic: [
      "antidote",
      2,
      86,
      "诊所合作订单",
      "此前的援助换来长期信任，交付 2 瓶解毒药剂，公会 +6。",
      "guild",
      6,
      0,
    ],
  };
  let [product, qty, base, title, description, faction, rep, risk] =
    configs[kind];
  // Fixed for this order/day; scales with current reference but no reputation profit multiplier.
  let reward =
    kind === "doctor"
      ? base
      : Math.round(base * (s.market[product]?.factor ?? 1));
  if (kind === "guild" || kind === "royal")
    ({ product, qty, reward } = ordinaryTerms(s, kind));
  return {
    id: `order-${s.day}-${++s.serial}`,
    kind,
    product,
    qty,
    reward,
    title,
    description,
    faction,
    rep,
    risk,
    status: "open",
    day: s.day,
  };
}
/** One visible messenger can carry the day's existing story commissions. */
export function prepareDailyVisitor(s: GameState) {
  if (!s.orders.length) s.orders.push(makeOrder(s, "guild"));
  for (const o of s.orders)
    if (o.kind === "guild" || o.kind === "royal") {
      const terms = ordinaryTerms(s, o.kind);
      o.product = terms.product;
      o.qty = terms.qty;
      o.reward = terms.reward;
    }
}
export function resolveOrder(s: GameState, o: Order, accept: boolean) {
  o.status = accept ? "accepted" : "declined";
  let chain: ChainId | undefined,
    choice = "",
    kind: "army" | "warblack" | "clinic" | "smuggling" | undefined;
  if (o.kind === "army" || o.kind === "warblack") {
    chain = "war";
    choice = accept ? o.kind : "normal";
    kind = o.kind;
    for (const other of s.orders)
      if (
        other.id !== o.id &&
        (other.kind === "army" || other.kind === "warblack")
      )
        other.status = "declined";
  }
  if (o.kind === "doctor") {
    chain = "plague";
    choice = accept ? "help" : "refuse";
    kind = "clinic";
  }
  if (o.kind === "smuggler") {
    chain = "smuggling";
    choice = accept ? "accept" : "refuse";
    kind = "smuggling";
  }
  if (chain) {
    s.chains[chain].choice = choice;
    if (accept && kind)
      s.delayed.push({
        id: `delay-${o.id}`,
        due: s.day + 2,
        chain,
        start: s.chains[chain].start,
        choice,
        kind,
      });
  }
  if (!accept) {
    log(s, `拒绝「${o.title}」：保留库存；不消耗行动。`, "choice");
    return;
  }
  const used = consume(s, o.product, o.qty);
  s.cash += o.reward;
  s.book.orderRevenue += o.reward;
  s.book.orderCogs += used.cost;
  s.actions++;
  const gained = routineReputation(s, o.kind, o.rep);
  reputation(s, o.faction, gained);
  if (o.risk) {
    s.risk = clamp(s.risk + o.risk, 0, 100);
    s.illegalToday = true;
    reputation(s, "kingdom", -5);
  }
  log(
    s,
    `完成「${o.title}」：交付 ${o.qty} 瓶${PRODUCTS[o.product].name}，收入 ${o.reward} G，${FACTIONS[o.faction]}声望+${gained}。`,
    "choice",
  );
}
export function investigate(s: GameState, roll: number) {
  if (s.risk < 50) return 0;
  const chance =
    s.risk >= 75
      ? RULES.dangerMin +
        ((s.risk - 75) / 25) * (RULES.dangerMax - RULES.dangerMin)
      : RULES.highMin + ((s.risk - 50) / 24) * (RULES.highMax - RULES.highMin);
  if (roll >= chance) return 0;
  const severe =
    s.warningDay !== null &&
    s.warningDay < s.day &&
    s.strikes >= 1 &&
    s.risk >= RULES.severeRisk &&
    s.illegalToday;
  const fine = Math.min(s.cash, RULES.fine + s.strikes * 15);
  s.cash -= fine;
  let seized = 0,
    cost = 0;
  s.batches = s.batches.filter((b) => {
    if (
      b.product === "invisibility" ||
      (b.product === "berserk" && s.chains.war.stage === "active")
    ) {
      seized += b.qty;
      cost += b.qty * b.cost;
      return false;
    }
    return true;
  });
  reputation(s, "kingdom", -10);
  s.strikes++;
  if (s.warningDay === null) s.warningDay = s.day;
  log(
    s,
    `执法调查：罚款 ${fine} G，没收 ${seized} 瓶违禁品（成本 ${cost} G）。正式警告：此后风险 ≥90 且继续违法并再次被查，将永久查封。`,
    "risk",
  );
  if (severe) {
    s.status = "ended";
    s.reason = "正式警告后仍严重违法，店铺被永久查封。";
    log(s, s.reason, "risk");
  }
  return fine + cost;
}
export function advanceEvents(s: GameState) {
  s.effects = s.effects.filter((e) => e.until >= s.day);
  const due = s.delayed.filter((d) => d.due <= s.day);
  s.delayed = s.delayed.filter((d) => d.due > s.day);
  for (const d of due) {
    const c = s.chains[d.chain];
    if (c.start !== d.start || c.choice !== d.choice) continue;
    if (d.kind === "army") {
      reputation(s, "kingdom", 5);
      log(s, "军需官回访：前次援助被记在名册，王国 +5，未来可获得王国订单。");
    }
    if (d.kind === "warblack") {
      reputation(s, "black", 5);
      s.risk = clamp(s.risk + 10, 0, 100);
      log(s, "战时黑市牵线：黑市 +5，执法者已听说这笔交易，风险 +10。", "risk");
    }
    if (d.kind === "clinic") {
      reputation(s, "guild", 8);
      log(s, "诊所合作开启：医生记住了援手，公会 +8，今日提供合作订单。");
      s.orders.push(makeOrder(s, "clinic"));
    }
    if (d.kind === "smuggling") {
      if (s.risk >= 50) {
        s.risk = clamp(s.risk + 5, 0, 100);
        log(
          s,
          "走私线人预警：巡查队已盯上暗巷，风险 +5。暂停非法交易可每日降低 5 点。",
          "risk",
        );
      } else {
        reputation(s, "black", 5);
        log(s, "走私合作回信：此前的交易建立了信任，黑市 +5；今天保持低调。");
      }
    }
  }
  for (const id of ["war", "plague", "smuggling"] as const) {
    const c = s.chains[id];
    if (c.stage === "rumor" && s.day >= c.start + 2) {
      c.stage = "active";
      c.end = s.day + (id === "war" ? 3 + Math.floor(random(s) * 4) : 4) - 1;
      log(
        s,
        id === "war"
          ? "战争爆发：治疗与狂暴需求 ×1.8；狂暴药剂战时管制。可供应军方、黑市，或正常经营。"
          : id === "plague"
            ? "疫病蔓延：解毒需求 ×2.2。医生登门寻求低价援助；高价销售可能引发投诉。"
            : "神秘买家抵达暗巷，准备收购隐身药剂。",
      );
    }
    if (c.stage === "active" && s.day > c.end) {
      c.stage = "cooldown";
      c.cooldown = s.day + 12;
      log(
        s,
        id === "war"
          ? "停战钟声响起。战时管制结束，价格将逐日回归。"
          : id === "plague"
            ? "疫病渐退。药草需求恢复，诊所仍记得你的选择。"
            : "走私路线暂时关闭。过去的选择仍影响声望与风险。",
      );
    }
    if (c.stage === "cooldown" && s.day >= c.cooldown) c.stage = "idle";
  }
  if (
    !s.chains.war.choice &&
    s.chains.war.stage === "active" &&
    !s.orders.some((o) => o.kind === "army")
  ) {
    s.orders.push(makeOrder(s, "army"), makeOrder(s, "warblack"));
  }
  if (
    !s.chains.plague.choice &&
    s.chains.plague.stage === "active" &&
    !s.orders.some((o) => o.kind === "doctor")
  )
    s.orders.push(makeOrder(s, "doctor"));
  if (
    !s.chains.smuggling.choice &&
    s.chains.smuggling.stage === "active" &&
    !s.orders.some((o) => o.kind === "smuggler")
  )
    s.orders.push(makeOrder(s, "smuggler"));
}
export function rollEvents(s: GameState) {
  const majorBusy = ["war", "plague"].some((id) =>
    ["rumor", "active"].includes(s.chains[id as ChainId].stage),
  );
  if (s.day >= 3 && !majorBusy) {
    const roll = random(s);
    const id: ChainId = roll < 0.5 ? "war" : "plague";
    const c = s.chains[id];
    if (c.stage === "idle" && random(s) < 0.22) {
      Object.assign(c, { stage: "rumor", start: s.day, end: 0, choice: null });
      log(
        s,
        id === "war"
          ? "边境传来调兵的消息。两日内可能交战，治疗与狂暴需求或将上升。"
          : "外地医师谈起一种怪病。两日内可能蔓延，解毒药剂或许紧俏。",
      );
    }
  }
  if (
    s.day >= 4 &&
    s.chains.smuggling.stage === "idle" &&
    s.reputation.black > -30 &&
    random(s) < 0.16
  ) {
    Object.assign(s.chains.smuggling, {
      stage: "rumor",
      start: s.day,
      end: 0,
      choice: null,
    });
    log(s, "有人在门缝塞入黑蜡信封：两天后，一位买家会来谈隐身药剂。");
  }
  if (s.day >= 2 && s.effects.length < 2 && random(s) < 0.28) {
    const e = INDEPENDENTS[Math.floor(random(s) * INDEPENDENTS.length)];
    if ((s.eventCooldowns[e.id] ?? 0) <= s.day) {
      s.effects.push({ ...structuredClone(e), until: s.day + 1 });
      s.eventCooldowns[e.id] = s.day + 7;
      log(s, `${e.title}：${e.description}`);
      if (e.id === "collector") s.orders.push(makeOrder(s, "collector"));
    }
  }
  if (s.day >= 3 && random(s) < Math.min(0.55, 0.18 + s.day * 0.004)) {
    if (s.reputation.guild >= 0) s.orders.push(makeOrder(s, "guild"));
    if (s.reputation.kingdom >= 5) s.orders.push(makeOrder(s, "royal"));
    if (
      s.reputation.guild >= 20 &&
      s.chains.plague.choice === "help" &&
      random(s) < 0.4
    )
      s.orders.push(makeOrder(s, "clinic"));
  }
}
