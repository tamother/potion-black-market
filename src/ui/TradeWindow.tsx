import { freeCapacity, reservedFor } from "../engine/town";
import { remainingActions } from "../engine/actions";
import { useState } from "react";
import type { GameState, ProductId } from "../engine/types";
import { IDS } from "../engine/types";
import { PRODUCTS } from "../engine/config";
import { baseDailyDue } from "../engine/hazards";
import { quantity } from "../engine/inventory";
import { priceBounds, demandRange, isIllegal } from "../engine/economy";
import { Potion } from "../components/Potion";
import { money } from "../components/Shared";
import { Tabs, Window, type UIProps } from "./Window";
export function TradeWindow({
  s,
  dispatch,
  onClose,
  notice,
  mode,
}: { mode: "purchase" | "pricing" } & UIProps) {
  const [id, setId] = useState<ProductId>("healing"),
    [qty, setQty] = useState("1"),
    [draft, setDraft] = useState(String(s.prices.healing));
  const p = PRODUCTS[id],
    m = s.market[id],
    [low, high] = priceBounds(m.reference),
    range = demandRange(p, m, s.prices[id]);
  const limit = Math.max(
      0,
      Math.min(m.remaining, freeCapacity(s), Math.floor(s.cash / m.buy)),
    ),
    n = Number(qty),
    canBuy =
      Number.isInteger(n) &&
      n > 0 &&
      n <= limit &&
      s.status === "active" &&
      remainingActions(s) >= 1;
  const choose = (v: string) => {
    const next = v as ProductId;
    setId(next);
    setQty("1");
    setDraft(String(s.prices[next]));
  };
  const commit = () => {
    if (
      Number(draft) !== s.prices[id] &&
      !dispatch({ type: "price", product: id, price: Number(draft) })
    )
      setDraft(String(s.prices[id]));
  };
  return (
    <Window
      label={mode === "purchase" ? "商队进货簿" : "魔药货架"}
      title={mode === "purchase" ? "商队进货簿" : "魔药货架"}
      header={
        <span className="header-money">
          {money(s.cash)} · 行动{remainingActions(s)}/8
        </span>
      }
      onClose={onClose}
      kind="trade-window"
      tabs={
        <Tabs
          label="药水种类"
          tabs={IDS.map((key) => ({
            id: key,
            label: PRODUCTS[key].name,
            icon: <Potion color={PRODUCTS[key].color} />,
          }))}
          value={id}
          onChange={choose}
        />
      }
      notice={notice}
      hint={
        remainingActions(s) < 1
          ? "行动力已用完，仍可查看、拒单、还款或入夜开业。"
          : mode === "purchase"
            ? `每笔采购1行动；固定待付${baseDailyDue(s)} G，成交2 G/瓶。`
            : "每次实际改价1行动；黑市入夜开业，顾客按价购买。"
      }
      footer={
        mode === "purchase" ? (
          <>
            <span className="purchase-total">
              本次 {money(Number.isInteger(n) && n > 0 ? n * m.buy : 0)}
            </span>
            <button
              className="primary"
              disabled={!canBuy}
              aria-label={`采购${p.name}`}
              onClick={() => {
                if (dispatch({ type: "buy", product: id, qty: n })) setQty("1");
              }}
            >
              采购
            </button>
          </>
        ) : (
          <button
            className="primary"
            disabled={remainingActions(s) < 1 && Number(draft) !== s.prices[id]}
            onClick={commit}
          >
            更换价签
          </button>
        )
      }
    >
      <div className="trade-layout">
        <div className="item-illustration">
          <Potion color={p.color} />
          <p>{p.note}</p>
          {isIllegal(s, id) && (
            <span className="illegal-note">王国管制商品</span>
          )}
        </div>
        <div className="trade-fields">
          <div className="trade-summary">
            <div>
              <span>当前库存</span>
              <strong data-testid={`stock-${id}`}>{quantity(s, id)}</strong>
            </div>
            <div>
              <span>{mode === "purchase" ? "批发进价" : "参考零售价"}</span>
              <strong>
                {money(mode === "purchase" ? m.buy : m.reference)}
              </strong>
            </div>
            <div>
              <span>{mode === "purchase" ? "今日余供" : "预计日零售"}</span>
              <strong>
                {mode === "purchase"
                  ? `${m.remaining} 瓶`
                  : `${range.min}–${range.max} 瓶`}
              </strong>
            </div>
          </div>
          {mode === "purchase" ? (
            <div className="trade-input-row">
              <label htmlFor="purchase-qty">采购数量</label>
              <div className="quantity-picker">
                <button
                  type="button"
                  className="secondary"
                  aria-label={`减少${p.name}采购数量`}
                  disabled={n <= 1}
                  onClick={() =>
                    setQty(String(Math.max(1, (Number(qty) || 1) - 1)))
                  }
                >
                  −
                </button>
                <input
                  id="purchase-qty"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max={Math.max(1, limit)}
                  aria-label={`${p.name}采购数量`}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
                <button
                  type="button"
                  className="secondary"
                  aria-label={`增加${p.name}采购数量`}
                  disabled={n >= limit}
                  onClick={() =>
                    setQty(String(Math.min(limit, (Number(qty) || 0) + 1)))
                  }
                >
                  +
                </button>
              </div>
              <small>
                {s.status === "default"
                  ? "补齐经营欠款后可进货。"
                  : `仓库余 ${freeCapacity(s)} 格`}
              </small>
            </div>
          ) : (
            <div className="trade-input-row">
              <label htmlFor="new-price">我的售价</label>
              <div className="price-picker">
                <input
                  id="new-price"
                  type="number"
                  inputMode="numeric"
                  min={low}
                  max={high}
                  aria-label={`${p.name}售价`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                />
                <span>G</span>
              </div>
              <small>
                可设 {low}–{high} G
              </small>
            </div>
          )}
        </div>
      </div>
    </Window>
  );
}
