import { useState } from "react";
import type { Action, GameState, ProductId } from "../engine/types";
import { IDS } from "../engine/types";
import { PRODUCTS } from "../engine/config";
import { quantity } from "../engine/inventory";
import { priceBounds, isIllegal, demandRange } from "../engine/economy";
import { Potion } from "./Potion";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Flame,
  Info,
} from "./PixelIcons";
import { money } from "./Shared";
type Dispatch = (a: Action) => boolean;
function MarketRow({
  s,
  id,
  dispatch,
  mode,
}: {
  s: GameState;
  id: ProductId;
  dispatch: Dispatch;
  mode: "purchase" | "pricing";
}) {
  const [qty, setQty] = useState("1");
  const p = PRODUCTS[id],
    m = s.market[id],
    stock = quantity(s, id),
    [low, high] = priceBounds(m.reference);
  const [draft, setDraft] = useState(String(s.prices[id]));
  const change = Math.round((m.buy / m.previous - 1) * 100),
    limit = Math.max(
      0,
      Math.min(
        m.remaining,
        s.capacity - quantity(s),
        Math.floor(s.cash / m.buy),
      ),
    );
  const range = demandRange(p, m, s.prices[id]);
  const n = Number(qty);
  const canBuy =
    Number.isInteger(n) && n > 0 && n <= limit && s.status === "active";
  const update = (value: string) => {
    setDraft(value);
  };
  const commit = () => {
    if (Number(draft) !== s.prices[id]) {
      if (!dispatch({ type: "price", product: id, price: Number(draft) }))
        setDraft(String(s.prices[id]));
    }
  };
  return (
    <div
      className={`market-row row-mode-${mode}`}
      data-testid={`product-${id}`}
    >
      <div className="product-name">
        <div className="bottle-frame">
          <Potion color={p.color} />
        </div>
        <div>
          <h3>
            {p.name}
            {isIllegal(s, id) ? <span className="illegal">违禁</span> : null}
          </h3>
          <p>{p.note}</p>
          <p className="demand-preview" data-testid={`demand-preview-${id}`}>
            预计零售 {range.min}–{range.max} 瓶/日
          </p>
          <small className="inline-demand">
            需求 {m.demand > 1 ? `×${m.demand.toFixed(1)}` : "平稳"}
          </small>
        </div>
      </div>
      <div className="quote">
        <span className="mobile-label">进价</span>
        <strong>{money(m.buy)}</strong>
        <span
          className={`change ${change > 0 ? "up" : change < 0 ? "down" : "neutral"}`}
        >
          {change > 0 ? (
            <TrendingUp size={13} />
          ) : change < 0 ? (
            <TrendingDown size={13} />
          ) : (
            <Minus size={13} />
          )}{" "}
          {change > 0 ? "+" : ""}
          {change}%
        </span>
      </div>
      <div className="stock-cell">
        <span className="mobile-label">库存</span>
        <strong data-testid={`stock-${id}`}>{stock}</strong>
        <small>余供 {m.remaining}</small>
      </div>
      <div className="purchase-controls">
        <div className="stepper">
          <button
            aria-label={`减少${p.name}采购数量`}
            onClick={() => setQty(String(Math.max(1, (Number(qty) || 1) - 1)))}
            disabled={n <= 1}
          >
            <Minus size={14} />
          </button>
          <input
            aria-label={`${p.name}采购数量`}
            inputMode="numeric"
            type="number"
            min="1"
            max={Math.max(1, limit)}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <button
            aria-label={`增加${p.name}采购数量`}
            onClick={() =>
              setQty(String(Math.min(limit, (Number(qty) || 0) + 1)))
            }
            disabled={n >= limit}
          >
            <Plus size={14} />
          </button>
        </div>
        <button
          className="buy-button"
          disabled={!canBuy}
          aria-label={`采购${p.name}`}
          onClick={() => dispatch({ type: "buy", product: id, qty: n })}
        >
          采购
        </button>
      </div>
      <div className="selling">
        <label htmlFor={`price-${id}`}>我的售价</label>
        <div>
          <input
            id={`price-${id}`}
            aria-label={`${p.name}售价`}
            type="number"
            inputMode="numeric"
            min={low}
            max={high}
            value={draft}
            onChange={(e) => update(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          <span>G</span>
        </div>
        <small>
          <span>参考 {m.reference}</span>
          <span>
            可设 {low}–{high}
          </span>
        </small>
      </div>
      <div className="demand-cell">
        <span className="mobile-label">需求</span>
        <strong className={m.demand > 1 ? "purple" : ""}>
          {m.demand > 1 ? `×${m.demand.toFixed(1)}` : "平稳"}
        </strong>
      </div>
    </div>
  );
}
export function Market({
  s,
  dispatch,
  mode = "purchase",
}: {
  s: GameState;
  dispatch: Dispatch;
  mode?: "purchase" | "pricing";
}) {
  return (
    <section className={`panel market market-mode-${mode}`}>
      <div className="section-title">
        <h2>
          <Flame size={19} />
          {mode === "purchase" ? "商队进货簿" : "货架价签"}
        </h2>
        <span>采购即时入库 · 营业结束后销售</span>
      </div>
      <div className="market-head">
        <span>商品</span>
        <span>批发进价</span>
        <span>当前库存</span>
        <span>采购数量</span>
        <span>零售定价</span>
        <span>需求</span>
      </div>
      {IDS.map((id) => (
        <MarketRow
          key={`${s.day}-${id}`}
          s={s}
          id={id}
          dispatch={dispatch}
          mode={mode}
        />
      ))}
      <p className="market-foot">
        <Info size={14} />
        售价越高，需求越低。备货前记得为租金留出 12 G。
      </p>
    </section>
  );
}
