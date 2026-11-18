import { useState } from "react";
import type { Action, GameState } from "../engine/types";
import { IDS } from "../engine/types";
import { PRODUCTS, RULES } from "../engine/config";
import { ProfitExplanation, SalesExplanation } from "./SalesExplanation";
import { Sprite } from "../world/Sprite";
import { money, signed } from "./Shared";
export function BasicLedger({
  s,
  dispatch,
}: {
  s: GameState;
  dispatch: (a: Action) => boolean;
}) {
  const [repay, setRepay] = useState("");
  return (
    <div className="basic-ledger">
      <div className="book-balances">
        <div>
          <span>手头现金</span>
          <strong>{money(s.cash)}</strong>
        </div>
        <div>
          <span>未偿债务</span>
          <strong>{money(s.debt)}</strong>
        </div>
      </div>
      <p className="book-note">
        每七天计息一次，利息加入债务。这里记下每天实际进出的钱。
      </p>
      {s.arrears > 0 && (
        <div className="book-arrears">
          <h3>租金逾期 {money(s.arrears)}</h3>
          <p>最迟第 {s.defaultSince! + 2} 天结束前补齐。补救期暂停采购。</p>
          <button
            className="secondary"
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
              向公会紧急融资 100 G
            </button>
          )}
        </div>
      )}
      <form
        className="repayment-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (dispatch({ type: "repay", amount: Number(repay) })) setRepay("");
        }}
      >
        <label>
          提前还款
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max={Math.min(s.cash, s.debt)}
            value={repay}
            onChange={(e) => setRepay(e.target.value)}
            aria-label="偿还债务金额"
            placeholder="金额"
          />
        </label>
        <button className="secondary" disabled={!repay || s.debt === 0}>
          偿还债务
        </button>
      </form>
      <h3 className="book-section-title">每日流水</h3>
      {!s.ledger.length ? (
        <p className="book-note">第一页还空着。打烊后会记下今天的收支。</p>
      ) : (
        <div className="simple-ledger-table">
          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>收入</th>
                <th>支出</th>
                <th>现金变化</th>
              </tr>
            </thead>
            <tbody>
              {s.ledger
                .slice()
                .reverse()
                .map((r) => (
                  <tr key={r.day}>
                    <td>第 {r.day} 天</td>
                    <td>{r.revenue + r.finance} G</td>
                    <td>{r.revenue + r.finance - r.cashFlow} G</td>
                    <td>{signed(r.cashFlow)} G</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {s.accountantHiredDay === null ? (
        <section className="hire-accountant">
          <h3>账桌旁还空着一个位置</h3>
          <p>
            财务人员埃德温愿意来照看账目。入职后，可以向他请教每日利润和销售明细。
          </p>
          <div>
            <span>
              一次雇佣费用 <b>{RULES.accountantHire} G</b>
            </span>
            <button
              className="primary"
              disabled={s.status !== "active" || s.cash < RULES.accountantHire}
              onClick={() => dispatch({ type: "hire-accountant" })}
            >
              雇佣财务人员
            </button>
          </div>
          <small>支付后长期入职，费用记入当天支出。</small>
        </section>
      ) : (
        <p className="book-note">
          埃德温正在旁边整理账目。详细解读可以向他询问。
        </p>
      )}
    </div>
  );
}
export function FinanceDesk({ s }: { s: GameState }) {
  const [day, setDay] = useState(s.ledger.at(-1)?.day ?? 0);
  if (s.accountantHiredDay === null) return <p>财务人员尚未入职。</p>;
  const row = s.ledger.find((r) => r.day === day) ?? s.ledger.at(-1);
  return (
    <div className="finance-consultation">
      <div className="conversation-opening">
        <div className="portrait-frame">
          <Sprite kind="npc" person={3} />
        </div>
        <div>
          <p className="speaker-role">财务人员</p>
          <h2>埃德温</h2>
          <p>“让我们看看，每枚金币都去了哪里。”</p>
        </div>
      </div>
      {row ? (
        <>
          <label className="finance-day">
            查阅日期
            <select
              value={row.day}
              onChange={(e) => setDay(Number(e.target.value))}
            >
              {s.ledger
                .slice()
                .reverse()
                .map((r) => (
                  <option key={r.day} value={r.day}>
                    第 {r.day} 天
                  </option>
                ))}
            </select>
          </label>
          <ProfitExplanation row={row} />
          <SalesExplanation row={row} />
        </>
      ) : (
        <p className="book-note">
          “今天还没有打烊。等收入记上账，我再替你细看。”
        </p>
      )}
    </div>
  );
}
export function DayReceipt({
  s,
  onNext,
}: {
  s: GameState;
  onNext: () => void;
}) {
  const r = s.ledger.at(-1)!;
  const [view, setView] = useState<"basic" | "profit" | "sales">("basic");
  const hired = s.accountantHiredDay !== null;
  return (
    <>
      <div className="receipt-moon">☾</div>
      <p className="dialog-caption">店灯熄了，明天再见。</p>
      <h2>第 {r.day} 天 · 营业报告</h2>
      {hired && (
        <div className="receipt-tabs" role="group" aria-label="结算说明">
          <button
            className={view === "basic" ? "selected" : ""}
            onClick={() => setView("basic")}
          >
            收支记录
          </button>
          <button
            className={view === "profit" ? "selected" : ""}
            onClick={() => setView("profit")}
          >
            看懂利润
          </button>
          <button
            className={view === "sales" ? "selected" : ""}
            onClick={() => setView("sales")}
          >
            销售原因
          </button>
        </div>
      )}
      {!hired || view === "basic" ? (
        <>
          <div className="receipt-total">
            <span>今日现金变化</span>
            <strong>{signed(r.cashFlow)} G</strong>
          </div>
          <dl className="receipt-lines">
            <div>
              <dt>收入</dt>
              <dd>{money(r.revenue + r.finance)}</dd>
            </div>
            <div>
              <dt>实际支出</dt>
              <dd>{money(r.revenue + r.finance - r.cashFlow)}</dd>
            </div>
            <div>
              <dt>剩余现金</dt>
              <dd>{money(r.cash)}</dd>
            </div>
            <div>
              <dt>未偿债务</dt>
              <dd>{money(r.debt)}</dd>
            </div>
          </dl>
          <div className="receipt-sales">
            {IDS.map((id) => (
              <span key={id}>
                {PRODUCTS[id].name}
                <b>{r.sales[id]} 瓶</b>
              </span>
            ))}
          </div>
          {!hired && (
            <p className="book-note">
              账本已记下流水。雇佣财务人员后，可请他解读每日利润。
            </p>
          )}
        </>
      ) : view === "profit" ? (
        <ProfitExplanation row={r} />
      ) : (
        <SalesExplanation row={r} />
      )}
      {r.notes.length > 0 && (
        <details className="receipt-notes">
          <summary>今日发生的事</summary>
          {r.notes.map((n, i) => (
            <p key={i}>{n}</p>
          ))}
        </details>
      )}
      {s.arrears > 0 && (
        <p className="book-arrears">
          欠租 {money(s.arrears)}，最迟第 {s.defaultSince! + 2} 天结束前补齐。
        </p>
      )}
      <button className="primary full" onClick={onNext}>
        开始第 {s.day} 天
      </button>
      <p className="small muted center">进度已自动保存</p>
    </>
  );
}
