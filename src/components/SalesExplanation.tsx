import type { Ledger } from "../engine/types";
import { IDS } from "../engine/types";
import { PRODUCTS } from "../engine/config";
import {
  salesReason,
  priceExplanation,
  profitExplanation,
} from "../engine/explanations";
import { money, signed } from "./Shared";
import { Potion } from "./Potion";
export function ProfitExplanation({ row }: { row: Ledger }) {
  const gross = row.revenue - row.cogs;
  return (
    <section className="profit-explanation" aria-label="利润解释">
      <h3>这笔利润从哪里来</h3>
      <div className="profit-equation">
        <span>
          收款 <b>{row.revenue}</b>
        </span>
        <span>
          − 药品成本 <b>{row.cogs}</b>
        </span>
        <span>
          = 毛利 <b>{gross}</b>
        </span>
      </div>
      <p>{profitExplanation(row)}</p>
      <p className="cash-explanation">
        现金实际{row.cashFlow >= 0 ? "增加" : "减少"} {Math.abs(row.cashFlow)}{" "}
        G：采购、还款和融资会改变现金，但不是当天卖药的毛利。
        {row.interest > 0
          ? `另外 ${row.interest} G 利息计入债务，扣息利润为 ${row.profit} G。`
          : ""}
      </p>
    </section>
  );
}
export function SalesExplanation({ row }: { row: Ledger }) {
  if (!row.saleDetails)
    return (
      <section className="sales-explanation legacy-explanation">
        <p>
          这是旧版本的历史记录，未记录当时的客流与售价，无法准确还原销售原因。新营业日会记录完整明细。
        </p>
        <div>
          {IDS.map((id) => (
            <p key={id}>
              {PRODUCTS[id].name}：售出 {row.sales[id]} 瓶
            </p>
          ))}
        </div>
      </section>
    );
  return (
    <section className="sales-explanation" aria-label="各商品销量解释">
      <p className="sales-intro">
        进货量决定能卖多少，顾客需求决定实际买多少。每种药单独计算，最后向下取整。
      </p>
      {IDS.map((id) => {
        const d = row.saleDetails![id];
        return (
          <article
            key={id}
            className="sale-detail"
            data-testid={`sale-detail-${id}`}
          >
            <div className="sale-detail-heading">
              <Potion color={PRODUCTS[id].color} />
              <h3>{PRODUCTS[id].name}</h3>
              <strong>
                卖出 {d.sold} / {d.stock} 瓶
              </strong>
            </div>
            <p className="sale-reason">{salesReason(d)}</p>
            {d.stock > 0 ? (
              <p className="sale-price-reason">
                {priceExplanation(d)}
                {d.eventMultiplier !== 1
                  ? `事件使基础需求变为 ${d.eventMultiplier.toFixed(1)} 倍。`
                  : ""}
              </p>
            ) : null}
            <div className="sale-finance">
              <span>收款 {money(d.revenue)}</span>
              <span>成本 {money(d.cogs)}</span>
              <span>毛利 {signed(d.revenue - d.cogs)} G</span>
            </div>
            {d.expired > 0 ? (
              <p className="sale-expiry">
                剩余药水中有 {d.expired} 瓶在营业结束后过期。
              </p>
            ) : null}
            <details className="sale-calculation">
              <summary>展开销量计算</summary>
              <p>
                基础需求 {d.baseDemand} × 事件 {d.eventMultiplier.toFixed(2)} ×
                价格因素 {d.priceFactor.toFixed(2)} × 当日客流{" "}
                {d.noise.toFixed(4)} ≈ {d.raw.toFixed(2)} 瓶
              </p>
              <p>
                向下取整为 {d.potential} 瓶，再受有效库存 {d.stock}{" "}
                瓶限制，实际售出 {d.sold} 瓶。
              </p>
              <p>
                当日售价 {d.price} G · 参考零售价 {d.reference} G
              </p>
              <small>
                客流每天在 0.85–1.15 之间波动；显示的小数经过四舍五入。
              </small>
            </details>
          </article>
        );
      })}
    </section>
  );
}
