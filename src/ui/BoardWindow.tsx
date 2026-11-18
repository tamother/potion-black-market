import { activeContracts } from "../engine/town";
import { townOutlook } from "../engine/forecasts";
import { ContractView } from "./ContractView";
import type { Dispatch } from "./Window";
import { useState } from "react";
import type { GameState } from "../engine/types";
import { CHAIN_NAMES } from "../engine/config";
import { riskLabel } from "../components/Shared";
import { Window, Tabs, Pager } from "./Window";
import { textPages } from "./paging";
export function BoardWindow({
  s,
  onClose,
  dispatch,
}: {
  s: GameState;
  dispatch: Dispatch;
  onClose: () => void;
}) {
  const [tab, setTab] = useState("rumors"),
    [page, setPage] = useState(0);
  const promises = activeContracts(s),
    forecast = townOutlook(s);
  const rumors = [
    ...(forecast
      ? [
          {
            title: "镇区行情",
            state:
              s.day >= forecast.start ? `至第${forecast.until}天` : "未来几天",
            text:
              s.town.knownForecast === forecast.start || s.day >= forecast.start
                ? forecast.detail
                : forecast.clue,
          },
        ]
      : []),
    ...Object.entries(s.chains)
      .filter(([, c]) => c.stage !== "idle")
      .map(([id, c]) => ({
        title: CHAIN_NAMES[id as keyof typeof CHAIN_NAMES],
        state:
          c.stage === "rumor"
            ? "风声传来"
            : c.stage === "active"
              ? "正在发生"
              : "暂时平息",
        text:
          c.stage === "rumor"
            ? "巷子里的低声交谈多了起来。留意接下来的来客和来信。"
            : c.stage === "active"
              ? c.choice
                ? "你已经做出了选择，事情仍在继续。"
                : "局势正在改变，来客或许会带来新的委托。"
              : "这件事暂时告一段落。",
      })),
    ...s.effects.map((e) => ({
      title: e.title,
      state: `至第 ${e.until} 天`,
      text: e.description,
    })),
  ].flatMap((r) => textPages(r.text, 72).map((text) => ({ ...r, text })));
  const history = s.log
    .slice()
    .reverse()
    .flatMap((l) =>
      textPages(l.text, 72).map((text) => ({
        title: `第 ${l.day} 天`,
        state:
          l.kind === "choice"
            ? "你的选择"
            : l.kind === "risk"
              ? "调查记录"
              : "巷间往事",
        text,
      })),
    );
  const records = tab === "history" ? history : rumors,
    index = Math.min(
      page,
      Math.max(
        0,
        (tab === "promises" ? promises.length * 3 : records.length) - 1,
      ),
    ),
    record = records[index];
  return (
    <Window
      label="巷间布告栏"
      title="巷间布告栏"
      subtitle="来信由小夜送达，这里留着巷子的旧闻。"
      onClose={onClose}
      tabs={
        <Tabs
          tabs={[
            { id: "rumors", label: "传闻" },
            { id: "promises", label: "约定" },
            { id: "risk", label: "调查" },
            { id: "history", label: "往事" },
          ]}
          value={tab}
          onChange={(id) => {
            setTab(id);
            setPage(0);
          }}
        />
      }
      hint={
        tab === "promises"
          ? "预留药水不会零售，交货请找镇上的委托人。"
          : tab === "risk"
            ? "停止非法交易的营业日，风险降低 5 点。"
            : "每日资讯会在开店时自动送来。"
      }
      footer={
        (tab === "promises" && promises.length * 3 > 1) ||
        ((tab === "rumors" || tab === "history") && records.length > 1) ? (
          <Pager
            page={index}
            count={tab === "promises" ? promises.length * 3 : records.length}
            onChange={setPage}
          />
        ) : undefined
      }
    >
      {tab === "promises" ? (
        promises.length ? (
          <ContractView
            s={s}
            c={promises[Math.floor(index / 3)]}
            page={index}
            dispatch={dispatch}
          />
        ) : (
          <div className="window-empty">
            <h3>还没有跨日约定</h3>
            <p>镇上的联系人会带来需要提前备货的委托。</p>
          </div>
        )
      ) : tab === "risk" ? (
        <div className="risk-sheet">
          <div className="risk-emblem">
            <strong>{s.risk}</strong>
            <span>/ 100 · {riskLabel(s.risk)}</span>
          </div>
          <div>
            <h3>王国调查档案</h3>
            <p>
              高风险调查概率 5%–15%；危险区 15%–30%。首次调查会留下正式警告。
            </p>
            <p>
              {s.warningDay !== null
                ? `第 ${s.warningDay} 天收到正式警告，已被调查 ${s.strikes} 次。`
                : "尚未收到正式警告。"}
              {s.warningDay !== null ? "警告后仍严重违法，可能遭到查封。" : ""}
            </p>
          </div>
        </div>
      ) : record ? (
        <article className="story-page">
          <small>{record.state}</small>
          <h3>{record.title}</h3>
          <p>{record.text}</p>
        </article>
      ) : (
        <div className="window-empty">
          <span aria-hidden="true">☾</span>
          <h3>巷子里暂时很安静</h3>
          <p>新的风声与来过的信，都会留在这里。</p>
        </div>
      )}
    </Window>
  );
}
