import { relationRank } from "./relations";
import type { GameState, HazardKind, HazardResult } from "./types";
import { RULES, PRODUCTS } from "./config";
import { random } from "./random";
import { consume, quantity } from "./inventory";
import { log } from "./events";
export const HAZARDS: Record<
  HazardKind,
  { name: string; clue: string; effect: string; advice: string }
> = {
  theft: {
    name: "暗巷窃贼",
    clue: "附近出现了盯着钱匣的陌生人。",
    effect: "若发生，失去当时现金的16%，最多80 G。",
    advice: "别让大量现金闲置，也要留够经营费用。",
  },
  spill: {
    name: "货架震颤",
    clue: "地板传来轻微震动，玻璃瓶正在碰响。",
    effect: "若发生，一类库存药水可能破损1–3瓶。",
    advice: "减少囤货，先交付已经备齐的委托。",
  },
  blackout: {
    name: "魔灯不稳",
    clue: "街上的魔灯时明时暗，晚间客流可能受阻。",
    effect: "若发生，今晚全部药水零售需求乘0.65。",
    advice: "控制补货；访客委托不受零售客流影响。",
  },
  repair: {
    name: "符文老化",
    clue: "门框的防护符文裂开了一角。",
    effect: "若发生，今晚需支付36–60 G临时修缮费。",
    advice: "额外留出应急金，付不起会记入经营欠款。",
  },
};
export const merchantAvailable = (s: GameState) =>
  s.crystalUnlockedDay === null && s.day >= 6 && (s.day - 6) % 3 === 0;
export const permitDue = (s: GameState) =>
  s.day % 7 === 0 ? (relationRank(s, "kingdom") >= 2 ? 24 : RULES.permit) : 0;
export const baseDailyDue = (s: GameState) =>
  RULES.fixed +
  RULES.care +
  (s.accountantHiredDay === null ? 0 : RULES.accountantSalary) +
  permitDue(s);
export function prepareHazard(s: GameState) {
  if (s.day <= 2 || s.lastIncidentDay === s.day - 1) {
    s.omen = { kind: null, chance: 0 };
    if (s.lastIncidentDay === s.day - 1)
      log(s, "昨天的意外后，街坊帮忙加固了小店。今晚店内暂时平静。");
    return;
  }
  const kinds = Object.keys(HAZARDS) as HazardKind[],
    kind = kinds[Math.floor(random(s) * kinds.length)];
  s.omen = { kind, chance: [0.14, 0.28, 0.44][Math.floor(random(s) * 3)] };
  log(
    s,
    `护店预警·${HAZARDS[kind].name}：${HAZARDS[kind].clue}今夜发生概率${Math.round(s.omen.chance * 100)}%。`,
  );
}
/** Mutates a day draft. Rolls are supplied by closing, so refresh and UI do not reroll. */
export function resolveHazard(
  s: GameState,
  roll: number,
  severity: number,
  pick: number,
): HazardResult | undefined {
  const { kind, chance } = s.omen;
  if (!kind || !chance) return;
  const actualChance =
    chance * (s.wardDay === s.day ? 1 - RULES.wardReduction : 1);
  const r: HazardResult = {
    kind,
    chance,
    actualChance,
    triggered: roll < actualChance,
    averted: roll >= actualChance && roll < chance,
    cashLost: 0,
    stockCost: 0,
    repairCost: 0,
    demandFactor: 1,
    detail: "",
  };
  if (!r.triggered) {
    r.detail = r.averted
      ? "水晶球的结界亮起，今晚的意外被避开了。"
      : "今夜的预警没有成真。";
    log(s, r.detail, "trade");
    return r;
  }
  s.lastIncidentDay = s.day;
  if (kind === "theft") {
    r.cashLost = Math.min(s.cash, 80, Math.ceil(s.cash * 0.16));
    s.cash -= r.cashLost;
    r.detail = `暗巷窃贼摸走钱匣中的${r.cashLost} G。`;
  } else if (kind === "spill") {
    const bottles = s.batches.flatMap((b) =>
        Array.from({ length: b.qty }, () => b.product),
      ),
      id =
        bottles[
          Math.min(bottles.length - 1, Math.floor(pick * bottles.length))
        ];
    if (id) {
      const used = consume(s, id, 1 + Math.floor(severity * 3));
      r.stockCost = used.cost;
      r.detail = `货架晃动，${used.qty}瓶${PRODUCTS[id].name}破损，库存成本损失${used.cost} G。`;
    } else r.detail = "货架震颤，但没有库存药水受损。";
  } else if (kind === "blackout") {
    r.demandFactor = 0.65;
    r.detail = "魔灯熄灭，今晚的零售需求降至原来的65%，访客委托不受影响。";
  } else {
    r.repairCost = 36 + Math.floor(severity * 25);
    r.detail = `门框符文破损，今晚新增修缮费用${r.repairCost} G。`;
  }
  log(s, r.detail, "trade");
  return r;
}
