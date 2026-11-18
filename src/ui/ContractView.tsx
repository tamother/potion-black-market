import { isIllegal } from "../engine/economy";
import type { GameState } from "../engine/types";
import type { Contract } from "../engine/townTypes";
import { PRODUCTS } from "../engine/config";
import { usable } from "../engine/town";
import { Potion } from "../components/Potion";
import type { Dispatch } from "./Window";
const STATUS = {
  offered: "新的邀约",
  active: "在办约定",
  fulfilled: "已交付",
  declined: "已谢绝",
  failed: "已逾期",
  cancelled: "已取消",
};
export function contractWords(c: Contract) {
  const words = {
    guild: [
      "远征队几日后出发。塞拉想把药箱提前备妥，免得临行时到处求药。",
      "上一趟的药箱帮上了忙。这次护送更远，她想再托付你一程。",
      "塞拉留了一张名单。上面不再写“临时卖家”，而是写着你的店名。",
    ],
    kingdom: [
      "米拉正在整理城门的公用药箱，想找愿意按约备货的店主。",
      "上次的交付被记在册上。药监官想看看这次能否继续按约送来。",
      "米拉翻开供货名册，认真问你愿不愿意长久往来。",
    ],
    black: [
      "阿缇没有急着谈价，只问你能否按时准备这份药箱。",
      "熟悉的蜡封又出现了。她记得上一回的交付，这次约定更慎重。",
      "阿缇把真正的名字写在信尾。有些门，只会向守信的人打开。",
    ],
  };
  return c.key
    ? words[c.faction][Math.min(2, c.step)]
    : "熟客提前留下了需要的药品。要不要把这几天的货留给这份约定，由你决定。";
}
export function ContractView({
  s,
  c,
  page = 0,
  dispatch,
}: {
  s: GameState;
  c: Contract;
  page?: number;
  dispatch?: Dispatch;
}) {
  return (
    <section className="promise-card">
      <div className="promise-top">
        <h3>{c.title}</h3>
        <span>
          {c.key ? "关键合作 · " : ""}
          {STATUS[c.status]}
        </span>
      </div>
      {page % 3 === 0 ? (
        <>
          <div className="promise-lines">
            {c.lines.map((l) => (
              <div key={l.product}>
                <Potion color={PRODUCTS[l.product].color} />
                <span>{PRODUCTS[l.product].name}</span>
                <strong>{l.qty}瓶</strong>
                {c.status === "active" && (
                  <small>可交{usable(s, l.product, c.id)}瓶</small>
                )}
              </div>
            ))}
          </div>
          <div className="promise-terms">
            <span>第{c.deadline}天打烊前交货</span>
            <strong>报酬 {c.reward} G</strong>
          </div>
          <p className="promise-penalty">
            {c.status === "fulfilled"
              ? "约定已完成，报酬已到账。"
              : "未接可谢绝；接下后取消关系-4，逾期-8。"}
          </p>
        </>
      ) : page % 3 === 1 ? (
        <article className="promise-story">
          <p>“{contractWords(c)}”</p>
          <p>
            {c.reserve
              ? "留货中的药品不参加夜间零售，过期与损失仍可能发生。"
              : "药品可以参加零售，请自己留意交货数量。"}
          </p>
        </article>
      ) : (
        <div className="promise-management">
          <p>留货不参加零售；也可开放零售，自行安排交货。</p>
          {c.lines.some((l) => isIllegal(s, l.product)) && (
            <p>涉及管制品，交付会增加执法风险。</p>
          )}{" "}
          {c.status === "active" && dispatch && (
            <button
              className="secondary reserve-toggle"
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
              {c.reserve ? "留货中" : "开放零售"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
