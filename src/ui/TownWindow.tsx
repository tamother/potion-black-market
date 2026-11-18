import { useState } from "react";
import type { Faction, ProductId, GameState } from "../engine/types";
import { IDS } from "../engine/types";
import type { SupplySource } from "../engine/townTypes";
import { PRODUCTS } from "../engine/config";
import { CONTACTS, relationRank } from "../engine/relations";
import {
  townQuote,
  spotProduct,
  freeCapacity,
  activeContracts,
} from "../engine/town";
import { townOutlook } from "../engine/forecasts";
import { remainingActions } from "../engine/actions";
import { isIllegal } from "../engine/economy";
import { Potion } from "../components/Potion";
import { Window, Tabs, Pager, type UIProps } from "./Window";
import { RelationsView } from "./RelationsView";
import { ContractView } from "./ContractView";
const SOURCE_LABELS = {
  spot: "散货",
  reserve: "预订",
  official: "正规",
  black: "货源",
};
export function TownWindow({
  s,
  dispatch,
  onClose,
  notice,
  faction: f,
}: { faction: Faction } & UIProps) {
  const first = f === "kingdom" ? "spot" : f === "black" ? "black" : "offers",
    [tab, setTab] = useState(first),
    [page, setPage] = useState(0),
    [qty, setQty] = useState("1"),
    source = (
      ["spot", "reserve", "official", "black"].includes(tab) ? tab : null
    ) as SupplySource | null,
    goods =
      source === "spot"
        ? [spotProduct(s)]
        : source === "official"
          ? IDS.filter((id) => !isIllegal(s, id))
          : IDS,
    product = goods[Math.min(page, goods.length - 1)] ?? "healing",
    q = source ? townQuote(s, source, product) : null,
    n = Number(qty),
    list =
      tab === "offers"
        ? s.town.offers.filter((c) => c.faction === f)
        : s.town.contracts
            .filter((c) => c.faction === f)
            .slice()
            .reverse(),
    c = list[Math.min(Math.floor(page / 3), Math.max(0, list.length - 1))],
    outlook = townOutlook(s),
    contact = CONTACTS[f],
    deliveries = s.town.deliveries,
    index = Math.min(page, Math.max(0, deliveries.length - 1));
  const tabs =
    f === "kingdom"
      ? [
          { id: "spot", label: "散货" },
          { id: "reserve", label: "预订" },
          { id: "official", label: "正规" },
          { id: "offers", label: "委托" },
          { id: "active", label: "在办" },
          { id: "deliveries", label: "到货" },
          { id: "relation", label: "关系" },
        ]
      : f === "guild"
        ? [
            { id: "offers", label: "委托" },
            { id: "active", label: "在办" },
            { id: "relation", label: "关系" },
            { id: "outlook", label: "风声" },
          ]
        : [
            { id: "black", label: "货源" },
            { id: "offers", label: "委托" },
            { id: "active", label: "在办" },
            { id: "intel", label: "情报" },
            { id: "relation", label: "关系" },
          ];
  const purchase =
    source && q
      ? Number.isSafeInteger(n) &&
        n > 0 &&
        !q.blocked &&
        n <= q.remaining &&
        n <= freeCapacity(s) &&
        n * q.price <= s.cash &&
        s.status === "active" &&
        remainingActions(s) > 0
      : false;
  const count = source
    ? goods.length
    : tab === "relation"
      ? 3
      : tab === "deliveries"
        ? deliveries.length
        : tab === "offers" || tab === "active"
          ? list.length * 3
          : 1;
  let hint = "走路与查阅免费，接受1行动，交付2行动。";
  if (source && q)
    hint =
      q.blocked ||
      (source === "reserve"
        ? "次日新鲜到货；在途也占仓位。"
        : source === "spot" && product === "healing"
          ? `这批散货第${q.batchDay + 6}天末过期，请量力采购。`
          : source === "black" && isIllegal(s, product)
            ? "管制品每瓶增加3风险、王国-1；出售还会增加风险。"
            : "每笔采购1行动，渠道按日限量。");
  if (tab === "relation")
    hint = ["当前关系", "已经开放的权益", "下一步合作线索"][Math.min(page, 2)];
  return (
    <Window
      label={contact.place}
      title={`${contact.name} · ${contact.place}`}
      onClose={onClose}
      notice={notice}
      kind="town-window"
      header={
        <span className="header-money">
          {s.cash} G · 行动{remainingActions(s)}/8
        </span>
      }
      tabs={
        <Tabs
          tabs={tabs}
          value={tab}
          onChange={(v) => {
            setTab(v);
            setPage(0);
            setQty("1");
          }}
        />
      }
      hint={hint}
      footer={
        <>
          {count > 1 && (
            <Pager
              page={
                source || tab === "relation" || tab === "deliveries"
                  ? page
                  : Math.min(page, count - 1)
              }
              count={count}
              onChange={(v) => {
                setPage(v);
                setQty("1");
              }}
            />
          )}
          {source && q && (
            <>
              <span className="purchase-total">
                {Math.max(0, Number.isSafeInteger(n) ? n * q.price : 0)} G
              </span>
              <button
                className="primary"
                aria-label={`镇区采购${PRODUCTS[product].name}`}
                disabled={!purchase}
                onClick={() => {
                  if (dispatch({ type: "town-buy", source, product, qty: n }))
                    setQty("1");
                }}
              >
                {source === "reserve" ? "预订" : "购入"} · 1行动
              </button>
            </>
          )}
          {c && tab === "offers" && c.status === "offered" && (
            <>
              <button
                className="secondary"
                aria-label="谢绝跨日委托"
                onClick={() =>
                  dispatch({ type: "contract", id: c.id, choice: "decline" })
                }
              >
                谢绝
              </button>
              <button
                className="primary"
                aria-label="接受跨日委托"
                disabled={
                  remainingActions(s) < 1 ||
                  activeContracts(s).length >= 2 ||
                  activeContracts(s).some((x) => x.faction === f)
                }
                onClick={() =>
                  dispatch({ type: "contract", id: c.id, choice: "accept" })
                }
              >
                接下 · 1行动
              </button>
            </>
          )}
          {c && tab === "active" && c.status === "active" && (
            <>
              <button
                className="secondary"
                aria-label="取消跨日委托"
                onClick={() =>
                  dispatch({ type: "contract", id: c.id, choice: "cancel" })
                }
              >
                取消
              </button>
              <button
                className="primary"
                aria-label="交付跨日委托"
                disabled={remainingActions(s) < 2}
                onClick={() =>
                  dispatch({ type: "contract", id: c.id, choice: "deliver" })
                }
              >
                交货 · 2行动
              </button>
            </>
          )}
          {tab === "intel" && (
            <button
              className="primary"
              aria-label="确认可靠情报"
              disabled={
                relationRank(s, "black") < 2 ||
                s.town.knownForecast === outlook?.start ||
                !outlook ||
                outlook.start <= s.day ||
                s.cash < 5 ||
                remainingActions(s) < 1
              }
              onClick={() => dispatch({ type: "intel" })}
            >
              {s.town.knownForecast === outlook?.start
                ? "已确认"
                : "确认 · 5G / 1行动"}
            </button>
          )}
        </>
      }
    >
      {source && q ? (
        q.blocked ? (
          <div className="window-empty">
            <h3>这条渠道还没有开放</h3>
            <p>{q.blocked}</p>
            <p>认识联系人、兑现约定后，荣誉榜会记录新的合作。</p>
          </div>
        ) : (
          <div className="trade-layout town-trade">
            <div className="item-illustration">
              <Potion color={PRODUCTS[product].color} />
              <h3>{PRODUCTS[product].name}</h3>
              <p>
                {SOURCE_LABELS[source]}
                {source === "reserve" ? ` · 第${q.due}天到货` : ""}
              </p>
            </div>
            <div className="trade-fields">
              <div className="trade-summary">
                <div>
                  <span>每瓶</span>
                  <strong>{q.price} G</strong>
                </div>
                <div>
                  <span>渠道余供</span>
                  <strong>{q.remaining}瓶</strong>
                </div>
                <div>
                  <span>空闲仓位</span>
                  <strong>{freeCapacity(s)}格</strong>
                </div>
              </div>
              <div className="trade-input-row">
                <label htmlFor="town-qty">采购数量</label>
                <div className="quantity-picker">
                  <button
                    className="secondary"
                    aria-label="减少镇区采购数量"
                    disabled={n <= 1}
                    onClick={() => setQty(String(Math.max(1, (n || 1) - 1)))}
                  >
                    −
                  </button>
                  <input
                    id="town-qty"
                    aria-label="镇区采购数量"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={q.remaining}
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                  <button
                    className="secondary"
                    aria-label="增加镇区采购数量"
                    disabled={n >= q.remaining}
                    onClick={() =>
                      setQty(String(Math.min(q.remaining, (n || 0) + 1)))
                    }
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      ) : tab === "relation" ? (
        <RelationsView s={s} f={f} page={Math.min(page, 2)} />
      ) : tab === "offers" || tab === "active" ? (
        c ? (
          <ContractView s={s} c={c} page={page} dispatch={dispatch} />
        ) : (
          <div className="window-empty">
            <h3>{s.day < 3 ? "先熟悉这条街" : "暂时没有在办约定"}</h3>
            <p>
              {s.day < 3
                ? "第3天起，联系人会带来需要提前准备的委托。"
                : "你可以看看新的委托，或者为今晚的零售备货。"}
            </p>
          </div>
        )
      ) : tab === "deliveries" ? (
        deliveries[index] ? (
          <div className="delivery-card">
            <Potion color={PRODUCTS[deliveries[index].product].color} />
            <article>
              <h3>
                {PRODUCTS[deliveries[index].product].name} ·{" "}
                {deliveries[index].qty}瓶
              </h3>
              <p>第{deliveries[index].due}天到货</p>
              <p>
                已支付{deliveries[index].cost * deliveries[index].qty}{" "}
                G，仓位已经预留。
              </p>
              <p>到货后形成新鲜批次；刷新不会重复发货。</p>
            </article>
          </div>
        ) : (
          <div className="window-empty">
            <h3>暂时没有在途药品</h3>
            <p>预订的药品会在这里留下交期记录。</p>
          </div>
        )
      ) : (
        <article className="town-outlook">
          <h3>
            {outlook
              ? s.day >= outlook.start
                ? "镇上的变化"
                : "巷口的风声"
              : "街坊还在打量这位新店主"}
          </h3>
          <p>{outlook?.clue ?? "先认识集市、公会和旧巷的联系人。"}</p>
          <p>
            {outlook &&
            (s.town.knownForecast === outlook?.start || s.day >= outlook.start)
              ? outlook.detail
              : "消息不代表一定赚钱；备货、留现金或继续观望，都由你决定。"}
          </p>
          {tab === "intel" && relationRank(s, "black") < 2 && (
            <small>与阿缇建立「合作」后，可付费确认消息细节。</small>
          )}
        </article>
      )}
    </Window>
  );
}
