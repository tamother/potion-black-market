import { useCallback, useEffect, useRef, useState } from "react";
const KEY = "potion-controls-v1";
function readProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return {
      moved: saved?.moved === true,
      interacted: saved?.interacted === true,
    };
  } catch {
    return { moved: false, interacted: false };
  }
}
export function useControlGuide() {
  const [progress, setProgress] = useState(readProgress);
  const current = useRef(progress);
  const [touch, setTouch] = useState(
    () =>
      matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0,
  );
  useEffect(() => {
    const media = matchMedia("(pointer: coarse)");
    const update = () =>
      setTouch(media.matches || navigator.maxTouchPoints > 0);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const record = useCallback((key: "moved" | "interacted") => {
    if (current.current[key]) return;
    const next = { ...current.current, [key]: true };
    current.current = next;
    setProgress(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* Guidance also works when storage is unavailable. */
    }
  }, []);
  const moved = useCallback(() => record("moved"), [record]);
  const interacted = useCallback(() => record("interacted"), [record]);
  const text = !progress.moved
    ? touch
      ? "左侧空白处按住拖动，即可移动"
      : "WASD / 方向键移动"
    : !progress.interacted
      ? touch
        ? "点击物件，或走近后点右侧按钮"
        : "点击物件，或走近后按 E 交互"
      : null;
  return { text, touch, moved, interacted };
}
export function ControlHint({ text }: { text: string | null }) {
  return text ? (
    <p
      className="keyboard-hint control-hint"
      role="status"
      data-testid="control-hint"
    >
      {text}
    </p>
  ) : null;
}
