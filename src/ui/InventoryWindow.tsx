import { transitQuantity, reservedFor } from "../engine/town";
import { useState } from "react";
import type { Batch, GameState } from "../engine/types";
import { PRODUCTS } from "../engine/config";
import { quantity } from "../engine/inventory";
import { Potion } from "../components/Potion";
import { money } from "../components/Shared";
import { inventorySlots } from "./paging";
import { Window, Tabs, Pager } from "./Window";
export function InventoryWindow({
  s,
  onClose,
}: {
  s: GameState;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null),
    slots = inventorySlots(s),
    bottle = selected === null ? null : slots[selected];
  return (
    <>
      <Window
        label="仓库箱"
        title="仓库箱"
        subtitle={`已用 ${quantity(s)} / ${s.capacity} 格${transitQuantity(s) ? ` · 在途占${transitQuantity(s)}格` : ""}`}
        onClose={onClose}
        hint={
          transitQuantity(s)
            ? `另有${transitQuantity(s)}瓶在途，仓位已预留；镇集市可查交期。`
            : "点选药水，查看它的来处与保质期。"
        }
        kind="inventory-window"
      >
        <div className="inventory-grid" role="grid" aria-label="仓库格子">
          {slots.map((b, i) => (
            <div
              role="gridcell"
              key={i}
              className={`inventory-cell ${b ? "occupied" : ""}`}
            >
              {b ? (
                <button
                  type="button"
                  aria-label={`第 ${i + 1} 格：${PRODUCTS[b.product].name}`}
                  onClick={() => setSelected(i)}
                >
                  <Potion color={PRODUCTS[b.product].color} />
                </button>
              ) : (
                <span aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      </Window>
      {bottle && (
        <ItemDetails
          key={`${selected}-${bottle.id}`}
          s={s}
          batch={bottle}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
function ItemDetails({
  s,
  batch: b,
  onClose,
}: {
  s: GameState;
  batch: Batch;
  onClose: () => void;
}) {
  const [tab, setTab] = useState("item"),
    [page, setPage] = useState(0),
    product = PRODUCTS[b.product];
  const batches = s.batches
      .filter((lot) => lot.product === b.product)
      .slice()
      .sort((a, c) => a.day - c.day),
    count = Math.ceil(batches.length / 2),
    index = Math.min(page, Math.max(0, count - 1));
  const life =
    b.product === "healing"
      ? `第 ${(b.brewed ?? b.day) + 6} 天结束时过期`
      : "长期保存";
  return (
    <Window
      label="物品详情"
      title={product.name}
      onClose={onClose}
      tabs={
        <Tabs
          tabs={[
            { id: "item", label: "物品信息" },
            { id: "batches", label: "批次记录" },
          ]}
          value={tab}
          onChange={(v) => {
            setTab(v);
            setPage(0);
          }}
        />
      }
      hint={
        tab === "item"
          ? `记录所选药水；同类有${reservedFor(s, b.product)}瓶留作委托。`
          : "同类药水按先进先出使用。"
      }
      footer={
        <>
          {tab === "batches" && (
            <Pager page={index} count={count} onChange={setPage} />
          )}
          <button className="secondary" onClick={onClose}>
            返回仓库
          </button>
        </>
      }
    >
      {tab === "item" ? (
        <div className="item-overview">
          <div className="item-illustration">
            <Potion color={product.color} />
            <p>{product.note}</p>
          </div>
          <dl className="detail-grid">
            <div>
              <dt>这瓶的采购成本</dt>
              <dd>{money(b.cost)}</dd>
            </div>
            <div>
              <dt>同类库存</dt>
              <dd>{quantity(s, b.product)} 瓶</dd>
            </div>
            <div>
              <dt>采购日期</dt>
              <dd>第 {b.day} 天购入</dd>
            </div>
            <div>
              <dt>保质期</dt>
              <dd className="life-text">{life}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <table className="compact-table">
          <thead>
            <tr>
              <th>购入日</th>
              <th>数量</th>
              <th>单位成本</th>
              <th>保质期</th>
            </tr>
          </thead>
          <tbody>
            {batches.slice(index * 2, index * 2 + 2).map((lot) => (
              <tr key={lot.id}>
                <td>第 {lot.day} 天</td>
                <td>{lot.qty}</td>
                <td>{money(lot.cost)}</td>
                <td>
                  {b.product === "healing"
                    ? `第 ${(lot.brewed ?? lot.day) + 6} 天末`
                    : "长期"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Window>
  );
}
