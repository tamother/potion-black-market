import { useState } from "react";
import { IDS, type Faction, type ProductId } from "../engine/types";
import type { Contract, SupplySource } from "../engine/townTypes";
import { PRODUCTS } from "../engine/config";
import {
  CONTACTS,
  RANK_NAMES,
  nextRelation,
  relationRank,
} from "../engine/relations";
import {
  activeContracts,
  freeCapacity,
  spotProduct,
  townQuote,
  usable,
} from "../engine/town";
import { townOutlook } from "../engine/forecasts";
import { remainingActions } from "../engine/actions";
import { isIllegal } from "../engine/economy";
import { Potion } from "../components/Potion";
import { Window, type UIProps } from "./Window";
import { contractWords } from "./ContractView";

const CHANNELS: Record<Faction, SupplySource[]> = {
  kingdom: ["spot", "reserve", "official"],
  guild: [],
  black: ["black"],
};
const SOURCE_NAMES = {
  spot: "今日散货",
  reserve: "公会预订（次日到货）",
  official: "王国正规供货",
  black: "旧巷货源",
};
const GREETINGS = {
  kingdom: "来看看今天能补些什么货。",
  guild: "有要备药的队伍，我会把委托交给你看。",
  black: "想找货，或是听点街上的消息？",
};

