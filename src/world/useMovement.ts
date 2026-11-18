import { useEffect, useRef, useState } from "react";
import {
  distance,
  findPath,
  step,
  type Position,
  type Point,
  type Station,
  type StationId,
  type Space,
} from "./model";
import { loadPosition, storePosition } from "./persistence";
export function useMovement(
  seed: number,
  paused: boolean,
  stations: Station[],
  onInteract: (id: StationId) => void,
  space: Space = "shop",
) {
  const [position, setPosition] = useState<Position>(() =>
    loadPosition(localStorage, seed, space),
  );
  const [moving, setMoving] = useState(false),
    [frame, setFrame] = useState(0);
  const p = useRef(position),
    keys = useRef(new Set<string>()),
    stick = useRef<Point>({ x: 0, y: 0 });
  const path = useRef<Point[]>([]),
    pending = useRef<StationId | null>(null),
    busy = useRef(paused);
  const options = useRef({ stations, onInteract });
  options.current = { stations, onInteract };
  busy.current = paused;
  const closest = () =>
    options.current.stations
      .filter((s) => distance(p.current, s.approach) <= s.radius)
      .sort(
        (a, b) =>
          distance(p.current, a.approach) - distance(p.current, b.approach),
      )[0];
  const interact = () => {
    if (busy.current) return;
    const s = closest();
    if (s) {
      path.current = [];
      pending.current = null;
      options.current.onInteract(s.id);
    }
  };
  const go = (target: Point, station?: StationId) => {
    if (busy.current) return;
    keys.current.clear();
    stick.current = { x: 0, y: 0 };
    path.current = findPath(p.current, target, space);
    pending.current = path.current.length ? (station ?? null) : null;
  };
  useEffect(() => {
    p.current = loadPosition(localStorage, seed, space);
    setPosition(p.current);
    keys.current.clear();
    path.current = [];
    pending.current = null;
    stick.current = { x: 0, y: 0 };
  }, [seed, space]);
  useEffect(() => {
    if (paused) {
      keys.current.clear();
      stick.current = { x: 0, y: 0 };
      path.current = [];
      pending.current = null;
      setMoving(false);
      setFrame(0);
    }
  }, [paused]);
  useEffect(() => {
    const clear = () => {
      keys.current.clear();
      stick.current = { x: 0, y: 0 };
      path.current = [];
      pending.current = null;
      storePosition(localStorage, seed, p.current, space);
    };
    const down = (e: KeyboardEvent) => {
      if (
        busy.current ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        (e.target instanceof HTMLElement &&
          e.target.closest('input,textarea,select,[contenteditable="true"]'))
      )
        return;
      const key = e.key.toLowerCase();
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
        ].includes(key)
      ) {
        e.preventDefault();
        keys.current.add(key);
        path.current = [];
        pending.current = null;
      }
      if ((key === "e" || key === " ") && !e.repeat) {
        e.preventDefault();
        interact();
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const visibility = () => {
      if (document.hidden) clear();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    window.addEventListener("pagehide", clear);
    document.addEventListener("visibilitychange", visibility);
    let raf = 0,
      last = 0,
      lastSaved = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      if (!busy.current && !document.hidden) {
        const k = keys.current;
        let input = {
          x:
            Number(k.has("d") || k.has("arrowright")) -
            Number(k.has("a") || k.has("arrowleft")) +
            stick.current.x,
          y:
            Number(k.has("s") || k.has("arrowdown")) -
            Number(k.has("w") || k.has("arrowup")) +
            stick.current.y,
        };
        if (!input.x && !input.y && path.current.length) {
          const goal = path.current[0],
            d = distance(p.current, goal);
          if (d <= Math.max(1, 140 * dt)) {
            p.current = { ...p.current, ...goal };
            path.current.shift();
          } else
            input = {
              x: (goal.x - p.current.x) / d,
              y: (goal.y - p.current.y) / d,
            };
        }
        const next = step(p.current, input, dt, space),
          walked = distance(next, p.current) > 0.01;
        let facing = p.current.facing;
        if (Math.abs(input.x) > Math.abs(input.y))
          facing = input.x > 0 ? "right" : "left";
        else if (input.y) facing = input.y > 0 ? "down" : "up";
        p.current = { ...next, facing };
        setPosition((previous) =>
          previous.x === p.current.x &&
          previous.y === p.current.y &&
          previous.facing === p.current.facing
            ? previous
            : p.current,
        );
        setMoving(walked);
        setFrame(walked ? Math.floor(now / 130) % 4 : 0);
        if (now - lastSaved > 600) {
          storePosition(localStorage, seed, p.current, space);
          lastSaved = now;
        }
        if (pending.current && !path.current.length) {
          const id = pending.current;
          pending.current = null;
          const target = options.current.stations.find((s) => s.id === id);
          if (target && distance(p.current, target.approach) <= target.radius)
            options.current.onInteract(id);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clear();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      window.removeEventListener("pagehide", clear);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [seed, space]);
  return {
    position,
    moving,
    frame,
    near: stations
      .filter((s) => distance(position, s.approach) <= s.radius)
      .sort(
        (a, b) =>
          distance(position, a.approach) - distance(position, b.approach),
      )[0],
    go,
    interact,
    setStick: (v: Point) => {
      stick.current = v;
      if (v.x || v.y) {
        path.current = [];
        pending.current = null;
      }
    },
  };
}
