import { TownScene } from "./world/TownScene";
import { relationRank, CONTACTS } from "./engine/relations";
import type { StationId } from "./world/model";
import { useEffect, useRef, useState } from "react";
import type { Action, GameState } from "./engine/types";
import { createGame, act } from "./engine/game";
import { loadGame, saveGame, SAVE_KEY } from "./engine/persistence";
import { NightTrade } from "./world/NightTrade";
import type { NightSession } from "./world/night";
import { ShopScene } from "./world/ShopScene";
import { useSound } from "./world/useSound";
import { ShopPanel, type Panel } from "./components/ShopPanels";
import {
  NewsWindow,
  ReceiptWindow,
  SettingsWindow,
  RulesWindow,
  RestartWindow,
  GameOverWindow,
} from "./ui/NarrativeWindows";
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
function initial() {
  try {
    const loaded = loadGame(localStorage),
      state = loaded.state ?? createGame(randomSeed());
    const error =
      loaded.error ?? (!loaded.state ? saveGame(localStorage, state) : null);
    return { state, error: error ?? "", loaded: !error };
  } catch {
    return {
      state: createGame(randomSeed()),
      error: "本地存储不可用；关闭页面将丢失进度。",
      loaded: false,
    };
  }
}
export default function App() {
  const [start] = useState(initial),
    [s, setState] = useState<GameState>(start.state),
    current = useRef(s);
  const [night, setNight] = useState<NightSession | null>(null);
  const [panel, setPanel] = useState<Panel>(null),
    [notice, setNotice] = useState(""),
    [saveError, setSaveError] = useState(start.error),
    [conflict, setConflict] = useState(false),
    [saved, setSaved] = useState(start.loaded);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    sound = useSound();
  useEffect(() => {
    const listener = (e: StorageEvent) => {
      if (e.key === SAVE_KEY) {
        setPanel(null);
        setNight(null);
        setConflict(true);
        setSaveError("另一个标签页更改了存档，请刷新读取新进度。");
      }
    };
    window.addEventListener("storage", listener);
    return () => {
      window.removeEventListener("storage", listener);
      clearTimeout(timer.current);
    };
  }, []);
  const toast = (text: string) => {
    clearTimeout(timer.current);
    setNotice(text);
    timer.current = setTimeout(() => setNotice(""), 3000);
  };
  const dispatch = (a: Action) => {
    if (conflict) return false;
    const old = current.current,
      result = act(old, a);
    if (result.error) {
      toast(result.error);
      return false;
    }
    let err: string | null = null;
    try {
      err = saveGame(
        localStorage,
        result.state,
        saved ? { seed: old.seed, revision: old.revision } : undefined,
      );
    } catch {
      err = "本地存储不可用，进度尚未保存。";
    }
    if (err?.includes("其他标签")) {
      setPanel(null);
      setConflict(true);
      setSaveError(err);
      return false;
    }
    if (err && a.type === "end") {
      setSaved(false);
      setSaveError(err);
      toast("存档写入失败，本次尚未开业；请释放存储空间后重试。");
      return false;
    }
    if (err) {
      setSaved(false);
      setSaveError(err);
      toast("未能保存，本次操作尚未生效，请修复存储后重试。");
      return false;
    }
    if (
      a.type === "end" &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      setNight({
        before: old,
        row: result.state.ledger.at(-1)!,
      });
    current.current = result.state;
    setState(result.state);
    setSaved(!err);
    setSaveError(err ?? "");
    sound.play(a.type === "order");
    if (a.type === "buy-crystal") toast("水晶球已安放在左下小木箱上。");
    if (a.type === "ward") toast("今晚的护店结界已准备好。");
    if (a.type === "buy") toast("药水已送入仓库。");
    if (a.type === "price") toast("货架价签已换好。");
    if (a.type === "order")
      toast(a.accept ? "药水已交付，报酬已收到。" : "你婉拒了这份委托。");
    if (a.type === "hire-accountant")
      toast("埃德温入职了，去账桌旁找他聊聊吧。");
    if (a.type === "repay" || a.type === "arrears") toast("还款已记下。");
    if (a.type === "town-buy")
      toast(
        a.source === "reserve"
          ? "预订已记下，次日到货，仓位已留好。"
          : "药品已放入仓库。",
      );
    if (a.type === "contract")
      toast(
        a.choice === "accept"
          ? "约定已记下，请留意交货期限。"
          : a.choice === "deliver"
            ? "药品已交付，报酬到账。"
            : a.choice === "decline"
              ? "你谢绝了这次委托。"
              : "已说明取消，货物仍保留。",
      );
    for (const f of ["guild", "kingdom", "black"] as const)
      if (relationRank(result.state, f) > relationRank(old, f))
        toast(`${CONTACTS[f].name}来信：新的合作权益已开放，荣誉榜可查看。`);
    return true;
  };
  const restart = (seed?: number) => {
    const next = createGame(seed ?? randomSeed());
    let err: string | null = null;
    try {
      err = saveGame(localStorage, next);
    } catch {
      err = "本地存储不可用";
    }
    current.current = next;
    setState(next);
    setNight(null);
    setPanel(null);
    setConflict(false);
    setSaveError(err ?? "");
    setSaved(!err);
    toast("新的故事，从第一天开始。");
  };
  const needsNews =
    !night &&
    !conflict &&
    !saveError &&
    s.phase === "planning" &&
    s.status !== "ended" &&
    s.newsReadDay < s.day;
  const closeNews = () => {
    if (s.newsReadDay < s.day && !saveError && !dispatch({ type: "ack-news" }))
      return;
    setPanel((p) => (p === "news" ? null : p));
  };
  const paused =
    Boolean(night) ||
    Boolean(panel && panel !== "news") ||
    conflict ||
    s.phase === "report" ||
    s.status === "ended";
  const interact = (id: StationId) => {
    if (id === "exit") {
      return dispatch({ type: "travel", location: "town" });
    }
    if (id === "return-shop") {
      return dispatch({ type: "travel", location: "shop" });
    }
    const faction =
      id === "town-guild"
        ? "guild"
        : id === "town-market"
          ? "kingdom"
          : id === "town-alley"
            ? "black"
            : null;
    if (faction && !dispatch({ type: "meet", faction })) return false;
    sound.play();
    setPanel(id);
    return true;
  };
  return (
    <div className="game-root">
      {s.location === "town" &&
      !night &&
      s.phase === "planning" &&
      s.status !== "ended" ? (
        <TownScene
          key={`town-${s.seed}`}
          s={s}
          paused={paused}
          onInteract={interact}
          onSettings={() => {
            if (!paused) setPanel("settings");
          }}
          onReturn={() => dispatch({ type: "travel", location: "shop" })}
          saved={saved}
          muted={sound.muted}
          onMute={sound.toggle}
        />
      ) : (
        <ShopScene
          key={s.seed}
          s={night?.before ?? s}
          night={Boolean(night)}
          paused={paused}
          briefing={Boolean(
            (needsNews || panel === "news") && (!panel || panel === "news"),
          )}
          onInteract={interact}
          onSettings={() => {
            if (!paused) setPanel("settings");
          }}
          saved={saved}
          muted={sound.muted}
          onMute={sound.toggle}
        />
      )}
      {s.status === "default" && !paused && (
        <p className="world-default" role="alert">
          经营费逾期 {s.arrears} G · 请到基础账本处理
        </p>
      )}
      {saveError && (
        <div className="world-save-error" role="alert">
          {saveError}
          {conflict && (
            <button className="secondary" onClick={() => location.reload()}>
              刷新读取新进度
            </button>
          )}
        </div>
      )}
      {notice && !panel && (
        <div className="scene-toast" role="status">
          {notice}
        </div>
      )}
      {(needsNews || panel === "news") && (
        <NewsWindow
          key={`news-${s.day}`}
          s={s}
          onClose={closeNews}
          visible={!panel || panel === "news"}
        />
      )}
      {night ? (
        <NightTrade session={night} onDone={() => setNight(null)} />
      ) : s.status === "ended" ? (
        <GameOverWindow s={s} onRestart={() => restart()} />
      ) : s.phase === "report" ? (
        <ReceiptWindow
          key={`receipt-${s.day}`}
          s={s}
          saved={saved}
          onNext={() => dispatch({ type: "ack" })}
        />
      ) : panel === "restart" ? (
        <RestartWindow
          seed={s.seed}
          onClose={() => setPanel("settings")}
          onRestart={restart}
        />
      ) : panel === "settings" ? (
        <SettingsWindow
          muted={sound.muted}
          onMute={sound.toggle}
          onClose={() => setPanel(null)}
          onRules={() => setPanel("rules")}
          onRestart={() => setPanel("restart")}
          onNews={() => setPanel("news")}
        />
      ) : panel === "rules" ? (
        <RulesWindow onClose={() => setPanel(null)} />
      ) : panel && panel !== "news" ? (
        <ShopPanel
          id={panel}
          s={s}
          dispatch={dispatch}
          notice={notice}
          onClose={() => setPanel(null)}
        />
      ) : null}
    </div>
  );
}
