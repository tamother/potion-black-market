import { useState } from "react";
import type { GameState, Faction } from "../engine/types";
import { FACTIONS } from "../engine/config";
import {
  CONTACTS,
  RANK_NAMES,
  relationRank,
  relationBenefits,
  nextRelation,
} from "../engine/relations";
import { Window, Tabs, Pager } from "./Window";
import { Sprite } from "../world/Sprite";
const CRESTS = { guild: "⚔", kingdom: "♛", black: "☾" };
export function RelationsView({
  s,
  f,
  page = 0,
}: {
  s: GameState;
  f: Faction;
  page?: number;
}) {
  const rank = relationRank(s, f),
    contact = CONTACTS[f];
  return (
    <section className="relation-card">
      <div className={`relation-medal rank-${rank}`} aria-hidden="true">
        {CRESTS[f]}
      </div>
      <article>
        <h3>
          {FACTIONS[f]} ·{" "}
          <span data-testid="relation-rank">{RANK_NAMES[rank]}</span>
        </h3>
        {page === 0 ? (
          <>
            <div className="relation-meter">
              <i style={{ width: `${Math.max(0, s.reputation[f])}%` }} />
            </div>
            <p>
              声望 {s.reputation[f]} / 100 · 关键合作 {s.town.keys[f]} / 3
            </p>
            <p>
              {s.town.met[f]
                ? `${contact.name}记得你们的往来。`
                : `到${contact.place}认识${contact.name}。`}
            </p>
          </>
        ) : page === 1 ? (
          <>
            <h4>已经开放的权益</h4>
            {relationBenefits(s, f).map((text) => (
              <p key={text}>{text}</p>
            ))}
          </>
        ) : (
          <>
            <h4>下一段往来</h4>
            <p>{nextRelation(s, f)}</p>
            <p className="quiet-note">
              重复小单的声望逐渐减少；关键委托会推进合作。
            </p>
          </>
        )}
      </article>
    </section>
  );
}
export function HonorsWindow({
  s,
  onClose,
}: {
  s: GameState;
  onClose: () => void;
}) {
  const [f, setFaction] = useState<Faction>("guild"),
    [page, setPage] = useState(0);
  return (
    <Window
      label="荣誉榜"
      title="月隐巷 · 荣誉榜"
      kind="honors-window"
      onClose={onClose}
      tabs={
        <Tabs
          value={f}
          onChange={(v) => {
            setFaction(v as Faction);
            setPage(0);
          }}
          tabs={[
            { id: "guild", label: "公会" },
            { id: "kingdom", label: "王国" },
            { id: "black", label: "黑市" },
          ]}
        />
      }
      hint={
        [
          "这些徽记，记着你与镇上三方的往来。",
          "供货数量按日恢复，违法调查仍照常。",
          "关系需要实际合作，不会只靠日数升级。",
        ][page]
      }
      footer={
        <Pager label="荣誉榜页码" page={page} count={3} onChange={setPage} />
      }
    >
      <RelationsView s={s} f={f} page={page} />
    </Window>
  );
}