function TownSupply({
  s,
  dispatch,
  sources,
}: Pick<UIProps, "s" | "dispatch"> & {
  sources: SupplySource[];
}) {
  const [selected, setSelected] = useState<SupplySource>(sources[0]);
  const [product, setProduct] = useState<ProductId>("healing");
  const [qty, setQty] = useState("1");
  const source = sources.includes(selected) ? selected : sources[0];
  const goods =
    source === "official" ? IDS.filter((id) => !isIllegal(s, id)) : IDS;
  const id =
    source === "spot"
      ? spotProduct(s)
      : goods.includes(product)
        ? product
        : goods[0];
  const quote = townQuote(s, source, id);
  const n = Number(qty);
  const capacity = freeCapacity(s);
  const limit = Math.min(
    quote.remaining,
    capacity,
    Math.floor(s.cash / quote.price),
  );
  const canBuy =
    !quote.blocked &&
    Number.isSafeInteger(n) &&
    n >= 1 &&
    n <= limit &&
    s.status === "active" &&
    remainingActions(s) > 0;
  return (
    <section className="town-topic" aria-label="补货">
      <h3>补货</h3>
      {sources.length > 1 && (
        <label className="town-field">
          供货渠道
          <select
            value={source}
            onChange={(e) => {
              setSelected(e.target.value as SupplySource);
              setQty("1");
            }}
          >
            {sources.map((value) => (
              <option key={value} value={value}>
                {SOURCE_NAMES[value]}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="town-item">
        <Potion color={PRODUCTS[id].color} />
        {source === "spot" ? (
          <strong>{PRODUCTS[id].name}</strong>
        ) : (
          <label className="town-field">
            药品
            <select
              value={id}
              onChange={(e) => {
                setProduct(e.target.value as ProductId);
                setQty("1");
              }}
            >
              {goods.map((value) => (
                <option key={value} value={value}>
                  {PRODUCTS[value].name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p>
        每瓶 {quote.price} G · 今日剩 {quote.remaining} 瓶 · 空仓 {capacity} 格
      </p>
      {source === "reserve" && <p>第{quote.due}天到货，在途药品也占仓位。</p>}
      {source === "spot" && id === "healing" && (
        <p>第{quote.batchDay + 6}天打烊后过期。</p>
      )}
      {source === "black" && isIllegal(s, id) && (
        <p>管制品会增加执法风险，并降低王国声望。</p>
      )}
      <div className="town-buttons">
        <label className="town-field">
          数量
          <input
            aria-label="镇区采购数量"
            type="number"
            inputMode="numeric"
            min={1}
            max={Math.max(1, limit)}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </label>
        <button
          className="primary"
          aria-label={`镇区采购${PRODUCTS[id].name}`}
          disabled={!canBuy}
          onClick={() => {
            if (dispatch({ type: "town-buy", source, product: id, qty: n }))
              setQty("1");
          }}
        >
          {source === "reserve" ? "预订" : "购入"} ·{" "}
          {Number.isSafeInteger(n) && n > 0 ? n * quote.price : 0} G · 1行动
        </button>
      </div>
      {remainingActions(s) === 0 && <p>今天的行动点已用完。</p>}
      {limit < 1 && <p>请检查渠道余量、仓位和现金。</p>}
    </section>
  );
}

function TownContract({
  s,
  dispatch,
  c,
}: Pick<UIProps, "s" | "dispatch"> & { c: Contract }) {
  const active = c.status === "active";
  const actions = remainingActions(s);
  return (
    <article className="town-contract">
      <h4>
        {c.title} · {active ? "在办" : "新委托"}
      </h4>
      {c.key && <p>{contractWords(c)}</p>}
      <ul>
        {c.lines.map(({ product, qty }) => (
          <li key={product}>
            {PRODUCTS[product].name} {qty}瓶
            {active && `（可交 ${usable(s, product, c.id)}瓶）`}
          </li>
        ))}
      </ul>
      <p>
        第{c.deadline}天打烊前交货 · 报酬 {c.reward} G
      </p>
      {c.lines.some((line) => isIllegal(s, line.product)) && (
        <p>交付管制品会增加执法风险。</p>
      )}
      <p>接单后取消关系 −4，逾期 −8。</p>
      {active && (
        <p>
          {c.reserve
            ? "留货中，预留药品不参加夜间零售。"
            : "已开放零售，请留意交货数量。"}
        </p>
      )}
      <div className="town-buttons">
        {active && (
          <button
            className="secondary"
            aria-label="切换委托预留"
            aria-pressed={c.reserve}
            onClick={() =>
              dispatch({
                type: "reserve-contract",
                id: c.id,
                reserve: !c.reserve,
              })
            }
          >
            {c.reserve ? "开放零售" : "留货给委托"}
          </button>
        )}
        <button
          className="secondary"
          aria-label={active ? "取消跨日委托" : "谢绝跨日委托"}
          onClick={() =>
            dispatch({
              type: "contract",
              id: c.id,
              choice: active ? "cancel" : "decline",
            })
          }
        >
          {active ? "取消委托" : "谢绝"}
        </button>
        <button
          className="primary"
          aria-label={active ? "交付跨日委托" : "接受跨日委托"}
          disabled={
            active
              ? actions < 2 ||
                c.lines.some((line) => usable(s, line.product, c.id) < line.qty)
              : actions < 1 ||
                activeContracts(s).length >= 2 ||
                activeContracts(s).some((x) => x.faction === c.faction)
          }
          onClick={() =>
            dispatch({
              type: "contract",
              id: c.id,
              choice: active ? "deliver" : "accept",
            })
          }
        >
          {active ? "交货 · 2行动" : "接下 · 1行动"}
        </button>
      </div>
    </article>
  );
}

export function TownWindow({
  s,
  dispatch,
  onClose,
  notice,
  faction,
}: UIProps & { faction: Faction }) {
  const contact = CONTACTS[faction];
  const rank = relationRank(s, faction);
  const active = activeContracts(s).filter((c) => c.faction === faction);
  const offers = s.town.offers.filter(
    (c) => c.faction === faction && c.status === "offered",
  );
  const history = s.town.contracts.filter(
    (c) => c.faction === faction && c.status !== "active",
  );
  const outlook = townOutlook(s);
  const known = !!outlook && s.town.knownForecast === outlook.start;
  const actions = remainingActions(s);
  const channels = CHANNELS[faction];
  const open = channels.filter(
    (source) => !townQuote(s, source, spotProduct(s)).blocked,
  );

  return (
    <Window
      label={contact.place}
      title={`${contact.name} · ${contact.place}`}
      onClose={onClose}
      notice={notice}
      kind="town-window town-conversation"
      header={
        <span className="header-money">
          {s.cash} G · 行动{actions}/8
        </span>
      }
      hint={`声望 ${s.reputation[faction]} · 详细权益见店内荣誉榜`}
    >
      <p className="town-greeting">
        “{GREETINGS[faction]}”{" "}
        <span data-testid="relation-rank">{RANK_NAMES[rank]}</span>
      </p>
      <div className="town-topics">
        {!!active.length && (
          <section className="town-topic town-active">
            <h3>在办委托</h3>
            {active.map((c) => (
              <TownContract key={c.id} s={s} dispatch={dispatch} c={c} />
            ))}
          </section>
        )}
        {!!open.length && (
          <TownSupply s={s} dispatch={dispatch} sources={open} />
        )}
        {(faction === "black" || (faction === "guild" && outlook)) && (
          <section className="town-topic">
            <h3>街坊消息</h3>
            <p>{outlook?.clue ?? "今天没听到新的风声。"}</p>
            {outlook && (known || s.day >= outlook.start) && (
              <p>{outlook.detail}</p>
            )}
            {faction === "black" &&
              outlook &&
              !known &&
              outlook.start > s.day &&
              (rank >= 2 ? (
                <button
                  className="primary"
                  aria-label="确认可靠情报"
                  disabled={s.cash < 5 || actions < 1}
                  onClick={() => dispatch({ type: "intel" })}
                >
                  打听详情 · 5 G · 1行动
                </button>
              ) : (
                <p>建立「合作」后，可以向我打听详情。</p>
              ))}
          </section>
        )}
        <section className="town-topic">
          <h3>新委托</h3>
          {offers.length ? (
            offers.map((c) => (
              <TownContract key={c.id} s={s} dispatch={dispatch} c={c} />
            ))
          ) : (
            <p>
              {s.day < 3
                ? "先熟悉镇上。第3天起，我会带来需要提前备药的委托。"
                : "今天没有新的邀约。"}
            </p>
          )}
        </section>
        {faction === "kingdom" && !!s.town.deliveries.length && (
          <section className="town-topic">
            <h3>在途药品</h3>
            <ul>
              {s.town.deliveries.map((d) => (
                <li key={d.id}>
                  {PRODUCTS[d.product].name} {d.qty}瓶 ·{" "}
                  <span>第{d.due}天到货</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <p className="town-next">{nextRelation(s, faction)}</p>
      {!!history.length && (
        <details className="town-history">
          <summary>过往委托</summary>
          <ul>
            {history
              .slice()
              .reverse()
              .map((c) => (
                <li key={c.id}>
                  {c.title} ·{" "}
                  {
                    {
                      fulfilled: "已交付",
                      failed: "已逾期",
                      cancelled: "已取消",
                      declined: "已谢绝",
                      offered: "新邀约",
                      active: "在办",
                    }[c.status]
                  }
                </li>
              ))}
          </ul>
        </details>
      )}
    </Window>
  );
}
