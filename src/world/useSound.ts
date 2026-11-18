import { useEffect, useRef, useState } from "react";
export function useSound() {
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem("potion-shop-sound") !== "on";
    } catch {
      return true;
    }
  });
  const context = useRef<AudioContext | null>(null);
  const play = (coin = false) => {
    if (muted) return;
    try {
      const c = (context.current ??= new AudioContext());
      void c.resume();
      const osc = c.createOscillator(),
        gain = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(coin ? 880 : 330, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        coin ? 1320 : 220,
        c.currentTime + 0.12,
      );
      gain.gain.setValueAtTime(0.035, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + 0.2);
    } catch {
      /* Audio is optional. */
    }
  };
  useEffect(
    () => () => {
      void context.current?.close();
    },
    [],
  );
  return {
    muted,
    play,
    toggle: () => {
      try {
        if (muted) {
          context.current ??= new AudioContext();
          void context.current.resume();
        }
        localStorage.setItem("potion-shop-sound", muted ? "on" : "off");
      } catch {}
      setMuted(!muted);
    },
  };
}
