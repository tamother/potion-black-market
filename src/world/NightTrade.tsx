import { useEffect, useMemo, useRef, useState } from "react";
import { Sprite } from "./Sprite";
import { PRODUCTS } from "../engine/config";
import {
  guestStart,
  GUEST_SALE,
  GUEST_EXIT,
  nightBaskets,
  nightDuration,
  type NightSession,
} from "./night";
import { SERVICE_ENTRY as entry, type Point } from "./model";
function along(t: number, points: Point[]): Point {
  const lengths = points
    .slice(1)
    .map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  let distance =
    Math.max(0, Math.min(1, t)) * lengths.reduce((n, v) => n + v, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i])
      return {
        x:
          points[i].x +
          ((points[i + 1].x - points[i].x) * distance) / lengths[i],
        y:
          points[i].y +
          ((points[i + 1].y - points[i].y) * distance) / lengths[i],
      };
    distance -= lengths[i];
  }
  return points.at(-1)!;
}
export function NightTrade({
  session,
  onDone,
}: {
  session: NightSession;
  onDone: () => void;
}) {
  const baskets = useMemo(() => nightBaskets(session.row), [session.row]),
    duration = nightDuration(baskets.length),
    [elapsed, setElapsed] = useState(0),
    [speed, setSpeed] = useState(2),
    [scale, setScale] = useState(() =>
      Math.min(innerWidth / 960, innerHeight / 540),
    ),
    clock = useRef(0),
    speedRef = useRef(speed),
    done = useRef(onDone);
  speedRef.current = speed;
  done.current = onDone;
  useEffect(() => {
    let raf = 0,
      last = 0;
    const tick = (now: number) => {
      const dt = last && !document.hidden ? Math.min(100, now - last) : 0;
      last = now;
      clock.current = Math.min(duration, clock.current + dt * speedRef.current);
      setElapsed(clock.current);
      if (clock.current >= duration) {
        done.current();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    const resize = () =>
      setScale(Math.min(innerWidth / 960, innerHeight / 540));
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [duration]);
  const completed = baskets.filter(
      (_, i) => elapsed >= guestStart(i) + GUEST_SALE,
    ),
    revenue = completed.reduce((n, b) => n + b.revenue, 0),
    total = session.row.revenue - session.row.orderRevenue,
    loss = session.row.incidentCashCost ?? 0,
    cash = session.before.cash - loss + revenue;
  return (
    <section
      className="night-overlay"
      aria-label="夜市营业"
      data-testid="night-trade"
    >
      <div className="night-shade" />
      <div
        className="night-stage"
        style={{ transform: `translate(-50%,-50%) scale(${scale})` }}
        aria-hidden="true"
      >
        {baskets.map((basket, i) => {
          const age = elapsed - guestStart(i);
          if (age < 0 || age > GUEST_EXIT) return null;
          const outbound = age > GUEST_SALE + 300,
            p = outbound
              ? along(
                  (age - GUEST_SALE - 300) / (GUEST_EXIT - GUEST_SALE - 300),
                  entry.slice().reverse(),
                )
              : along(age / GUEST_SALE, entry),
            moving = age < GUEST_SALE || outbound;
          return (
            <div
              key={i}
              className="world-actor night-customer"
              data-testid="night-customer"
              style={{
                left: p.x + (i % 2 ? 9 : -9),
                top: p.y,
                zIndex: Math.round(p.y),
              }}
            >
              <span className="actor-shadow" />
              <Sprite
                kind="npc"
                person={basket.person}
                facing={outbound ? "down" : "up"}
                walking={moving}
              />
              {age >= GUEST_SALE && age < GUEST_SALE + 1200 && (
                <span
                  className="coin-receipt"
                  data-testid="coin-receipt"
                  style={{
                    transform: `translate(-50%,${-(age - GUEST_SALE) / 24}px)`,
                  }}
                >
                  +{basket.revenue} G
                </span>
              )}
            </div>
          );
        })}
      </div>
      <header className="night-header">
        <div>
          <small>第{session.row.day}天 · 月隐巷</small>
          <h2>夜市营业中</h2>
        </div>
        <div className="night-gold" aria-live="off">
          <span>◈</span> <strong data-testid="night-cash">{cash} G</strong>
          <small>
            零售收款 +{revenue} / {total} G
          </small>
        </div>
      </header>
      <footer className="night-controls">
        <div className="night-summary" role="status">
          <strong>
            {baskets.length
              ? `来客 ${completed.length} / ${baskets.length} 位 · 售出 ${completed.reduce((n, b) => n + b.items.length, 0)} / ${baskets.reduce((n, b) => n + b.items.length, 0)} 瓶`
              : "今夜无人购药，守着灯等到打烊。"}
          </strong>
          <small>
            {completed.length
              ? `刚售出：${completed
                  .at(-1)!
                  .items.map((item) => PRODUCTS[item.product].name)
                  .join("、")}`
              : "准备好零钱，第一位买家就要进门了。"}
          </small>
          <span>委托已提前收款；费用、损失与剩余现金在打烊收据归账。</span>
        </div>
        <div className="night-buttons">
          {[2, 4].map((n) => (
            <button
              key={n}
              className={`secondary ${speed === n ? "selected" : ""}`}
              aria-label={`营业速度${n}倍`}
              aria-pressed={speed === n}
              onClick={() => setSpeed(n)}
            >
              {n}×
            </button>
          ))}
          <button
            className="primary"
            aria-label="跳至营业收据"
            onClick={onDone}
          >
            查看收据 ›
          </button>
        </div>
      </footer>
    </section>
  );
}
