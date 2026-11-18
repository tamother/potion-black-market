import { useEffect, useRef, useState } from "react";
import type { GameState } from "../engine/types";
import { remainingActions } from "../engine/actions";
import { TOWN_STATIONS, WIDTH, HEIGHT, type StationId } from "./model";
import { useMovement } from "./useMovement";
import { Joystick } from "./Joystick";
import { Sprite } from "./Sprite";
import { ControlHint, useControlGuide } from "./ControlHint";
const PEOPLE = [
  { x: 230, y: 250, person: 0 },
  { x: 530, y: 198, person: 1 },
  { x: 810, y: 320, person: 2 },
];
export function TownScene({
  s,
  paused,
  onInteract,
  onSettings,
  onReturn,
  saved,
  muted,
  onMute,
}: {
  s: GameState;
  paused: boolean;
  onInteract: (id: StationId) => boolean | void;
  onSettings: () => void;
  onReturn: () => void;
  saved: boolean;
  muted: boolean;
  onMute: () => void;
}) {
  const viewport = useRef<HTMLDivElement>(null),
    [scale, setScale] = useState(1);
  const controls = useControlGuide();
  const movement = useMovement(
    s.seed,
    paused,
    TOWN_STATIONS,
    (id) => {
      if (onInteract(id) !== false) controls.interacted();
    },
    "town",
  );
  useEffect(() => {
    if (movement.moving) controls.moved();
  }, [movement.moving, controls.moved]);
  useEffect(() => {
    const observer = new ResizeObserver(([e]) =>
      setScale(
        Math.min(e.contentRect.width / WIDTH, e.contentRect.height / HEIGHT),
      ),
    );
    observer.observe(viewport.current!);
    return () => observer.disconnect();
  }, []);
  return (
    <main className="world-game town-game" aria-label="月隐镇">
      <div className="game-viewport" ref={viewport}>
        <div
          className="room-frame"
          style={{ width: WIDTH * scale, height: HEIGHT * scale }}
        >
          <div
            className="room-world town-world"
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
              className="town-art"
              src="/world/town.webp"
              alt="月隐镇石板广场，镇集市、公会与旧巷环绕月亮喷泉，南边通往魔药店"
              draggable={false}
            />
            {PEOPLE.map((p, i) => (
              <div
                key={i}
                className="world-actor"
                style={{ left: p.x, top: p.y, zIndex: p.y }}
              >
                <span className="actor-shadow" />
                <Sprite kind="npc" person={p.person} />
              </div>
            ))}
            {TOWN_STATIONS.map((st) => (
              <button
                key={st.id}
                data-testid={`station-${st.id}`}
                className={`station show-label ${movement.near?.id === st.id ? "near" : ""}`}
                style={{ left: st.anchor.x, top: st.anchor.y }}
                aria-label={`前往${st.label}`}
                disabled={paused}
                onClick={(e) => {
                  e.stopPropagation();
                  movement.go(st.approach, st.id);
                }}
              >
                <span className="station-label">{st.label}</span>
                <span className="station-ring" />
              </button>
            ))}
            <div
              className="world-actor player-actor"
              data-testid="player"
              data-x={Math.round(movement.position.x)}
              data-y={Math.round(movement.position.y)}
              style={{
                left: movement.position.x,
                top: movement.position.y,
                zIndex: Math.round(movement.position.y),
              }}
            >
              <span className="actor-shadow" />
              <Sprite
                facing={movement.position.facing}
                frame={movement.frame}
                walking={movement.moving}
              />
            </div>
            {!paused && movement.near && (
              <div
                className="near-prompt"
                style={{
                  left: movement.position.x,
                  top: movement.position.y + 13,
                  zIndex: 600,
                }}
              >
                <kbd>{controls.touch ? "交谈" : "E"}</kbd>
                {movement.near.hint}
              </div>
            )}
          </div>
        </div>
      </div>
      <header className="world-hud">
        <div className="hud-day">
          <span className="hud-moon">☾</span>
          <div>
            月隐镇<small>第{s.day}天 · 开业前</small>
          </div>
        </div>
        <div className="hud-tools">
          <div className="hud-actions" aria-label="今日行动力">
            <span>行动</span>
            <strong>{remainingActions(s)} / 8</strong>
          </div>
          <div className="hud-cash">
            <span>◈</span>
            <strong data-testid="cash">{s.cash} G</strong>
          </div>
          <button aria-label="声音开关" aria-pressed={!muted} onClick={onMute}>
            {muted ? "静" : "音"}
          </button>
          <button aria-label="设置" onClick={onSettings}>
            ⚙
          </button>
        </div>
      </header>
      {!paused && (
        <>
          <Joystick disabled={paused} onMove={movement.setStick} />
          <button
            className="interact-control touch-control"
            disabled={!movement.near}
            onClick={movement.interact}
            aria-label={movement.near ? `交互：${movement.near.label}` : "交互"}
          >
            <b>交谈</b>
          </button>
          <button
            className="town-return secondary"
            aria-label="快捷返回魔药店"
            onClick={onReturn}
          >
            回店
          </button>
          <ControlHint text={controls.text} />
        </>
      )}
      <span className="room-save">{saved ? "✓ 已保存" : "进度未保存"}</span>
    </main>
  );
}
