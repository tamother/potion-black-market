import { useState } from "react";
import type { GameState, Action } from "../engine/types";
import { IDS } from "../engine/types";
import { PRODUCTS, CHAIN_NAMES, RULES } from "../engine/config";
import { quantity, inventoryValue } from "../engine/inventory";
import { netAssets } from "../engine/game";
import { Potion } from "./Potion";
import { ProfitExplanation, SalesExplanation } from "./SalesExplanation";
import { Factions, Empty, money, signed, riskLabel } from "./Shared";
import {
  Archive,
  BookOpen,
  History,
  ShieldAlert,
  Coins,
  ArrowUpRight,
} from "./PixelIcons";
export function Warehouse({ s }: { s: GameState }) {
  return (
    <>
      <div className="page-intro">
        <p>每一瓶魔药，都有它的来处。</p>
        <span>
          {quantity(s)} / {s.capacity} 格 · 成本估值 {money(inventoryValue(s))}
        </span>
      </div>
      <div className="capacity">
        <i style={{ width: `${(quantity(s) / s.capacity) * 100}%` }} />
      </div>
      <section className="cabinet" aria-label="魔药货柜">
        <div className="cabinet-label">
          <Archive size={20} />
          <h2>魔药货柜</h2>
          <span>按品种归档</span>
        </div>
        <div className="cabinet-slots">
          {IDS.map((id) => (
            <div
              className={`cabinet-slot ${quantity(s, id) ? "occupied" : ""}`}
              key={id}
            >
              <div className="slot-art">
                <Potion color={PRODUCTS[id].color} large />
                <strong>{quantity(s, id)}</strong>
              </div>
              <div className="slot-tag">
                <h3>{PRODUCTS[id].name}</h3>
                <span>
                  {s.batches.filter((b) => b.product === id).length} 批 ·{" "}
                  {quantity(s, id)} 瓶
                </span>
              </div>
            </div>
          ))}
          <div className="cabinet-slot free-slot">
            <div className="slot-art">
              <Archive size={40} />
            </div>
            <div className="slot-tag">
              <h3>剩余空间</h3>
              <span>{s.capacity - quantity(s)} 格可用</span>
            </div>
          </div>
        </div>
      </section>
      {!s.batches.length ? (
        <section className="panel">
          <Empty title="货架还是空的">到柜台的进货簿，采购你的第一批魔药。</Empty>
        </section>
      ) : (
        <section className="panel inventory">
          {IDS.filter((id) => quantity(s, id) > 0).map((id) => (
            <article key={id}>
              <div className="inventory-heading">
                <Potion color={PRODUCTS[id].color} />
                <h2>{PRODUCTS[id].name}</h2>
                <strong>{quantity(s, id)} 瓶</strong>
              </div>
              <div className="batch-head">
                <span>采购日期</span>
                <span>数量</span>
                <span>单位成本</span>
                <span>保质期</span>
              </div>
              {s.batches
                .filter((b) => b.product === id)
                .map((b) => {
                  const left = 7 - (s.day - b.day);
                  return (
                    <div className="batch-row" key={b.id}>
                      <span>第 {b.day} 天</span>
                      <strong>{b.qty}</strong>
                      <span>{money(b.cost)}</span>
                      <span
                        className={
                          id === "healing" && left <= 2 ? "warning" : ""
                        }
                      >
                        {id === "healing"
                          ? `${left} 天 · 第 ${b.day + 6} 天末过期`
                          : "长期保存"}
                      </span>
                    </div>
                  );
                })}
            </article>
          ))}
        </section>
      )}
      <p className="hint">
        <Archive size={16} />
        销售按先进先出。治疗药水持有第 7
        天先销售，再清理剩余库存；过期品不会产生收入。
      </p>
    </>
  );
}
export function EventsPage({ s }: { s: GameState }) {
  const [filter, setFilter] = useState("all");
  const logs = s.log
    .filter((l) => filter === "all" || l.kind === filter)
    .slice()
    .reverse();
  return (
    <>
      <div className="event-grid">
        <Factions s={s} full />
        <section className="panel risk-panel">
          <div className="section-title">
            <h2>
              <ShieldAlert size={19} />
              调查档案
            </h2>
            <span>{riskLabel(s.risk)}</span>
          </div>
          <strong className={`risk-number ${s.risk >= 50 ? "warning" : ""}`}>
            {s.risk}
            <small> / 100</small>
          </strong>
          <div className="risk-track">
            <i style={{ width: `${s.risk}%` }} />
          </div>
          <p>没有非法交易的营业日，风险降低 5 点。</p>
          <p className="muted">
            高风险调查概率 5%–15%；危险区
            15%–30%。首次被查会正式警告，警告后继续严重违法才可能永久查封。
          </p>
          {s.warningDay ? (
            <p className="warning">
              第 {s.warningDay} 天已收到正式警告 · 调查处罚 {s.strikes} 次
            </p>
          ) : null}
        </section>
      </div>
      <section className="panel">
        <div className="section-title">
          <h2>正在发生</h2>
          <span>线索会提前浮现</span>
        </div>
        <div className="active-events">
          {(Object.keys(CHAIN_NAMES) as (keyof typeof CHAIN_NAMES)[]).map(
            (id) => {
              const c = s.chains[id];
              return (
                <div className="chain" key={id}>
                  <i
                    className={
                      c.stage === "active"
                        ? "active"
                        : c.stage === "rumor"
                          ? "rumor"
                          : ""
                    }
                  />
                  <div>
                    <h3>{CHAIN_NAMES[id]}</h3>
                    <p>
                      {c.stage === "idle"
                        ? "暂无消息"
                        : c.stage === "rumor"
                          ? `传闻 · 第 ${c.start + 2} 天将出现新动向`
                          : c.stage === "active"
                            ? `持续至第 ${c.end} 天 · ${c.choice ? ({ army: "供应军方", warblack: "供应黑市", normal: "正常经营", help: "援助医生", refuse: "拒绝请求", accept: "接受走私" }[c.choice] ?? c.choice) : "等待你的决定"}`
                            : `暂时平息 · 第 ${c.cooldown} 天后可能再起`}
                    </p>
                  </div>
                </div>
              );
            },
          )}
          {s.effects.map((e) => (
            <div className="chain" key={e.id}>
              <i className="active" />
              <div>
                <h3>
                  {e.title} <small>至第 {e.until} 天</small>
                </h3>
                <p>{e.description}</p>
              </div>
            </div>
          ))}
        </div>
        {s.delayed.length ? (
          <p className="hint">
            你过去的选择仍在发酵，后续消息将在未来几天传来。
          </p>
        ) : null}
      </section>
      <section className="panel history-panel">
        <div className="section-title">
          <h2>
            <History size={18} />
            巷间记录
          </h2>
          <div className="filters">
            {[
              ["all", "全部"],
              ["choice", "选择"],
              ["risk", "调查"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={filter === value ? "selected" : ""}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {logs.length ? (
          logs.map((l) => (
            <div className={`log ${l.kind}`} key={l.id}>
              <span>第 {l.day} 天</span>
              <p>{l.text}</p>
            </div>
          ))
        ) : (
          <Empty title="暂无记录">做出的选择会留在这里。</Empty>
        )}
      </section>
    </>
  );
}
function Curve({ s }: { s: GameState }) {
  const rows = s.ledger.slice(-60);
  if (rows.length < 2)
    return (
      <div className="chart-empty">
        完成至少两天营业后，经营曲线会出现在这里。
      </div>
    );
  const values = rows.flatMap((r) => [r.assets, r.cash]);
  const lo = Math.min(0, ...values),
    hi = Math.max(500, ...values),
    h = 180,
    w = 700;
  const path = (key: "assets" | "cash") =>
    rows
      .map((r, i) => {
        const x = Math.round(((i / (rows.length - 1)) * w) / 4) * 4;
        const y = Math.round((h - ((r[key] - lo) / (hi - lo)) * h) / 4) * 4;
        return i === 0 ? `M${x},${y}` : `H${x}V${y}`;
      })
      .join(" ");
  return (
    <div className="chart">
      <svg
        viewBox="-8 -10 720 220"
        shapeRendering="crispEdges"
        role="img"
        aria-label="最近60天现金及净资产曲线"
      >
        {[0, 60, 120, 180].map((y) => (
          <line
            key={y}
            x1="0"
            x2={w}
            y1={y}
            y2={y}
            stroke="#90764e"
            strokeDasharray="4 8"
          />
        ))}
        <path d={path("cash")} fill="none" stroke="#8d4f26" strokeWidth="4" />
        <path d={path("assets")} fill="none" stroke="#665080" strokeWidth="4" />
        <text x="0" y="207" fill="#655036" fontSize="13">
          第 {rows[0].day} 天
        </text>
        <text x="700" y="207" textAnchor="end" fill="#655036" fontSize="13">
          第 {rows.at(-1)!.day} 天
        </text>
      </svg>
      <div className="chart-legend">
        <span>● 现金 {money(s.cash)}</span>
        <span>● 净资产 {money(netAssets(s))}</span>
      </div>
    </div>
  );
}
export function LedgerPage({
  s,
  dispatch,
}: {
  s: GameState;
  dispatch: (a: Action) => boolean;
}) {
  const [repay, setRepay] = useState("");
  return (
    <>
      <div className="ledger-summary">
        <div>
          <span>当前净资产</span>
          <strong>{money(netAssets(s))}</strong>
          <small>现金 + 库存成本 − 债务 − 逾期欠款</small>
        </div>
        <div>
          <span>累计营业收入</span>
          <strong>{money(s.stats.revenue + s.book.orderRevenue)}</strong>
          <small>含已完成的特殊订单</small>
        </div>
        <div>
          <span>最大单日亏损</span>
          <strong>{money(s.stats.maxLoss)}</strong>
          <small>含利息与库存损失</small>
        </div>
      </div>
      <section className="panel debt-panel">
        <div>
          <h2>
            <Coins size={18} />
            债务管理
          </h2>
          <p>
            余额 {money(s.debt)} · 下次计息在第 {Math.ceil(s.day / 7) * 7} 天末
          </p>
          <span className="muted">
            每 7 天对余额收取 5% 利息，向上取整并加入债务。
          </span>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (dispatch({ type: "repay", amount: Number(repay) }))
              setRepay("");
          }}
        >
          <input
            aria-label="偿还债务金额"
            type="number"
            inputMode="numeric"
            placeholder="还款金额"
            min="1"
            max={Math.min(s.cash, s.debt)}
            value={repay}
            onChange={(e) => setRepay(e.target.value)}
          />
          <button
            className="secondary"
            type="submit"
            disabled={!repay || s.cash === 0 || s.debt === 0}
          >
            偿还债务
            <ArrowUpRight size={14} />
          </button>
        </form>
      </section>
      <section className="panel">
        <div className="section-title">
          <h2>经营走势</h2>
          <span>最近 60 个营业日</span>
        </div>
        <Curve s={s} />
      </section>
      <section className="panel ledger">
        <div className="section-title">
          <h2>
            <BookOpen size={18} />
            每日账目
          </h2>
          <span>营业利润与现金流分别核算</span>
        </div>
        {!s.ledger.length ? (
          <Empty title="账本的第一页">
            结束一天营业后，收入、成本和利润将自动记入。
          </Empty>
        ) : (
          s.ledger
            .slice()
            .reverse()
            .map((r) => (
              <details key={r.day}>
                <summary>
                  <strong>第 {r.day} 天</strong>
                  <span>收入 {money(r.revenue)}</span>
                  <span
                    className={r.operatingProfit >= 0 ? "positive" : "warning"}
                  >
                    利润 {signed(r.operatingProfit)} G
                  </span>
                  <span>现金流 {signed(r.cashFlow)} G</span>
                </summary>
                <div className="ledger-details">
                  <ProfitExplanation row={r} />
                  <details className="ledger-sale-details">
                    <summary>查看这一天的销售原因</summary>
                    <SalesExplanation row={r} />
                  </details>
                  <p>
                    普通销售 {money(r.revenue - r.orderRevenue)} · 特殊订单{" "}
                    {money(r.orderRevenue)} · 采购支出 {money(r.purchases)}
                  </p>
                  <p>
                    销货成本 {money(r.cogs)} · 过期损失 {money(r.expiryCost)} ·
                    租金 {money(r.fixed)}（实付 {r.fixedPaid}）· 罚款{" "}
                    {money(r.fine)} · 没收成本 {money(r.confiscationCost)}
                  </p>
                  <p>
                    营业利润 {money(r.operatingProfit)} · 利息{" "}
                    {money(r.interest)} · 扣息利润 {money(r.profit)}
                  </p>
                  <p>
                    偿还本金 {money(r.repaid)} · 补付欠款 {money(r.arrearsPaid)}{" "}
                    · 借款流入 {money(r.finance)}
                  </p>
                  <p>
                    期末现金 {money(r.cash)} · 债务 {money(r.debt)} · 逾期{" "}
                    {money(r.arrears)} · 净资产 {money(r.assets)}
                  </p>
                  <div className="daily-sales">
                    {IDS.map((id) => (
                      <span key={id}>
                        {PRODUCTS[id].name} × {r.sales[id]}
                      </span>
                    ))}
                  </div>
                  {r.notes.map((n, i) => (
                    <p key={i} className="muted">
                      {n}
                    </p>
                  ))}
                </div>
              </details>
            ))
        )}
      </section>
      <section className="panel">
        <div className="section-title">
          <h2>批发行情历史</h2>
          <span>近 14 天 · 单位 G</span>
        </div>
        {!s.ledger.length ? (
          <p className="hint">首日结算后开始记录历史报价。</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>日期</th>
                  {IDS.map((id) => (
                    <th key={id}>{PRODUCTS[id].name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.ledger
                  .slice(-14)
                  .reverse()
                  .map((r) => (
                    <tr key={r.day}>
                      <td>第 {r.day} 天</td>
                      {IDS.map((id) => (
                        <td key={id}>{r.quotes[id].buy}</td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
