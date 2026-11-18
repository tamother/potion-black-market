import { activeContracts, usable } from "../engine/town";
import { remainingActions } from "../engine/actions";
import { useState, useEffect, useRef } from "react";
import type { GameState } from "../engine/types";
import { IDS } from "../engine/types";
import { PRODUCTS } from "../engine/config";
import { available } from "../engine/inventory";
import { netAssets } from "../engine/game";
import { Sprite } from "../world/Sprite";
import { visitorFor, visitorWords, ORDER_WORDS } from "../world/visitors";
import { Potion } from "../components/Potion";
import { money, signed } from "../components/Shared";
import { Window, Tabs, Pager, type UIProps } from "./Window";
import { baseDailyDue } from "../engine/hazards";
import { RULES } from "../engine/config";
import { textPages } from "./paging";
import { OwlSprite } from "../world/Owl";
export function NewsWindow({
  s,
  onClose,
  visible = true,
}: {
  s: GameState;
  onClose: () => void;
  visible?: boolean;
}) {
  const [page, setPage] = useState(0),
    letters = (
      s.news.length ? s.news : ["今夜巷子很安静。小夜祝你生意顺利。"]
    ).flatMap((n) => textPages(n, 46)),
    index = Math.min(page, letters.length - 1),
    options = useRef({ onClose, visible });
  options.current = { onClose, visible };
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(
      () => {
        if (!options.current.visible) return;
        if (index < letters.length - 1) setPage(index + 1);
        else options.current.onClose();
      },
      Math.max(6000, Array.from(letters[index]).length * 160),
    );
    return () => clearTimeout(timer);
  }, [index, visible, letters.length, s.day]);
  return (
    <aside
      className="owl-bulletin"
      role="dialog"
      aria-modal="false"
      aria-label="每日资讯"
      hidden={!visible}
    >
      <div
        className="bulletin-copy"
        aria-live="polite"
        aria-atomic="true"
        data-window-content
      >
        <h2 aria-label="小夜的开店来信">小夜</h2>
        <p>{letters[index]}</p>
      </div>
      <div className="bulletin-controls">
        <span>
          第{s.day}天 · {index + 1}/{letters.length}
        </span>
        {letters.length > 1 && (
          <>
            <button
              type="button"
              aria-label="上一页"
              disabled={index === 0}
              onClick={() => setPage(index - 1)}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="下一页"
              disabled={index === letters.length - 1}
              onClick={() => setPage(index + 1)}
            >
              ›
            </button>
          </>
        )}
        <button
          type="button"
          aria-label="收好信件"
          title="收好信件"
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </aside>
  );
}
export function VisitorWindow({ s, dispatch, onClose, notice }: UIProps) {
  const [page, setPage] = useState(0),
    v = visitorFor(s),
    index = Math.min(page, Math.max(0, s.orders.length - 1)),
    o = s.orders[index];
  return (
    <Window
      label="今日来客"
      title={`${v.name} · ${v.role}`}
      onClose={onClose}
      notice={notice}
      hint={
        o?.status === "open"
          ? `交付2行动 · 余${remainingActions(s)}点 · 现有${usable(s, o.product)}瓶`
          : "来客整理好行囊，准备告辞。"
      }
      footer={
        <>
          {s.orders.length > 1 && (
            <Pager
              label="委托页码"
              page={index}
              count={s.orders.length}
              onChange={setPage}
            />
          )}{" "}
          {o?.status === "open" ? (
            <>
              <button
                className="secondary"
                aria-label={`拒绝${o.title}`}
                onClick={() =>
                  dispatch({ type: "order", id: o.id, accept: false })
                }
              >
                这次不接
              </button>
              {usable(s, o.product) < o.qty ? (
                <button className="primary" onClick={onClose}>
                  先去备货
                </button>
              ) : (
                <button
                  className="primary"
                  aria-label={`接受${o.title}`}
                  disabled={s.actions >= 2 || remainingActions(s) < 2}
                  onClick={() =>
                    dispatch({ type: "order", id: o.id, accept: true })
                  }
                >
                  交付药水 · 2行动
                </button>
              )}
            </>
          ) : (
            <button className="secondary" onClick={onClose}>
              下次再见
            </button>
          )}
        </>
      }
    >
      <div className="visitor-page">
        <div className="visitor-portrait">
          <Sprite kind="npc" person={v.sprite} />
        </div>
        <article>
          {o ? (
            <>
              <h3>{o.title}</h3>
              <p>
                {o.status === "open"
                  ? `“${visitorWords(s, o)}”`
                  : o.status === "accepted"
                    ? "“收到了，谢谢。愿你的店灯长亮。”"
                    : "“明白了，下次有机会再谈。”"}
              </p>
              <div className="request-strip">
                <span>
                  {PRODUCTS[o.product].name} × {o.qty}
                </span>
                <strong>报酬 {money(o.reward)}</strong>
              </div>
              {o.status !== "open" && (
                <small>{o.status === "accepted" ? "已交付" : "已婉拒"}</small>
              )}
            </>
          ) : (
            <p>“路过这里，进来歇歇脚。祝你生意顺利。”</p>
          )}
        </article>
      </div>
    </Window>
  );
}
export function ReceiptWindow({
  s,
  onNext,
  saved = true,
  nextLabel,
}: {
  s: GameState;
  onNext: () => void;
  saved?: boolean;
  nextLabel?: string;
}) {
  const r = s.ledger.at(-1)!,
    [view, setView] = useState("basic"),
    [page, setPage] = useState(0);
  const notes = r.notes.flatMap((n) => textPages(n, 72)),
    itemView = view === "sales" || view === "formula",
    index = Math.min(
      page,
      itemView ? IDS.length - 1 : Math.max(0, notes.length - 1),
    );
  const tabs = [
    { id: "basic", label: "收支记录" },
    { id: "sold", label: "售出药水" },
    { id: "notes", label: "纪事" },
  ];
  return (
    <Window
      label="营业报告"
      title={`第 ${r.day} 天 · 营业报告`}
      tabs={
        <Tabs
          tabs={tabs}
          value={view}
          onChange={(v) => {
            setView(v);
            setPage(0);
          }}
        />
      }
      hint={
        s.arrears
          ? `经营欠款 ${s.arrears} G · 最迟第 ${s.defaultSince! + 2} 天末补齐`
          : saved
            ? "进度已自动保存"
            : "进度未保存，请留意存储提示。"
      }
      footer={
        <>
          {(itemView || (view === "notes" && notes.length > 1)) && (
            <Pager
              page={index}
              count={itemView ? IDS.length : notes.length}
              onChange={setPage}
            />
          )}
          <button className="primary" onClick={onNext}>
            {nextLabel ?? `开始第 ${s.day} 天`}
          </button>
        </>
      }
    >
      {view === "basic" ? (
        <div className="receipt-basic">
          <div className="receipt-change">
            <span>今日现金变化</span>
            <strong>{signed(r.cashFlow)} G</strong>
          </div>
          <dl className="detail-grid">
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
        </div>
      ) : view === "sold" ? (
        <div className="sold-grid">
          {IDS.map((id) => (
            <div key={id}>
              <Potion color={PRODUCTS[id].color} />
              <h3>{PRODUCTS[id].name}</h3>
              <strong>{r.sales[id]} 瓶</strong>
            </div>
          ))}
        </div>
      ) : view === "notes" ? (
        <article className="story-page">
          <h3>今天发生的事</h3>
          <p>{notes[index] ?? "今夜风平浪静。"}</p>
        </article>
      ) : null}
    </Window>
  );
}
export function CloseWindow({ s, dispatch, onClose, notice }: UIProps) {
  return (
    <Window
      label="准备开业"
      title="已经备好货，准备开业"
      kind="closing-window"
      onClose={onClose}
      notice={notice}
      hint="黑市只在夜间营业：白天准备，入夜迎客，打烊后结账。"
      footer={
        <>
          <button className="secondary" onClick={onClose}>
            继续备货
          </button>
          <button
            className="primary"
            onClick={() => {
              if (dispatch({ type: "end", day: s.day })) onClose();
            }}
          >
            入夜开业
          </button>
        </>
      }
    >
      <div className="closing-page">
        <span aria-hidden="true">☾</span>
        <div>
          <h3>把灯点亮，迎接今夜的客人？</h3>
          <p>
            今日固定待付 {baseDailyDue(s)} G；每售出或交付一瓶耗材
            {RULES.handling} G，留存每瓶护养{RULES.storage} G。
          </p>
          {activeContracts(s).some((c) => c.deadline <= s.day) && (
            <p className="quiet-note">有约定今晚截止，请先确认是否交货。</p>
          )}
          {s.orders.some((o) => o.status === "open") && (
            <p className="quiet-note">还有委托未处理，开业后将不再受理。</p>
          )}
        </div>
      </div>
    </Window>
  );
}
export function SettingsWindow({
  muted,
  onMute,
  onClose,
  onRules,
  onRestart,
  onNews,
}: {
  muted: boolean;
  onMute: () => void;
  onClose: () => void;
  onRules: () => void;
  onRestart: () => void;
  onNews: () => void;
}) {
  return (
    <Window
      label="设置"
      title="月隐巷 · 店内手记"
      kind="settings-window"
      onClose={onClose}
      hint="进度保存在当前浏览器，不会跨设备同步。"
    >
      <div className="settings-grid">
        <button className="secondary" onClick={onRules}>
          操作与经营规则
        </button>
        <button className="secondary" onClick={onMute}>
          {muted ? "开启声音" : "关闭声音"}
        </button>
        <button className="secondary" onClick={onNews}>
          重读今日来信
        </button>
        <button className="secondary" onClick={onRestart}>
          重新开局
        </button>
      </div>
    </Window>
  );
}
const RULE_TEXT: Record<string, string[]> = {
  move: [
    "电脑用 WASD 或方向键移动，靠近物件按 E 或空格交互。也可以点击物件，让人物走近。",
    "手机从左下摇杆区起手，拖动控制方向；手指超出圆盘仍可移动。抬手立即停下，右下按钮交互。阅读窗口不会推进时间。",
  ],
  shop: [
    "进货簿采购、货架定价、箱子查看库存、账本记录流水。每天小夜自动送来资讯，来客带来委托，门口营业牌用于入夜开业；黑市白天备货、晚上迎客。",
    "每日租金12 G、保养4 G；每售出/交付一瓶耗材2 G，留存一瓶护养1 G，每七日许可30 G。治疗药水从购入日起第7天末过期，其余长期保存。高售价会减少需求。库存按先进先出使用。",
    "店门通往月隐镇：集市有轮换散货与预订，公会和旧巷有跨日委托。走路往返免费；荣誉榜独立查看三方关系与已获权益。",
    "跨日委托接受1行动、交货2行动，默认留货不零售；在布告约定可切换。取消关系-4，截止未交关系-8；到对应镇区联系人交货。预订货品付钱时占仓位，次日新批次到货。",
    "每天恢复8点行动：采购/实际改价/雇佣/购入水晶球/护店各1点，交付委托2点；原每日2份特殊履约上限保留。走路、查阅、拒单、还款及开业免费，行动不结转，不付费补充。",
    "基础账本可还款，每七天债务计息5%，利息加入债务。经营欠款有两个后续营业日补救，期间暂停采购。埃德温入职120 G，日薪10 G，入职当天也计薪；详细解读要在次日找他。",
  ],
  risk: [
    "经营满5天后，第6天黑市商人上门，水晶球售价160 G；未购入时每隔3天再来。水晶球每次8 G，仅当晚把店内意外概率降低60%，每日最多一次。",
    "每日来信预警失窃、瓶子破损、魔灯熄灭或临时修缮，概率随当晚局势变化。前两天平静，意外发生后的下一天也平静；水晶球不能影响王国调查。",
    "隐身药剂一直违禁；狂暴药剂战时管制。非法零售每瓶风险+8，非法订单风险+20。没有非法交易的日子风险降低5点。",
    "首次调查会留下正式警告。警告后在另一天继续严重违法、风险达到90且再次调查，才会永久查封。布告栏可查看调查档案。",
  ],
  save: [
    "成功操作即时保存在当前浏览器，刷新可以继续。清除数据、换设备或结束无痕会话不会同步。",
    "请避免多个标签页同时经营。检测到存档冲突会暂停旧页面，刷新读取新进度后继续。",
  ],
};
export function RulesWindow({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState("move"),
    [page, setPage] = useState(0),
    pages = RULE_TEXT[tab].flatMap((t) => textPages(t, 72)),
    index = Math.min(page, pages.length - 1);
  return (
    <Window
      label="游戏规则"
      title="月隐巷生意经"
      onClose={onClose}
      tabs={
        <Tabs
          tabs={[
            { id: "move", label: "操作" },
            { id: "shop", label: "经营" },
            { id: "risk", label: "风险" },
            { id: "save", label: "存档" },
          ]}
          value={tab}
          onChange={(v) => {
            setTab(v);
            setPage(0);
          }}
        />
      }
      footer={<Pager page={index} count={pages.length} onChange={setPage} />}
      hint="慢慢熟悉这间小店。"
    >
      <article className="story-page">
        <h3>
          {
            (
              {
                move: "在店里走一走",
                shop: "经营一天",
                risk: "巷间的规矩",
                save: "留下你的故事",
              } as Record<string, string>
            )[tab]
          }
        </h3>
        <p>{pages[index]}</p>
      </article>
    </Window>
  );
}
export function RestartWindow({
  seed,
  onClose,
  onRestart,
}: {
  seed: number;
  onClose: () => void;
  onRestart: (seed?: number) => void;
}) {
  const [value, setValue] = useState(""),
    n = Number(value),
    bad = value !== "" && (!Number.isInteger(n) || n < 0 || n > 4294967295);
  return (
    <Window
      label="重新开局"
      title="再点亮一次店灯"
      kind="restart-window"
      onClose={onClose}
      hint={`本轮种子：${seed}`}
      footer={
        <>
          <button className="secondary" onClick={onClose}>
            继续当前经营
          </button>
          <button
            className="primary"
            disabled={bad}
            onClick={() => onRestart(value === "" ? undefined : n)}
          >
            开始新一轮
          </button>
        </>
      }
    >
      <div className="restart-page">
        <p>重新开始会覆盖当前浏览器中的经营进度。</p>
        <label htmlFor="run-seed">
          随机种子（可选）
          <input
            id="run-seed"
            aria-label="随机种子"
            type="number"
            min="0"
            max="4294967295"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="留空开启新故事"
          />
        </label>
      </div>
    </Window>
  );
}
export function GameOverWindow({
  s,
  onRestart,
}: {
  s: GameState;
  onRestart: () => void;
}) {
  const [tab, setTab] = useState("end"),
    [page, setPage] = useState(0),
    reasons = textPages(s.reason ?? "店铺结束了这段经营。", 72),
    index = Math.min(page, tab === "end" ? reasons.length - 1 : 1);
  const [receipt, setReceipt] = useState(false);
  if (receipt)
    return (
      <ReceiptWindow
        s={s}
        nextLabel="返回经营结局"
        onNext={() => setReceipt(false)}
      />
    );
  return (
    <Window
      label="经营结束"
      title="店铺歇业了"
      tabs={
        <Tabs
          tabs={[
            { id: "end", label: "结局" },
            { id: "accounts", label: "最终账目" },
            ...(s.ledger.length
              ? [{ id: "receipt", label: "最后一晚收据" }]
              : []),
          ]}
          value={tab}
          onChange={(v) => {
            if (v === "receipt") setReceipt(true);
            else {
              setTab(v);
              setPage(0);
            }
          }}
        />
      }
      hint={`你让店灯亮了 ${s.stats.days} 个营业日。`}
      footer={
        <>
          {(tab === "accounts" || reasons.length > 1) && (
            <Pager
              page={index}
              count={tab === "end" ? reasons.length : 2}
              onChange={setPage}
            />
          )}
          <button className="primary" onClick={onRestart}>
            重新开始
          </button>
        </>
      }
    >
      {tab === "end" ? (
        <article className="story-page">
          <small>月隐巷会记得这间店</small>
          <h3>每一次关门，都有自己的故事</h3>
          <p>{reasons[index]}</p>
        </article>
      ) : (
        <dl className="detail-grid final-accounts">
          {(index === 0
            ? [
                ["现金", s.cash],
                ["剩余债务", s.debt],
                ["逾期欠款", s.arrears],
                ["净资产", netAssets(s)],
              ]
            : [
                ["累计营业收入", s.stats.revenue],
                ["最大单日亏损", s.stats.maxLoss],
              ]
          ).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{money(Number(value))}</dd>
            </div>
          ))}
        </dl>
      )}
    </Window>
  );
}
