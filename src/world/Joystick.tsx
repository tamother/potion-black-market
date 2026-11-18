import { useEffect, useRef, useState } from "react";
import type { Point } from "./model";
export function Joystick({
  onMove,
  disabled,
}: {
  onMove: (v: Point) => void;
  disabled: boolean;
}) {
  const zone = useRef<HTMLDivElement>(null),
    pad = useRef<HTMLDivElement>(null),
    owner = useRef<{ id: number; origin: Point } | null>(null),
    options = useRef({ onMove, disabled }),
    clickUntil = useRef(0);
  options.current = { onMove, disabled };
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 }),
    [floating, setFloating] = useState<Point | null>(null);
  const sample = (x: number, y: number) => {
    const active = owner.current;
    if (!active) return;
    const dx = x - active.origin.x,
      dy = y - active.origin.y,
      d = Math.hypot(dx, dy),
      radius = 30,
      ratio = Math.min(1, radius / (d || 1));
    setOffset({ x: dx * ratio, y: dy * ratio });
    const strength = Math.min(1, Math.max(0, (d - 5) / (radius - 5)));
    options.current.onMove(
      d ? { x: (dx / d) * strength, y: (dy / d) * strength } : { x: 0, y: 0 },
    );
  };
  const stop = () => {
    const active = owner.current;
    owner.current = null;
    if (active) clickUntil.current = performance.now() + 400;
    setOffset({ x: 0, y: 0 });
    setFloating(null);
    options.current.onMove({ x: 0, y: 0 });
    try {
      if (active && zone.current?.hasPointerCapture(active.id))
        zone.current.releasePointerCapture(active.id);
    } catch {}
  };
  useEffect(() => {
    if (disabled) stop();
  }, [disabled]);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (
        options.current.disabled ||
        owner.current ||
        (e.pointerType === "mouse" && e.button !== 0)
      )
        return;
      if (
        e.target instanceof Element &&
        e.target.closest(
          'button,a,input,select,textarea,dialog,aside,[role="dialog"]',
        )
      )
        return;
      const z = zone.current?.getBoundingClientRect(),
        r = pad.current?.getBoundingClientRect();
      if (
        !z ||
        !r ||
        e.clientX < z.left ||
        e.clientX > z.right ||
        e.clientY < z.top ||
        e.clientY > z.bottom
      )
        return;
      e.preventDefault();
      clickUntil.current = performance.now() + 1000;
      const origin = { x: e.clientX, y: e.clientY };
      setFloating({
        x: origin.x - z.left - r.width / 2,
        y: origin.y - z.top - r.height / 2,
      });
      owner.current = { id: e.pointerId, origin };
      try {
        zone.current?.setPointerCapture(e.pointerId);
      } catch {}
      sample(e.clientX, e.clientY);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== owner.current?.id || options.current.disabled) return;
      if (e.cancelable) e.preventDefault();
      sample(e.clientX, e.clientY);
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId === owner.current?.id) stop();
    };
    const click = (e: MouseEvent) => {
      if (
        e.detail === 0 ||
        (e.target instanceof Element &&
          e.target.closest("button,a,input,dialog,aside"))
      )
        return;
      if (owner.current || performance.now() < clickUntil.current) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    const hidden = () => {
      if (document.hidden) stop();
    };
    window.addEventListener("pointerdown", down, {
      capture: true,
      passive: false,
    });
    window.addEventListener("pointermove", move, {
      capture: true,
      passive: false,
    });
    window.addEventListener("pointerup", end, true);
    window.addEventListener("pointercancel", end, true);
    window.addEventListener("click", click, true);
    window.addEventListener("blur", stop);
    window.addEventListener("resize", stop);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      stop();
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", end, true);
      window.removeEventListener("pointercancel", end, true);
      window.removeEventListener("click", click, true);
      window.removeEventListener("blur", stop);
      window.removeEventListener("resize", stop);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  return (
    <div
      ref={zone}
      className="joystick-zone touch-control"
      role="group"
      aria-label="移动摇杆"
    >
      <div
        ref={pad}
        className={`joystick ${floating ? "active" : ""}`}
        data-testid="joystick"
        style={
          floating
            ? { left: floating.x, top: floating.y, bottom: "auto" }
            : undefined
        }
      >
        <span className="stick-arrows" aria-hidden="true">
          ✦
        </span>
        <span
          className="stick-thumb"
          style={{ transform: `translate(${offset.x}px,${offset.y}px)` }}
        />
      </div>
    </div>
  );
}
