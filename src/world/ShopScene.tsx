import { remainingActions } from "../engine/actions";
import { RULES } from "../engine/config";
import { useEffect, useRef, useState } from "react";
import type { GameState } from "../engine/types";
import {
  STATIONS,
  SERVICE_VISITOR,
  SERVICE_STAFF,
  distance,
  WIDTH,
  HEIGHT,
  type Station,
  type StationId,
} from "./model";
import { useMovement } from "./useMovement";
import { Sprite } from "./Sprite";
import { Joystick } from "./Joystick";
import { OwlSprite } from "./Owl";
import { merchantAvailable } from "../engine/hazards";
import { visitorFor } from "./visitors";
import { ControlHint, useControlGuide } from "./ControlHint";
export function ShopScene({
  s,
  paused,
  briefing = false,
  night = false,
  onInteract,
  onSettings,
  saved,
  muted,
  onMute,
}: {
  s: GameState;
  paused: boolean;
  briefing?: boolean;
  night?: boolean;
  onInteract: (id: StationId) => boolean | void;
  onSettings: () => void;
  saved: boolean;
  muted: boolean;
  onMute: () => void;
}) {
  const viewport = useRef<HTMLDivElement>(null),
    [scale, setScale] = useState(1);
  const [guest, setGuest] = useState({ y: 488, phase: "entering" });
  const visitor = visitorFor(s),
    allDone = s.orders.length > 0 && s.orders.every((o) => o.status !== "open");
  const doneRef = useRef(allDone),
    pausedRef = useRef(paused);
  doneRef.current = allDone;
  pausedRef.current = paused;
  useEffect(() => {
    const el = viewport.current!;
    const observer = new ResizeObserver(([entry]) =>
      setScale(
        Math.min(
          entry.contentRect.width / WIDTH,
          entry.contentRect.height / HEIGHT,
        ),
      ),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let y = allDone ? 495 : 488,
      phase = allDone ? "gone" : "entering",
      last = 0,
      raf = 0;
    setGuest({ y, phase });
    const tick = (time: number) => {
      const dt = last ? Math.min(0.05, (time - last) / 1000) : 0;
      last = time;
      if (!pausedRef.current) {
        if (doneRef.current && phase !== "gone") phase = "leaving";
        if (phase === "entering") {
          y = Math.max(SERVICE_VISITOR.y, y - dt * 90);
          if (y === SERVICE_VISITOR.y) phase = "waiting";
        } else if (phase === "leaving") {
          y = Math.min(495, y + dt * 105);
          if (y === 495) phase = "gone";
        }
        setGuest((previous) =>
          previous.y === y && previous.phase === phase
            ? previous
            : { y, phase },
        );
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [s.day, s.seed]);
  const stations: Station[] = [...STATIONS];
  if (guest.phase === "waiting" && !allDone)
    stations.push({
      id: "visitor",
      label: visitor.name,
      approach: { x: 480, y: 380 },
      anchor: { x: 480, y: 337 },
      radius: 58,
      hint: "与来客交谈",
    });
  if (s.accountantHiredDay !== null)
    stations.push({
      id: "accountant",
      label: "财务 · 埃德温",
      approach: { x: 690, y: 395 },
      anchor: { x: 696, y: 360 },
      radius: 52,
      hint: "请教今日账目",
    });
  if (merchantAvailable(s))
    stations.push({
      id: "merchant",
      label: "黑市商人",
      approach: { x: 450, y: 369 },
      anchor: { x: 413, y: 346 },
      radius: 48,
      hint: "询问水晶球",
    });
  if (s.crystalUnlockedDay !== null)
    stations.push({
      id: "crystal",
      label: "水晶球",
      approach: { x: 285, y: 365 },
      anchor: { x: 248, y: 356 },
      radius: 52,
      hint: "占卜与护店",
    });
  const controls = useControlGuide();
  const movement = useMovement(s.seed, paused, stations, (id) => {
    if (onInteract(id) !== false) controls.interacted();
  });
  useEffect(() => {
    if (movement.moving) controls.moved();
  }, [movement.moving, controls.moved]);
  const [guide, setGuide] = useState(true);
  const [portraitDismissed, setPortraitDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("potion-portrait-dismissed") === "1";
    } catch {
      return false;
    }
  });
  const [portrait, setPortrait] = useState(innerHeight > innerWidth);
  useEffect(() => {
    const resize = () => {
      const vertical = innerHeight > innerWidth;
      setPortrait(vertical);
      if (!vertical) setPortraitDismissed(false);
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  return (
    <main className="world-game" aria-label="月隐巷魔药店">
      <div
        className={`game-viewport ${night ? "night-room-active" : ""}`}
        ref={viewport}
      >
        <div
          className="room-frame"
          style={{ width: WIDTH * scale, height: HEIGHT * scale }}
        >
          <div
            className="room-world"
            style={{ transform: `scale(${scale})` }}
            onClick={(e) => {
              if (
                paused ||
                (e.target instanceof Element && e.target.closest("button"))
              )
                return;
              const r = e.currentTarget.getBoundingClientRect();
              movement.go({
                x: (e.clientX - r.left) / scale,
                y: (e.clientY - r.top) / scale,
              });
            }}
          >
            <img
              className="room-art"
              src={`${import.meta.env.BASE_URL}world/shop-honors.webp`}
              alt="月光照进木制魔药店，布告栏、仓库箱、药架、进货簿和账桌环绕着中央地毯"
              draggable={false}
            />
            {s.crystalUnlockedDay !== null && (
              <img
                className="crystal-environment"
                src={`${import.meta.env.BASE_URL}world/crystal-environment.webp`}
                alt=""
                aria-hidden="true"
                draggable={false}
              />
            )}
            <div className="room-life" aria-hidden="true">
              <i className="candle-glow g1" />
              <i className="candle-glow g2" />
              <i className="candle-glow g3" />
              <i className="magic-mote m1" />
              <i className="magic-mote m2" />
              <i className="magic-mote m3" />
            </div>
            <div className="world-owl">
              <OwlSprite />
            </div>
            {stations
              .filter(
                (st) => !["visitor", "accountant", "merchant"].includes(st.id),
              )
              .map((st) => (
                <button
                  key={st.id}
                  type="button"
                  className={`station ${guide ? "show-label" : ""} ${movement.near?.id === st.id ? "near" : ""}`}
                  style={{ left: st.anchor.x, top: st.anchor.y }}
                  aria-label={`前往${st.label}`}
                  data-testid={`station-${st.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    movement.go(st.approach, st.id);
                  }}
                  disabled={paused}
                >
                  <span className="station-label">{st.label}</span>
                  <span className="station-ring" />
                </button>
              ))}
            {merchantAvailable(s) && (
              <div
                className="world-actor merchant-actor"
                style={{ left: 413, top: 375, zIndex: 375 }}
                data-testid="merchant"
              >
                <span className="actor-shadow" />
                <Sprite kind="npc" person={2} />
                <button
                  className="clerk-marker"
                  aria-label="前往黑市商人"
                  disabled={paused}
                  onClick={(e) => {
                    e.stopPropagation();
                    movement.go({ x: 450, y: 369 }, "merchant");
                  }}
                >
                  黑市商人
                </button>
              </div>
            )}
            {!night && guest.phase !== "gone" && (
              <div
                className="world-actor visitor-actor"
                style={{ left: 480, top: guest.y, zIndex: Math.round(guest.y) }}
                data-testid="visitor"
                data-phase={guest.phase}
              >
                <span className="actor-shadow" />
                <Sprite
                  kind="npc"
                  person={visitor.sprite}
                  facing={guest.phase === "entering" ? "up" : "down"}
                  walking={guest.phase !== "waiting"}
                />
                {guest.phase === "waiting" && !allDone && (
                  <button
                    className="visitor-marker"
                    aria-label="前往来访者"
                    disabled={paused}
                    onClick={(e) => {
                      e.stopPropagation();
                      movement.go({ x: 480, y: 380 }, "visitor");
                    }}
                  >
                    <b>!</b>
                    <span>{visitor.name}</span>
                  </button>
                )}
              </div>
            )}
            {s.accountantHiredDay !== null && (
              <div
                className="world-actor accountant-actor"
                style={{ left: 696, top: 378, zIndex: 378 }}
                data-testid="accountant"
              >
                <span className="actor-shadow" />
                <Sprite kind="npc" person={3} />
                <button
                  className="clerk-marker"
                  aria-label="前往财务人员"
                  disabled={paused}
                  onClick={(e) => {
                    e.stopPropagation();
                    movement.go({ x: 690, y: 395 }, "accountant");
                  }}
                >
                  埃德温
                </button>
              </div>
            )}
            <div
              className="world-actor player-actor"
              style={{
                left: night ? SERVICE_STAFF.x : movement.position.x,
                top: night ? SERVICE_STAFF.y : movement.position.y,
                zIndex: night
                  ? SERVICE_STAFF.y
                  : Math.round(movement.position.y),
              }}
              data-testid="player"
              data-x={Math.round(movement.position.x)}
              data-y={Math.round(movement.position.y)}
              data-facing={movement.position.facing}
            >
              <span className="actor-shadow" />
              <Sprite
                facing={movement.position.facing}
                frame={movement.frame}
                walking={movement.moving}
              />
            </div>
            {movement.near && !paused && (
              <div
                className="near-prompt"
                style={{
                  left: movement.position.x,
                  top: movement.position.y + 13,
                  zIndex: 600,
                }}
              >
                <kbd>{controls.touch ? "交互" : "E"}</kbd>
                {movement.near.hint}
              </div>
            )}
          </div>
        </div>
      </div>
      <header className="world-hud" hidden={night}>
        <div className="hud-day">
          <span className="hud-moon">☾</span>
          <div>
            月隐巷
            <small>
              第 {s.day} 天 ·{" "}
              {s.phase === "report" ? "已打烊" : "白天 · 备货中"}
            </small>
          </div>
        </div>
        <div className="hud-tools">
          <button
            className="town-shortcut"
            aria-label="前往月隐镇"
            disabled={paused}
            onClick={() => onInteract("exit")}
          >
            镇
          </button>
          <div
            className={`hud-actions ${remainingActions(s) === 0 ? "empty" : ""}`}
            aria-label="今日行动力"
          >
            <span>行动</span>
            <strong>
              {remainingActions(s)} / {RULES.dailyActions}
            </strong>
          </div>
          <div className="hud-cash">
            <span aria-hidden="true">◈</span>
            <strong data-testid="cash">{s.cash} G</strong>
          </div>
          <button aria-label="声音开关" aria-pressed={!muted} onClick={onMute}>
            {muted ? "静" : "音"}
          </button>
          <button
            aria-label="操作指引"
            aria-pressed={guide}
            onClick={() => setGuide(!guide)}
          >
            ?
          </button>
          <button aria-label="设置" onClick={onSettings}>
            ⚙
          </button>
        </div>
      </header>
      {!paused && (
        <>
          {!briefing && (
            <div className="world-caption" role="status">
              {guest.phase === "entering"
                ? "门铃轻响，一位客人走了进来。"
                : guest.phase === "waiting"
                  ? "柜台前有位客人在等你。"
                  : "烛火正暖，慢慢打理今天的生意。"}
            </div>
          )}
          <Joystick disabled={paused} onMove={movement.setStick} />
          <button
            className="interact-control touch-control"
            disabled={!movement.near}
            onClick={movement.interact}
            aria-label={movement.near ? `交互：${movement.near.label}` : "交互"}
          >
            <svg
              aria-hidden="true"
              width="29"
              height="29"
              viewBox="0 0 20 20"
              shapeRendering="crispEdges"
            >
              <g fill="currentColor">
                <rect x="6" y="2" width="2" height="10" />
                <rect x="9" y="3" width="2" height="9" />
                <rect x="12" y="5" width="2" height="8" />
                <rect x="15" y="7" width="2" height="7" />
                <rect x="4" y="11" width="12" height="5" />
                <rect x="2" y="9" width="2" height="4" />
                <rect x="6" y="16" width="8" height="2" />
              </g>
            </svg>
            <b>交互</b>
          </button>
          {guide && !night && <ControlHint text={controls.text} />}
        </>
      )}
      <span className="room-save">{saved ? "✓ 已保存" : "进度未保存"}</span>
      {portrait && !portraitDismissed && !paused && !briefing && (
        <aside
          className="orientation-notice"
          role="dialog"
          aria-label="横屏提示"
        >
          <div>
            <span>↻</span>
            <h2>把手机横过来吧</h2>
            <p>让小店和行走操作有更舒展的空间。</p>
            <button
              className="secondary"
              onClick={() => {
                setPortraitDismissed(true);
                try {
                  sessionStorage.setItem("potion-portrait-dismissed", "1");
                } catch {}
              }}
            >
              先这样看看
            </button>
          </div>
        </aside>
      )}
    </main>
  );
}
