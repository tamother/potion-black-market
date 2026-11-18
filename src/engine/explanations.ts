import type { GameState, Order, SaleDetail, Ledger } from "./types";
import { FACTIONS } from "./config";
import { validBatch } from "./inventory";
export function salesReason(d: SaleDetail): string {
  if (d.stock === 0)
    return d.potential > 0
      ? `营业时无有效库存，未能满足 ${d.potential} 瓶需求。`
      : "营业时无有效库存；今日需求也不足 1 瓶。";
  if (d.potential === 0)
    return `今日需求不足 1 瓶（计算值 ${d.raw.toFixed(2)}），向下取整为 0，所以没有卖出。`;
  if (d.stock < d.potential)
    return `顾客需求为 ${d.potential} 瓶，但可售库存只有 ${d.stock} 瓶，因此只卖出 ${d.sold} 瓶。`;
  if (d.stock > d.sold)
    return `今日需求为 ${d.potential} 瓶；货架上有 ${d.stock} 瓶，卖出 ${d.sold} 瓶后还剩 ${d.stock - d.sold} 瓶。`;
  return `今日需求为 ${d.potential} 瓶，可售库存 ${d.stock} 瓶，全部售出。`;
}
export function priceExplanation(
  d: Pick<SaleDetail, "price" | "reference" | "priceFactor">,
) {
  const change = Math.round(Math.abs(d.priceFactor - 1) * 100);
  return d.price === d.reference
    ? "售价等于参考价，定价没有增减需求。"
    : d.price > d.reference
      ? `售价 ${d.price} G 高于参考价 ${d.reference} G，价格因素让需求减少约 ${change}%。`
      : `售价 ${d.price} G 低于参考价 ${d.reference} G，价格因素让需求增加约 ${change}%。`;
}
export function profitExplanation(r: Ledger) {
  const running =
    (r.careCost ?? 0) +
    (r.serviceCost ?? 0) +
    (r.storageCost ?? 0) +
    (r.permitCost ?? 0);
  const loss =
    r.expiryCost +
    r.confiscationCost +
    (r.incidentCashCost ?? 0) +
    (r.incidentStockCost ?? 0) +
    (r.repairCost ?? 0);
  return `今天收到 ${r.revenue} G，扣除实际卖出药水的进货成本 ${r.cogs} G，留下 ${r.revenue - r.cogs} G 毛利。再扣租金 ${r.fixed} G、店务费用 ${running} G、损失与修缮 ${loss} G、罚款 ${r.fine} G、雇佣支出 ${r.staffCost ?? 0} G、日薪 ${r.staffSalary ?? 0} G、水晶球费用 ${r.crystalCost ?? 0} G，营业利润为 ${r.operatingProfit} G。采购 ${r.purchases} G中未卖出的部分计入库存。`;
}
export function orderTradeoff(s: GameState, o: Order) {
  let remaining = o.qty,
    cost = 0;
  const batches = s.batches
    .filter(
      (b) => b.product === o.product && validBatch(b.product, s.day, b.day),
    )
    .sort((a, b) => a.day - b.day);
  for (const b of batches) {
    const n = Math.min(remaining, b.qty);
    cost += n * b.cost;
    remaining -= n;
    if (!remaining) break;
  }
  const purchaseCost = remaining * s.market[o.product].buy;
  cost += purchaseCost;
  const acceptance = `交付 ${o.qty} 瓶，收款 ${o.reward} G，消耗 1 次行动；${FACTIONS[o.faction]} +${o.rep}${o.risk ? `、风险 +${o.risk}、王国 -5` : ""}。`;
  const refusal =
    o.kind === "doctor"
      ? "保留库存，不扣声望、不耗行动；本轮不解锁后续诊所合作。"
      : o.kind === "smuggler"
        ? "保留库存，不扣声望、不耗行动；不增加这笔走私风险，也不建立本轮合作。"
        : o.kind === "army" || o.kind === "warblack"
          ? "选择正常经营，关闭本轮军方与黑市两份军需单；保留库存，不扣声望、不耗行动。"
          : "保留库存，不扣声望、不耗行动，无罚款；可留给零售或其他订单。";
  return {
    cost,
    needBuy: remaining,
    purchaseCost,
    grossProfit: o.reward - cost,
    retailValue: o.qty * s.prices[o.product],
    retailDifference: o.reward - o.qty * s.prices[o.product],
    acceptance,
    refusal,
  };
}
