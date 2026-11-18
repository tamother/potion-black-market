import { remainingActions } from "../engine/actions";
import { useState } from "react";
import { RULES } from "../engine/config";
import { HAZARDS } from "../engine/hazards";
import { Crystal } from "../world/Crystal";
import { Sprite } from "../world/Sprite";
import { Window, Tabs, type UIProps } from "./Window";
export function MerchantWindow({ s, dispatch, onClose, notice }: UIProps) {
  const [tab, setTab] = useState("offer");
  return (
    <Window
      label="黑市商人"
      title="维斯 · 黑市行商"
      onClose={onClose}
      notice={notice}
      tabs={
        <Tabs
          tabs={[
            { id: "offer", label: "匣中水晶" },
            { id: "terms", label: "使用约定" },
          ]}
          value={tab}
          onChange={setTab}
        />
      }
      hint="购入消耗1行动；维斯每隔三天会再次路过。"
      footer={
        s.crystalUnlockedDay === null ? (
          <button
            className="primary"
            aria-label="购入水晶球"
            disabled={
              s.cash < RULES.crystalUnlock ||
              s.status !== "active" ||
              remainingActions(s) < 1
            }
            onClick={() => dispatch({ type: "buy-crystal" })}
          >
            购入 {RULES.crystalUnlock} G
          </button>
        ) : (
          <button className="secondary" onClick={onClose}>
            送别商人
          </button>
        )
      }
    >
      <div className="crystal-page">
        <div className="crystal-display">
          <Crystal />
        </div>
        <article>
          {tab === "offer" ? (
            <>
              <h3>“雾里藏着今夜的坏兆头。”</h3>
              <p>
                维斯打开丝绒木匣。水晶球售价{RULES.crystalUnlock}{" "}
                G，购入后摆在左下小木箱。
              </p>
              <p>使用时另付{RULES.crystalUse} G，为当晚准备护店结界。</p>
            </>
          ) : (
            <>
              <h3>降低风险，无法承诺平安</h3>
              <p>每次把当晚店内意外概率降低60%，只生效一天，每日最多一次。</p>
              <p>不影响王国调查，也不改变战争、疫病和市场事件。</p>
            </>
          )}
        </article>
      </div>
    </Window>
  );
}
export function CrystalWindow({ s, dispatch, onClose, notice }: UIProps) {
  const [tab, setTab] = useState("omen"),
    kind = s.omen.kind,
    h = kind ? HAZARDS[kind] : null,
    warded = s.wardDay === s.day;
  const base = Math.round(s.omen.chance * 100),
    actual = base * (warded ? 1 - RULES.wardReduction : 1);
  return (
    <Window
      label="水晶球"
      title="雾银水晶球"
      onClose={onClose}
      notice={notice}
      tabs={
        <Tabs
          tabs={[
            { id: "omen", label: "今夜预兆" },
            { id: "ward", label: "护店结界" },
          ]}
          value={tab}
          onChange={setTab}
        />
      }
      hint={
        warded
          ? "结界已准备好，今夜仍有意外的可能。"
          : "护店需1行动；只影响店内意外，不降低王国调查风险。"
      }
      footer={
        <button
          className="primary"
          aria-label={warded ? "今晚已设结界" : "施放护店结界"}
          disabled={
            warded ||
            !h ||
            s.cash < RULES.crystalUse ||
            s.status !== "active" ||
            remainingActions(s) < 1
          }
          onClick={() => dispatch({ type: "ward" })}
        >
          {warded
            ? "今晚已设结界"
            : h
              ? `护店 ${RULES.crystalUse} G`
              : "今晚无需占卜"}
        </button>
      }
    >
      <div className="crystal-page">
        <div className="crystal-display">
          <Crystal active={warded} />
        </div>
        <article>
          {tab === "omen" ? (
            <>
              <h3>{h?.name ?? "雾面平静"}</h3>
              <p>
                {h
                  ? `${h.clue} ${h.effect}`
                  : "今晚没有店内意外预警，不必付费。市场与王国调查仍按各自规则运行。"}
              </p>
              <p>
                {h
                  ? `今夜发生概率 ${Number(actual.toFixed(1))}%${warded ? `（原为${base}%）` : ""}`
                  : ""}
              </p>
            </>
          ) : (
            <>
              <h3>每次 {RULES.crystalUse} G · 仅当晚有效</h3>
              <p>
                {h
                  ? `启用后概率由${base}%降至${Number((base * (1 - RULES.wardReduction)).toFixed(1))}%。${h.advice}`
                  : "平静的夜晚无需启用结界。"}
              </p>
              <p>
                结界不能保证避险，次日失效；同一天刷新不会再次付费或重抽结果。
              </p>
            </>
          )}
        </article>
      </div>
    </Window>
  );
}
