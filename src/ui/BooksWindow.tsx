import { remainingActions } from "../engine/actions";
import { useState } from "react";
import type { GameState, Ledger, ProductId } from "../engine/types";
import { IDS } from "../engine/types";
import { PRODUCTS, RULES } from "../engine/config";
import { salesReason, priceExplanation } from "../engine/explanations";
import { Potion } from "../components/Potion";
import { Sprite } from "../world/Sprite";
import { money, signed } from "../components/Shared";
import { Window, Tabs, Pager, type UIProps } from "./Window";
import { baseDailyDue, permitDue } from "../engine/hazards";
import { quantity } from "../engine/inventory";
export function LedgerWindow({ s, dispatch, onClose, notice }: UIProps) {
  const [tab, setTab] = useState(s.arrears ? "debt" : "budget"),
    [page, setPage] = useState(s.arrears ? 1 : 0),
    [repay, setRepay] = useState("");
  const rows = s.ledger.slice().reverse(),
    count =
      tab === "cash"
        ? Math.ceil(rows.length / 2)
        : tab === "debt" && s.arrears
          ? 2
          : 1,
    index = Math.min(page, Math.max(0, count - 1));
  return (
    <Window
      label="基础账本"
      title="基础账本"
      header={<span className="header-money">现金 {money(s.cash)}</span>}
      onClose={onClose}
      tabs={
        <Tabs
          tabs={[
            { id: "budget", label: "今日预算" },
            { id: "cash", label: "每日流水" },
            { id: "debt", label: s.arrears ? "债务 · 逾期" : "债务" },
            { id: "hire", label: "财务人员" },
          ]}
          value={tab}
          onChange={(id) => {
            setTab(id);
            setPage(id === "debt" && s.arrears ? 1 : 0);
          }}
        />
      }
      notice={notice}
      hint={
        tab === "hire"
          ? "雇佣1点行动；入职120 G，每日10 G，入职当天也计薪。"
          : tab === "budget"
            ? `固定待付${baseDailyDue(s)} G；已交付耗材${s.orders.filter((o) => o.status === "accepted").reduce((n, o) => n + o.qty * RULES.handling, s.book.townUnits * RULES.handling)} G，另留应急金。`
            : tab === "cash"
              ? "只记录实际进出的钱。"
              : "每七天对债务计息 5%，利息加入债务。"
      }
      footer={
        <>
          {count > 1 && <Pager page={index} count={count} onChange={setPage} />}{" "}
          {tab === "hire" && (
            <button
              className="primary"
              disabled={
                s.accountantHiredDay !== null ||
                s.status !== "active" ||
                s.cash < RULES.accountantHire ||
                remainingActions(s) < 1
              }
              onClick={() => dispatch({ type: "hire-accountant" })}
            >
              {s.accountantHiredDay !== null ? "已经入职" : "雇佣财务人员"}
            </button>
          )}
        </>
      }
    >
      {tab === "budget" ? (
        <dl className="detail-grid budget-grid">
          <div>
            <dt>租金与保养</dt>
            <dd>{RULES.fixed + RULES.care} G / 日</dd>
          </div>
          <div>
            <dt>财务日薪</dt>
            <dd>
              {s.accountantHiredDay === null ? 0 : RULES.accountantSalary} G /
              日
            </dd>
          </div>
          <div>
            <dt>今日许可费用</dt>
            <dd>{permitDue(s)} G</dd>
          </div>
          <div>
            <dt>当前库存相关费用上限</dt>
            <dd>{quantity(s) * Math.max(RULES.handling, RULES.storage)} G</dd>
          </div>
        </dl>
      ) : tab === "cash" ? (
        rows.length ? (
          <table className="compact-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>收入</th>
                <th>支出</th>
                <th>现金变化</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(index * 2, index * 2 + 2).map((r) => (
                <tr key={r.day}>
                  <td>第 {r.day} 天</td>
                  <td>{money(r.revenue + r.finance)}</td>
                  <td>{money(r.revenue + r.finance - r.cashFlow)}</td>
                  <td>{signed(r.cashFlow)} G</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="window-empty">
            <h3>账本的第一页</h3>
            <p>打烊后，今天的收入与支出就会记下来。</p>
          </div>
        )
      ) : tab === "debt" ? (
        index === 1 ? (
          <div className="debt-remedy">
            <h3>经营欠款 {money(s.arrears)}</h3>
            <p>最迟第 {s.defaultSince! + 2} 天结束前补齐。补救期暂停采购。</p>
            <div className="inline-actions">
              <button
                className="primary"
                disabled={s.cash < s.arrears}
                onClick={() => dispatch({ type: "arrears", amount: s.arrears })}
              >
                补齐欠款
              </button>
              {s.reputation.guild >= 20 && !s.financeUsed && (
                <button
                  className="secondary"
                  onClick={() => dispatch({ type: "finance" })}
                >
                  公会融资 100 G
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="debt-payment">
            <div className="balance-pair">
              <span>
                未偿债务<strong>{money(s.debt)}</strong>
              </span>
              <span>
                手头现金<strong>{money(s.cash)}</strong>
              </span>
            </div>
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (dispatch({ type: "repay", amount: Number(repay) }))
                  setRepay("");
              }}
            >
              <label htmlFor="repay-debt">提前还款</label>
              <input
                id="repay-debt"
                type="number"
                inputMode="numeric"
                min="1"
                max={Math.min(s.cash, s.debt)}
                aria-label="偿还债务金额"
                value={repay}
                onChange={(e) => setRepay(e.target.value)}
                placeholder="金额"
              />
              <button className="primary" disabled={!repay || !s.debt}>
                偿还债务
              </button>
            </form>
          </div>
        )
      ) : (
        <div className="hire-profile">
          <div className="clerk-portrait">
            <Sprite kind="npc" person={3} />
          </div>
          <div>
            <h3>埃德温 · 财务人员</h3>
            <p>
              {s.accountantHiredDay === null
                ? "请他照看账目，可以咨询每日利润与销售明细。"
                : "埃德温正在账桌旁整理账目，详细解读可以向他询问。"}
            </p>
            <strong>
              {s.accountantHiredDay === null
                ? `入职 ${RULES.accountantHire} G · 日薪 ${RULES.accountantSalary} G`
                : `第 ${s.accountantHiredDay} 天入职`}
            </strong>
          </div>
        </div>
      )}
    </Window>
  );
}
export function expenseRows(r: Ledger): [string, number][] {
  return [
    ["租金", r.fixed],
    ["店铺保养", r.careCost ?? 0],
    ["埃德温日薪", r.staffSalary ?? 0],
    ["雇佣支出", r.staffCost ?? 0],
    ["成交耗材", r.serviceCost ?? 0],
    ["留存护养", r.storageCost ?? 0],
    ["每周许可", r.permitCost ?? 0],
    ["水晶球费用", r.crystalCost ?? 0],
    ["镇区情报", r.townCost ?? 0],
    ["过期损失", r.expiryCost],
    ["没收损失", r.confiscationCost],
    ["失窃现金", r.incidentCashCost ?? 0],
    ["破损库存", r.incidentStockCost ?? 0],
    ["临时修缮", r.repairCost ?? 0],
    ["调查罚款", r.fine],
  ];
}
export function AnalysisPage({
  row,
  view,
  product,
  expensePage = 0,
}: {
  row: Ledger;
  view: string;
  product: ProductId;
  expensePage?: number;
}) {
  if (view === "expenses")
    return (
      <dl className="detail-grid expense-grid">
        {expenseRows(row)
          .slice(expensePage * 4, expensePage * 4 + 4)
          .map(([label, cost]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{money(cost)}</dd>
            </div>
          ))}
      </dl>
    );
  if (view === "profit")
    return (
      <section className="profit-sheet" aria-label="利润解释">
        <div className="profit-topline">
          <div>
            <span>营业利润</span>
            <strong>{signed(row.operatingProfit)} G</strong>
          </div>
          <p>
            收款 {row.revenue} − 药品成本 {row.cogs} = 毛利{" "}
            {row.revenue - row.cogs} G
          </p>
        </div>
        <div className="cost-grid">
          {[
            [
              "店务支出",
              row.fixed +
                (row.careCost ?? 0) +
                (row.serviceCost ?? 0) +
                (row.storageCost ?? 0) +
                (row.permitCost ?? 0),
            ],
            ["人员支出", (row.staffCost ?? 0) + (row.staffSalary ?? 0)],
            [
              "损失与修缮",
              row.expiryCost +
                row.confiscationCost +
                (row.incidentCashCost ?? 0) +
                (row.incidentStockCost ?? 0) +
                (row.repairCost ?? 0),
            ],
            [
              "占卜、情报与罚款",
              (row.crystalCost ?? 0) + (row.townCost ?? 0) + row.fine,
            ],
          ].map(([name, cost]) => (
            <p key={name}>
              {name} {cost} G
            </p>
          ))}
        </div>
      </section>
    );
  if (view === "cash")
    return (
      <section className="cash-sheet">
        <div className="balance-pair">
          <span>
            现金实际变化<strong>{signed(row.cashFlow)} G</strong>
          </span>
          <span>
            扣息后利润<strong>{signed(row.profit)} G</strong>
          </span>
        </div>
        <p>
          采购 {row.purchases} G · 还本金 {row.repaid} G · 补欠款{" "}
          {row.arrearsPaid} G · 融资 {row.finance} G
        </p>
        <p>
          本日利息 {row.interest} G
          加入债务；采购余货计入库存，未付费用记入经营欠款。
        </p>
      </section>
    );
  const d = row.saleDetails?.[product],
    p = PRODUCTS[product];
  if (!d)
    return (
      <div className="window-empty">
        <h3>这一天的明细没有留存</h3>
        <p>
          旧记录未记录当时的客流与售价，无法准确还原销售原因。新结算会保存完整明细。
        </p>
      </div>
    );
  return (
    <section
      className="single-sale"
      aria-label="各商品销量解释"
      data-testid={`sale-detail-${product}`}
    >
      <div className="sale-icon">
        <Potion color={p.color} />
        <h3>{p.name}</h3>
        <strong>
          卖出 {d.sold} / {d.stock} 瓶
        </strong>
      </div>
      <div className="sale-copy">
        <p>
          {d.held ? `${d.held}瓶留作跨日约定，未上架。` : ""}
          {salesReason(d)}
        </p>
        <p>{priceExplanation(d)}</p>
        <small>
          收款 {d.revenue} G · 成本 {d.cogs} G · 毛利{" "}
          {signed(d.revenue - d.cogs)} G{" "}
          {d.expired ? ` · 过期 ${d.expired} 瓶` : ""}
        </small>
      </div>
    </section>
  );
}
export function FinanceWindow({
  s,
  onClose,
}: {
  s: GameState;
  onClose: () => void;
}) {
  const [day, setDay] = useState(s.ledger.at(-1)?.day ?? 0),
    [view, setView] = useState("profit"),
    [page, setPage] = useState(0),
    row = s.ledger.find((r) => r.day === day) ?? s.ledger.at(-1);
  const itemView = view === "sales",
    index = Math.min(page, IDS.length - 1);
  return (
    <Window
      label="财务咨询"
      title="埃德温的账桌"
      onClose={onClose}
      header={
        s.ledger.length > 0 && (
          <div className="day-select" role="group" aria-label="查阅日期">
            <button
              className="secondary"
              aria-label="上一天账目"
              disabled={s.ledger[0].day === row?.day}
              onClick={() => {
                setDay(
                  s.ledger[
                    Math.max(
                      0,
                      s.ledger.findIndex((r) => r.day === row?.day) - 1,
                    )
                  ].day,
                );
                setPage(0);
              }}
            >
              ‹
            </button>
            <span>第 {row?.day} 天</span>
            <button
              className="secondary"
              aria-label="后一天账目"
              disabled={s.ledger.at(-1)?.day === row?.day}
              onClick={() => {
                setDay(
                  s.ledger[
                    Math.min(
                      s.ledger.length - 1,
                      s.ledger.findIndex((r) => r.day === row?.day) + 1,
                    )
                  ].day,
                );
                setPage(0);
              }}
            >
              ›
            </button>
          </div>
        )
      }
      tabs={
        s.accountantHiredDay !== null && (
          <Tabs
            tabs={[
              { id: "profit", label: "利润" },
              { id: "cash", label: "现金" },
              { id: "expenses", label: "费用" },
              { id: "sales", label: "销量" },
            ]}
            value={view}
            onChange={(v) => {
              setView(v);
              setPage(0);
            }}
          />
        )
      }
      hint={
        view === "expenses"
          ? "费用含应付及库存损失；现金页记录实际变化。"
          : "“每枚金币，都有它的来处。”"
      }
      footer={
        row && (itemView || view === "expenses") ? (
          <Pager
            label="药水页码"
            page={index}
            count={
              view === "expenses"
                ? Math.ceil(expenseRows(row).length / 4)
                : IDS.length
            }
            onChange={setPage}
          />
        ) : undefined
      }
    >
      {s.accountantHiredDay === null ? (
        <p>财务人员尚未入职。</p>
      ) : row ? (
        <AnalysisPage
          row={row}
          view={view}
          product={IDS[index]}
          expensePage={index}
        />
      ) : (
        <div className="window-empty">
          <h3>今天还没有打烊</h3>
          <p>“等收入记上账，我再替你细看。”</p>
        </div>
      )}
    </Window>
  );
}
