import { newTown } from "./townTypes";
import {
  prepareTown,
  noticeRelations,
  handleTownAction,
  settleContracts,
  usable,
  freeCapacity,
  transitValue,
} from "./town";
import type { TownAction } from "./townTypes";
import { actionCost, remainingActions } from "./actions";
import { draft } from "./draft";
import { IDS } from "./types";
import type {
  GameState,
  Result,
  Action,
  DayBook,
  ProductId,
  Ledger,
} from "./types";
import { RULES } from "./config";
import { integer, random, clamp } from "./random";
import {
  generateMarket,
  demandBreakdown,
  priceBounds,
  isIllegal,
} from "./economy";
import {
  quantity,
  inventoryValue,
  consume,
  expire,
  available,
} from "./inventory";
import {
  advanceEvents,
  rollEvents,
  resolveOrder,
  investigate,
  log,
  reputation,
  prepareDailyVisitor,
} from "./events";
import { PRODUCTS } from "./config";
import {
  merchantAvailable,
  prepareHazard,
  resolveHazard,
  baseDailyDue,
  permitDue,
} from "./hazards";
export const netAssets = (s: GameState) =>
  s.cash + inventoryValue(s) + transitValue(s) - s.debt - s.arrears;
export const newBook = (s: GameState): DayBook => ({
  openingCash: s.cash,
  purchases: 0,
  orderRevenue: 0,
  orderCogs: 0,
  repaid: 0,
  arrearsPaid: 0,
  finance: 0,
  staffCost: 0,
  crystalCost: 0,
  townCost: 0,
  townUnits: 0,
  openingRisk: s.risk,
  openingRep: { ...s.reputation },
});
export function createGame(seed = 20261023): GameState {
  const s: GameState = {
    version: 2,
    location: "shop",
    town: newTown(),
    seed: seed >>> 0,
    rng: seed >>> 0,
    revision: 0,
    day: 1,
    cash: 500,
    debt: 300,
    capacity: 30,
    arrears: 0,
    defaultSince: null,
    status: "active",
    reason: null,
    phase: "planning",
    batches: [],
    market: {} as GameState["market"],
    prices: {} as GameState["prices"],
    reputation: { kingdom: 0, guild: 0, black: 0 },
    risk: 0,
    actions: 0,
    actionPointsUsed: 0,
    illegalToday: false,
    warningDay: null,
    strikes: 0,
    financeUsed: false,
    accountantHiredDay: null,
    newsReadDay: 0,
    crystalUnlockedDay: null,
    wardDay: 0,
    lastIncidentDay: null,
    omen: { kind: null, chance: 0 },
    chains: {
      war: { stage: "idle", start: 0, end: 0, cooldown: 0, choice: null },
      plague: { stage: "idle", start: 0, end: 0, cooldown: 0, choice: null },
      smuggling: { stage: "idle", start: 0, end: 0, cooldown: 0, choice: null },
    },
    delayed: [],
    effects: [],
    eventCooldowns: {},
    orders: [],
    log: [],
    ledger: [],
    book: {} as DayBook,
    news: [],
    stats: { revenue: 0, maxLoss: 0, days: 0 },
    serial: 0,
  };
  s.book = newBook(s);
  generateMarket(s);
  prepareDailyVisitor(s);
  prepareTown(s);
  log(
    s,
    "荣誉榜已挂上门旁，镇上的集市、公会和旧巷都可拜访；出门走路免费。白天备货，入夜后黑市才开门。每日8点行动，走路与查看免费。先少量备货，留出每日租金12 G与保养4 G；售出或交付每瓶耗材2 G，留存每瓶护养1 G，每七日许可费30 G。隐身交易会引来调查。",
  );
  return s;
}
const failed = (state: GameState, error: string): Result => ({ state, error });
export function act(state: GameState, a: Action): Result {
  if (a.type === "end") return closeDay(state, a.day);
  if (a.type === "ack") {
    if (state.phase !== "report") return failed(state, "没有待确认的营业报告");
    const s = draft(state);
    s.phase = "planning";
    s.revision++;
    return { state: s };
  }
  if (state.status === "ended")
    return failed(state, "本轮经营已结束，请重新开始");
  if (state.phase !== "planning") return failed(state, "请先确认营业报告");
  if (a.type === "ack-news" && state.newsReadDay >= state.day) return { state };
  const cost = actionCost(state, a);
  if (cost > remainingActions(state))
    return failed(
      state,
      `行动力不足：本次需要${cost}点，今日剩余${remainingActions(state)}点。仍可查看、拒单、还款或入夜开业。`,
    );
  const s = draft(state);
  if (a.type === "ack-news") s.newsReadDay = s.day;
  if (
    [
      "travel",
      "meet",
      "town-buy",
      "contract",
      "reserve-contract",
      "intel",
    ].includes(a.type)
  ) {
    const error = handleTownAction(s, a as TownAction);
    if (error) return failed(state, error);
  }
  if (a.type === "buy-crystal") {
    if (!merchantAvailable(s))
      return failed(state, "黑市商人今天不在，或水晶球已购入");
    if (s.status !== "active") return failed(state, "请先补齐经营欠款");
    if (s.cash < RULES.crystalUnlock)
      return failed(state, "购入水晶球的现金不足");
    s.cash -= RULES.crystalUnlock;
    s.book.crystalCost += RULES.crystalUnlock;
    s.crystalUnlockedDay = s.day;
    log(
      s,
      `从黑市商人处购入水晶球，支付 ${RULES.crystalUnlock} G。它被摆在左下木箱上，每次护店占卜另付 ${RULES.crystalUse} G。`,
      "trade",
    );
  }
  if (a.type === "ward") {
    if (s.crystalUnlockedDay === null)
      return failed(state, "请先向黑市商人购入水晶球");
    if (s.wardDay === s.day) return failed(state, "今晚的护店结界已经准备好");
    if (!s.omen.kind || !s.omen.chance)
      return failed(state, "今晚平静，无需付费占卜");
    if (s.status !== "active") return failed(state, "请先补齐经营欠款");
    if (s.cash < RULES.crystalUse) return failed(state, "护店占卜费用不足");
    s.cash -= RULES.crystalUse;
    s.book.crystalCost += RULES.crystalUse;
    s.wardDay = s.day;
    log(
      s,
      `支付 ${RULES.crystalUse} G 激活今晚的护店结界，店内意外概率降低60%，仍可能发生。`,
      "trade",
    );
  }
  if (a.type === "hire-accountant") {
    if (s.accountantHiredDay !== null) return failed(state, "财务人员已经入职");
    if (s.status !== "active") return failed(state, "请先补齐逾期欠款");
    if (s.cash < RULES.accountantHire) return failed(state, "雇佣费用不足");
    s.cash -= RULES.accountantHire;
    s.book.staffCost += RULES.accountantHire;
    s.accountantHiredDay = s.day;
    log(
      s,
      `财务人员埃德温入职，支付雇佣费用 ${RULES.accountantHire} G。`,
      "trade",
    );
  }
  if (a.type === "buy" || a.type === "price") {
    if (!IDS.includes(a.product as ProductId)) return failed(state, "未知商品");
    const id = a.product as ProductId,
      m = s.market[id];
    if (a.type === "buy") {
      const n = a.qty;
      if (s.status === "default")
        return failed(state, "补救期暂停采购，请先偿还逾期欠款");
      if (!integer(n) || n < 1) return failed(state, "采购数量须为正整数");
      if (n > m.remaining) return failed(state, "今日剩余供应不足");
      if (n > freeCapacity(s)) return failed(state, "仓库空间不足");
      const cost = n * m.buy;
      if (cost > s.cash) return failed(state, "现金不足");
      s.cash -= cost;
      s.book.purchases += cost;
      m.remaining -= n;
      s.batches.push({
        id: `batch-${++s.serial}`,
        product: id,
        qty: n,
        cost: m.buy,
        day: s.day,
      });
    } else {
      const [low, high] = priceBounds(m.reference);
      if (!integer(a.price) || a.price < low || a.price > high)
        return failed(state, `售价须为 ${low}–${high} G 的整数`);
      s.prices[id] = a.price;
    }
  }
  if (a.type === "order") {
    const o = s.orders.find((o) => o.id === a.id);
    if (!o || o.day !== s.day || o.status !== "open")
      return failed(state, "订单已处理或已失效");
    if (a.accept) {
      if (s.actions >= 2) return failed(state, "今日两次特殊行动已用完");
      if (usable(s, o.product) < o.qty)
        return failed(state, "有效库存不足，请先备货");
      if (
        (o.kind === "army" || o.kind === "warblack") &&
        (s.chains.war.stage !== "active" || s.chains.war.choice !== null)
      )
        return failed(state, "军需选择已结束");
      if (
        o.kind === "doctor" &&
        (s.chains.plague.stage !== "active" || s.chains.plague.choice !== null)
      )
        return failed(state, "援助时机已结束");
      if (
        o.kind === "smuggler" &&
        (s.chains.smuggling.stage !== "active" ||
          s.chains.smuggling.choice !== null)
      )
        return failed(state, "走私时机已结束");
    }
    resolveOrder(s, o, a.accept);
  }
  if (a.type === "repay" || a.type === "arrears") {
    const amount = a.amount,
      max = a.type === "repay" ? s.debt : s.arrears;
    if (!integer(amount) || amount < 1 || amount > max || amount > s.cash)
      return failed(state, "还款金额无效或现金不足");
    s.cash -= amount;
    if (a.type === "repay") {
      s.debt -= amount;
      s.book.repaid += amount;
    } else {
      s.arrears -= amount;
      s.book.arrearsPaid += amount;
      if (s.arrears === 0) {
        s.defaultSince = null;
        s.status = "active";
        log(s, "逾期欠款已补齐，恢复正常采购。", "trade");
      }
    }
  }
  if (a.type === "finance") {
    if (s.financeUsed || s.reputation.guild < 20 || s.status !== "default")
      return failed(state, "紧急融资需公会声望 ≥20、处于补救期，且仅一次");
    s.cash += 100;
    s.debt += 100;
    s.book.finance += 100;
    s.financeUsed = true;
    log(s, "公会紧急融资到账 100 G，同时新增债务 100 G。", "trade");
  }
  noticeRelations(s);
  s.actionPointsUsed = (state.actionPointsUsed ?? state.actions * 2) + cost;
  s.revision++;
  return { state: s };
}
export function closeDay(state: GameState, expectedDay: number): Result {
  if (
    state.day !== expectedDay ||
    state.phase !== "planning" ||
    state.status === "ended"
  )
    return failed(state, "这一天已经结算，或尚未确认上一份报告");
  if (state.location !== "shop") return failed(state, "请先回店准备开业");
  const s = draft(state);
  const settledDay = s.day,
    startLogIds = new Set(s.log.map((l) => l.id));
  settleContracts(s);
  const incident = s.omen.kind
    ? resolveHazard(s, random(s), random(s), random(s))
    : undefined;
  let revenue = s.book.orderRevenue,
    cogs = s.book.orderCogs;
  const sales = Object.fromEntries(IDS.map((id) => [id, 0])) as Ledger["sales"];
  const saleDetails = {} as NonNullable<Ledger["saleDetails"]>;
  for (const id of IDS) {
    const stock = usable(s, id);
    const details = demandBreakdown(
      PRODUCTS[id],
      {
        ...s.market[id],
        demand: s.market[id].demand * (incident?.demandFactor ?? 1),
      },
      s.prices[id],
      0.85 + random(s) * 0.3,
    );
    const sold = consume(s, id, Math.min(stock, details.potential));
    saleDetails[id] = {
      ...details,
      stock,
      held: available(s, id) + sold.qty - stock,
      sold: sold.qty,
      revenue: sold.qty * s.prices[id],
      cogs: sold.cost,
      expired: 0,
    };
    sales[id] = sold.qty;
    revenue += sold.qty * s.prices[id];
    cogs += sold.cost;
    if (sold.qty && isIllegal(s, id)) {
      s.illegalToday = true;
      s.risk = clamp(s.risk + sold.qty * RULES.riskPerUnit, 0, 100);
      reputation(s, "kingdom", -sold.qty);
      log(
        s,
        `售出 ${sold.qty} 瓶违禁${PRODUCTS[id].name}：风险 +${sold.qty * RULES.riskPerUnit}，王国 -${sold.qty}。`,
        "risk",
      );
    }
    if (
      id === "antidote" &&
      sold.qty > 0 &&
      s.chains.plague.stage === "active" &&
      s.prices[id] > s.market[id].reference * 1.25
    ) {
      s.risk = clamp(s.risk + 8, 0, 100);
      reputation(s, "guild", -4);
      log(s, "疫病期间高价销售解毒药引发投诉：风险 +8，公会 -4。", "risk");
    }
  }
  s.cash += revenue - s.book.orderRevenue;
  const expired = expire(s);
  saleDetails.healing.expired = expired.qty;
  if (expired.qty)
    log(
      s,
      `${expired.qty} 瓶治疗药水过期，损失采购成本 ${expired.cost} G。`,
      "trade",
    );
  // On the last grace day, ordinary sales may be the rescue. Apply proceeds before
  // checking the deadline, and retain the original deadline if this day's rent fails.
  if (s.defaultSince !== null && s.day >= s.defaultSince + 2 && s.arrears > 0) {
    const paid = Math.min(s.cash, s.arrears);
    s.cash -= paid;
    s.arrears -= paid;
    s.book.arrearsPaid += paid;
    if (paid) log(s, `补救期末自动补付经营欠款 ${paid} G。`, "trade");
  }
  const staffSalary =
    s.accountantHiredDay === null ? 0 : RULES.accountantSalary;
  const careCost = RULES.care;
  const units =
    IDS.reduce((sum, id) => sum + sales[id], 0) +
    s.book.townUnits +
    s.orders
      .filter((o) => o.status === "accepted")
      .reduce((sum, o) => sum + o.qty, 0);
  const serviceCost = units * RULES.handling;
  const storageCost = quantity(s) * RULES.storage;
  const permitCost = permitDue(s);
  const repairCost = incident?.repairCost ?? 0;
  const runningCost =
    staffSalary +
    careCost +
    serviceCost +
    storageCost +
    permitCost +
    repairCost;
  const fixedPaid = Math.min(s.cash, RULES.fixed);
  s.cash -= fixedPaid;
  const runningPaid = Math.min(s.cash, runningCost);
  s.cash -= runningPaid;
  const unpaid = RULES.fixed + runningCost - fixedPaid - runningPaid;
  if (unpaid > 0) {
    s.arrears += unpaid;
    if (s.defaultSince === null) s.defaultSince = s.day;
    s.status = "default";
    log(
      s,
      `经营费未付 ${unpaid} G；欠款共 ${s.arrears} G，最迟第 ${s.defaultSince + 2} 天末补齐。`,
      "risk",
    );
  }
  if (s.arrears === 0 && unpaid === 0 && s.status === "default") {
    s.status = "active";
    s.defaultSince = null;
    log(s, "经营欠款与今日费用均已清偿，恢复正常经营。", "trade");
  }
  log(
    s,
    `今日经营费用：租金${RULES.fixed}、保养${careCost}、成交耗材${serviceCost}、留存护养${storageCost}、日薪${staffSalary}、许可${permitCost}、修缮${repairCost} G；实付${fixedPaid + runningPaid} G。`,
    "trade",
  );
  const interest = s.day % 7 === 0 ? Math.ceil(s.debt * RULES.interest) : 0;
  s.debt += interest;
  if (interest)
    log(s, `每周利息 ${interest} G 已加入债务，未扣现金。`, "trade");
  if (!s.illegalToday) s.risk = Math.max(0, s.risk - 5);
  const cashBeforeInvestigation = s.cash;
  const penalty = investigate(s, random(s));
  const fine = cashBeforeInvestigation - s.cash;
  const confiscationCost = penalty - fine;
  if (s.risk >= 75 && s.warningDay === null)
    log(
      s,
      "风险已进入危险区，调查概率 15%–30%。停止违法可逐步降低风险。",
      "risk",
    );
  if (
    s.status !== "ended" &&
    s.arrears > 0 &&
    s.defaultSince !== null &&
    s.day >= s.defaultSince + 2
  ) {
    s.status = "ended";
    s.reason = `逾期欠款 ${s.arrears} G 在两个后续营业日内未清偿，店铺破产。`;
    log(s, s.reason, "risk");
  }
  const operatingProfit =
    revenue -
    cogs -
    expired.cost -
    RULES.fixed -
    fine -
    confiscationCost -
    s.book.staffCost -
    s.book.crystalCost -
    s.book.townCost -
    runningCost -
    (incident?.cashLost ?? 0) -
    (incident?.stockCost ?? 0);
  const row: Ledger = {
    townCost: s.book.townCost,
    staffCost: s.book.staffCost,
    staffSalary,
    careCost,
    serviceCost,
    storageCost,
    permitCost,
    runningPaid,
    repairCost,
    crystalCost: s.book.crystalCost,
    incidentCashCost: incident?.cashLost ?? 0,
    incidentStockCost: incident?.stockCost ?? 0,
    incident,
    day: s.day,
    revenue,
    orderRevenue: s.book.orderRevenue,
    purchases: s.book.purchases,
    cogs,
    expired: expired.qty,
    expiryCost: expired.cost,
    fixed: RULES.fixed,
    fixedPaid,
    interest,
    fine,
    confiscationCost,
    quotes: structuredClone(s.market),
    operatingProfit,
    profit: operatingProfit - interest,
    cashFlow: s.cash - s.book.openingCash,
    cash: s.cash,
    debt: s.debt,
    arrears: s.arrears,
    assets: netAssets(s),
    stock: quantity(s),
    sales,
    saleDetails,
    riskDelta: s.risk - s.book.openingRisk,
    repDelta: {
      kingdom: s.reputation.kingdom - s.book.openingRep.kingdom,
      guild: s.reputation.guild - s.book.openingRep.guild,
      black: s.reputation.black - s.book.openingRep.black,
    },
    notes: s.log.filter((l) => !startLogIds.has(l.id)).map((l) => l.text),
    repaid: s.book.repaid,
    arrearsPaid: s.book.arrearsPaid,
    finance: s.book.finance,
  };
  s.ledger.push(row);
  s.stats.revenue += revenue;
  s.stats.maxLoss = Math.max(s.stats.maxLoss, -row.profit);
  s.stats.days++;
  s.phase = "report";
  s.revision++;
  if (s.status !== "ended") {
    s.day++;
    s.actions = 0;
    s.actionPointsUsed = 0;
    s.illegalToday = false;
    s.orders = [];
    s.news = [];
    advanceEvents(s);
    rollEvents(s);
    generateMarket(s);
    prepareDailyVisitor(s);
    prepareHazard(s);
    prepareTown(s);
    if (merchantAvailable(s))
      log(
        s,
        `黑市商人提着一只木匣到了店门口，里面是一枚水晶球。售价${RULES.crystalUnlock} G，可先询问再决定。`,
      );
    if (!s.news.length)
      s.news.push("巷子里暂时风平浪静。留意行情，备货要量力而行。");
    s.book = newBook(s);
  }
  if (s.day === settledDay && s.status !== "ended")
    throw new Error("Turn did not advance");
  return { state: s };
}
