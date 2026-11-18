import { useEffect, useRef, useState } from "react";
import type { GameState } from "../engine/types";
import { IDS } from "../engine/types";
import { PRODUCTS } from "../engine/config";
import { netAssets } from "../engine/game";
import { money, signed } from "./Shared";
import { ProfitExplanation, SalesExplanation } from "./SalesExplanation";
import { X, Moon, Sun, Receipt, ArrowRight, RotateCcw } from "./PixelIcons";
export function Dialog({
  children,
  label,
  onClose,
}: {
  children: React.ReactNode;
  label: string;
  onClose?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    // Native dialog autofocus otherwise jumps to a control below a long report.
    el?.querySelector<HTMLElement>(".dialog-body")?.focus({
      preventScroll: true,
    });
    if (el) el.scrollTop = 0;
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
    >
      <div className="dialog-body" tabIndex={-1}>
        {onClose ? (
          <button
            className="icon-button dialog-close"
            onClick={onClose}
            aria-label="关闭"
          >
            <X size={20} />
          </button>
        ) : null}
        {children}
      </div>
    </dialog>
  );
}
export function Report({ s, onNext }: { s: GameState; onNext: () => void }) {
  const r = s.ledger.at(-1)!;
  const [view, setView] = useState<"profit" | "sales">("profit");
  return (
    <Dialog label="营业报告">
      <div className="report-symbol">
        <Moon size={28} />
      </div>
      <p className="dialog-caption">月隐巷的灯，暂时熄了。</p>
      <h2>第 {r.day} 天 · 营业报告</h2>
      <div className="report-main">
        <span>今日营业利润</span>
        <strong className={r.operatingProfit >= 0 ? "positive" : "warning"}>
          {signed(r.operatingProfit)} <small>G</small>
        </strong>
        <p>扣除利息后利润 {signed(r.profit)} G</p>
      </div>
      <div className="report-tabs" role="group" aria-label="结算说明">
        <button
          className={view === "profit" ? "selected" : ""}
          aria-pressed={view === "profit"}
          onClick={() => setView("profit")}
        >
          看懂利润
        </button>
        <button
          className={view === "sales" ? "selected" : ""}
          aria-pressed={view === "sales"}
          onClick={() => setView("sales")}
        >
          销售原因
        </button>
      </div>
      {view === "profit" ? (
        <>
          <ProfitExplanation row={r} />
          <details className="report-financial-details">
            <summary>查看完整收支、库存与声望</summary>
            <dl className="report-numbers">
              <div>
                <dt>营业收入</dt>
                <dd>{money(r.revenue)}</dd>
              </div>
              <div>
                <dt>其中特殊订单</dt>
                <dd>{money(r.orderRevenue)}</dd>
              </div>
              <div>
                <dt>销货成本</dt>
                <dd>−{money(r.cogs)}</dd>
              </div>
              <div>
                <dt>过期 / 没收成本</dt>
                <dd>−{money(r.expiryCost + r.confiscationCost)}</dd>
              </div>
              <div>
                <dt>固定成本 / 罚款</dt>
                <dd>−{money(r.fixed + r.fine)}</dd>
              </div>
              <div>
                <dt>债务利息（资本化）</dt>
                <dd>+{money(r.interest)}</dd>
              </div>
              <div className="report-divider">
                <dt>今日采购支出</dt>
                <dd>{money(r.purchases)}</dd>
              </div>
              <div>
                <dt>净现金流</dt>
                <dd>{signed(r.cashFlow)} G</dd>
              </div>
              <div>
                <dt>期末净资产</dt>
                <dd>{money(r.assets)}</dd>
              </div>
              <div>
                <dt>剩余库存 / 过期</dt>
                <dd>
                  {r.stock} / {r.expired} 瓶
                </dd>
              </div>
              <div>
                <dt>调查风险变化</dt>
                <dd>{signed(r.riskDelta)}</dd>
              </div>
              <div>
                <dt>声望变化 · 王国 / 公会 / 黑市</dt>
                <dd>
                  {signed(r.repDelta.kingdom)} / {signed(r.repDelta.guild)} /{" "}
                  {signed(r.repDelta.black)}
                </dd>
              </div>
            </dl>
          </details>
        </>
      ) : (
        <SalesExplanation row={r} />
      )}
      {r.notes.length > 0 ? (
        <details className="report-details">
          <summary>今日事件与损失记录</summary>
          {r.notes.map((n, i) => (
            <p key={i}>{n}</p>
          ))}
        </details>
      ) : null}
      {s.arrears > 0 ? (
        <p className="alert warning">
          逾期欠款 {money(s.arrears)}；最迟第 {s.defaultSince! + 2}{" "}
          天结束前补齐。采购暂时关闭。
        </p>
      ) : null}
      <button className="primary full" onClick={onNext}>
        <Sun size={18} />
        开始第 {s.day} 天<ArrowRight size={16} />
      </button>
      <p className="small muted center">
        进度已自动保存 · 明天，做一个更好的选择
      </p>
    </Dialog>
  );
}
export function GameOver({
  s,
  onRestart,
}: {
  s: GameState;
  onRestart: () => void;
}) {
  return (
    <Dialog label="经营结束">
      <div className="report-symbol">
        <Receipt size={30} />
      </div>
      <p className="dialog-caption">每一家关门的店，都有自己的故事。</p>
      <h2>店铺歇业了</h2>
      <p className="failure-reason">{s.reason}</p>
      <dl className="report-numbers">
        <div>
          <dt>生存天数</dt>
          <dd>{s.stats.days} 天</dd>
        </div>
        <div>
          <dt>最终现金</dt>
          <dd>{money(s.cash)}</dd>
        </div>
        <div>
          <dt>剩余债务</dt>
          <dd>{money(s.debt)}</dd>
        </div>
        <div>
          <dt>逾期欠款</dt>
          <dd>{money(s.arrears)}</dd>
        </div>
        <div>
          <dt>净资产</dt>
          <dd>{money(netAssets(s))}</dd>
        </div>
        <div>
          <dt>累计营业收入</dt>
          <dd>{money(s.stats.revenue)}</dd>
        </div>
        <div>
          <dt>最大单日亏损</dt>
          <dd>{money(s.stats.maxLoss)}</dd>
        </div>
      </dl>
      <p className="hint">
        {s.strikes >= 2
          ? "保持低风险能让生意更长久。暂停违禁交易，每天可降低 5 点风险。"
          : "起步时少量进货、留出两天租金，避免现金被库存占满。高售价未必带来更多收入。"}
      </p>
      <button className="primary full" onClick={onRestart}>
        <RotateCcw size={17} />
        重新开始
      </button>
    </Dialog>
  );
}
export function Rules({ onClose }: { onClose: () => void }) {
  return (
    <Dialog label="游戏规则" onClose={onClose}>
      <h2>月隐巷生意经</h2>
      <div className="rules">
        <section>
          <h3>观察 → 决策 → 营业 → 承担后果</h3>
          <p>
            你从 500 G 现金、300 G
            债务和空仓库开始。没有通关期限，活下去就是目标。每天采购、定价、处理最多两笔特殊订单，再结束营业。
          </p>
        </section>
        <section>
          <h3>魔药与需求</h3>
          <p>
            每瓶占一格，仓库 30
            格。采购有现金、容量、当日供应限制。只有结束营业才普通零售，没有批发回购。治疗药水购入当日算第
            1 天，第 7 天结束时剩余药水过期；其他商品长期保存。
          </p>
          <p>
            售价可设参考价 70%–160%。需求 = 基础需求 × 事件系数 ×
            clamp(2−售价/参考价, 0.2, 1.3) × 0.85–1.15
            随机系数，向下取整后以有效库存为上限。高价可能零销量。
          </p>
          <p>
            货架显示当前售价下的预计日销量范围，不包含库存限制。结算的“销售原因”会记录实际客流、定价影响、有效库存和每种药的毛利。
          </p>
        </section>
        <section>
          <h3>债务和补救期</h3>
          <p>
            每日租金 12 G。每逢第 7、14、21…天，对未偿债务收取向上取整的 5%
            利息，加入债务，不扣现金。可在账本提前还款。
          </p>
          <p>
            现金不足支付租金时，记录逾期并暂停采购。允许继续卖现有库存、交订单、偿还欠款。最多两个后续营业日补救，届时仍逾期则破产。公会声望达到
            20 后可在补救期获得一次 100 G 融资，同时增加债务。
          </p>
        </section>
        <section>
          <h3>阵营、订单与执法</h3>
          <p>
            订单即时扣货收款，占一次行动；拒绝不耗行动。供应军方提升王国声望，援助医生提升公会声望，走私提升黑市声望并带来风险。声望范围
            −100 至 +100，影响订单资格。
          </p>
          <p>
            普通公会与法师收购按当日参考零售价的 72%–112%
            报价，当天固定。先比较药品成本、交单毛利与留货零售的差额：零售须有顾客，订单立即收款。拒绝不扣声望、不罚款；剧情订单的后续影响会单独说明。
          </p>
          <p>
            隐身药剂一直违禁；狂暴药剂战时管制。普通违禁零售每瓶风险
            +8，走私订单风险 +20。没有非法交易的日子风险 −5。50–74
            为高风险，调查概率 5%–15%；75–100 为危险，概率 15%–30%。调查罚款基础
            45 G，后续每次 +15 G，并没收违禁库存、王国声望 −10。
          </p>
          <p>
            首次违规不会直接查封。正式警告后，另一个营业日继续违法、风险至少
            90、再次被调查，才会永久查封。
          </p>
        </section>
        <section>
          <h3>看懂账目</h3>
          <p>
            营业利润 = 收入 − 售出库存成本 − 过期/没收成本 − 租金 −
            罚款。扣息利润再减利息。现金流是当天实际现金增减，包含采购、还本金与借款。净资产
            = 现金 + 库存采购成本 − 债务 − 逾期欠款。
          </p>
        </section>
        <section>
          <h3>自动存档</h3>
          <p>
            每次成功操作立即保存在当前浏览器。关闭后再打开会继续游戏。换设备、无痕模式、清除浏览器数据不会保留进度。请避免同时在多个标签页经营；游戏会检测冲突。固定种子可在重新开局时设置以复现行情。
          </p>
        </section>
      </div>
    </Dialog>
  );
}
export function Restart({
  onClose,
  onRestart,
  seed,
}: {
  onClose: () => void;
  onRestart: (seed?: number) => void;
  seed: number;
}) {
  const [value, setValue] = useState("");
  return (
    <Dialog label="重新开局" onClose={onClose}>
      <h2>再点亮一次店灯</h2>
      <p className="muted">重新开始会覆盖当前浏览器中的经营进度。</p>
      <label className="seed-label">
        随机种子（可选）
        <input
          aria-label="随机种子"
          type="number"
          min="0"
          max="4294967295"
          placeholder="留空开启新故事"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <p className="small muted">
        本轮种子：{seed}。相同种子和相同操作会产生相同结果。
      </p>
      <button
        className="primary full"
        disabled={
          value !== "" &&
          (!Number.isInteger(Number(value)) ||
            Number(value) < 0 ||
            Number(value) > 4294967295)
        }
        onClick={() => onRestart(value === "" ? undefined : Number(value))}
      >
        开始新一轮
      </button>
      <button className="secondary full" onClick={onClose}>
        继续当前经营
      </button>
    </Dialog>
  );
}
