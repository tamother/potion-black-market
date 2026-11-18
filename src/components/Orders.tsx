import type { GameState, Action } from "../engine/types";
import { PRODUCTS } from "../engine/config";
import { available } from "../engine/inventory";
import { ORDER_WORDS, visitorFor } from "../world/visitors";
import { Sprite } from "../world/Sprite";
import { money } from "./Shared";
export function Orders({
  s,
  dispatch,
  onPrepare,
}: {
  s: GameState;
  dispatch: (a: Action) => boolean;
  onPrepare?: () => void;
}) {
  const visitor = visitorFor(s);
  return (
    <section className="visitor-conversation">
      <div className="conversation-opening">
        <div className="portrait-frame">
          <Sprite kind="npc" person={visitor.sprite} />
        </div>
        <div>
          <p className="speaker-role">{visitor.role}</p>
          <h2>{visitor.name}</h2>
          <p>“{visitor.greeting}”</p>
        </div>
      </div>
      {!s.orders.length ? (
        <p>“今天路过，进来歇歇脚。祝你生意顺利。”</p>
      ) : (
        s.orders.map((o) => (
          <article className="commission" key={o.id}>
            <h3>{o.title}</h3>
            <p className="commission-words">“{ORDER_WORDS[o.kind]}”</p>
            <div className="commission-request">
              <span>
                {PRODUCTS[o.product].name} × {o.qty}
              </span>
              <strong>报酬 {money(o.reward)}</strong>
            </div>
            {o.status === "open" ? (
              <>
                <p className="commission-stock">
                  现有 {available(s, o.product)} 瓶
                </p>
                <div className="commission-actions">
                  <button
                    className="secondary"
                    aria-label={`拒绝${o.title}`}
                    onClick={() =>
                      dispatch({ type: "order", id: o.id, accept: false })
                    }
                  >
                    这次不接
                  </button>
                  {available(s, o.product) < o.qty ? (
                    <button className="primary" onClick={onPrepare}>
                      先去备货
                    </button>
                  ) : (
                    <button
                      className="primary"
                      aria-label={`接受${o.title}`}
                      disabled={s.actions >= 2}
                      onClick={() =>
                        dispatch({ type: "order", id: o.id, accept: true })
                      }
                    >
                      交付药水
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="order-status">
                {o.status === "accepted"
                  ? "“收到了，谢谢。愿你的店灯长亮。”"
                  : "“明白了，下次有机会再谈。”"}
                <small>{o.status === "accepted" ? "已交付" : "已婉拒"}</small>
              </p>
            )}
          </article>
        ))
      )}
    </section>
  );
}
