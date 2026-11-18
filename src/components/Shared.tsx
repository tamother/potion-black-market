import type { GameState } from "../engine/types";
import { FACTIONS } from "../engine/config";
import {
  Shield,
  Swords,
  Eye,
  Coins,
  Scale,
  Package,
  ChevronRight,
} from "./PixelIcons";
import { quantity } from "../engine/inventory";
export const money = (n: number) => `${n.toLocaleString("zh-CN")} G`;
export const signed = (n: number) =>
  `${n > 0 ? "+" : ""}${n.toLocaleString("zh-CN")}`;
export const riskLabel = (n: number) =>
  n < 25 ? "安全" : n < 50 ? "受到关注" : n < 75 ? "高风险" : "危险";
export function Stats({ s }: { s: GameState }) {
  return (
    <div className="stats">
      <div className="stat">
        <Coins />
        <div>
          <span data-short="现金">可用现金</span>
          <strong data-testid="cash">{money(s.cash)}</strong>
        </div>
      </div>
      <div className="stat">
        <Scale />
        <div>
          <span data-short="债务">未偿债务</span>
          <strong>{money(s.debt)}</strong>
        </div>
      </div>
      <div className="stat">
        <Package />
        <div>
          <span data-short="仓库">仓库占用</span>
          <strong>
            {quantity(s)} <small>/ {s.capacity}</small>
          </strong>
        </div>
      </div>
      <div className={`stat ${s.risk >= 50 ? "danger" : ""}`}>
        <Eye />
        <div>
          <span data-short="调查">调查风险 · {riskLabel(s.risk)}</span>
          <strong>
            {s.risk} <small>/ 100</small>
          </strong>
        </div>
      </div>
    </div>
  );
}
export function Factions({
  s,
  full = false,
}: {
  s: GameState;
  full?: boolean;
}) {
  const icons = { kingdom: Shield, guild: Swords, black: Eye };
  return (
    <section className="panel factions">
      <div className="section-title">
        <h2>势力声望</h2>
        <span>−100 至 +100</span>
      </div>
      {(Object.keys(FACTIONS) as (keyof typeof FACTIONS)[]).map((id) => {
        const Icon = icons[id],
          rep = s.reputation[id];
        return (
          <div className={`faction ${id}`} key={id}>
            <Icon size={20} />
            <span>{FACTIONS[id]}</span>
            <div className="rep-track">
              <i
                style={{
                  width: `${Math.abs(rep) / 2}%`,
                  left: rep >= 0 ? "50%" : `${50 + rep / 2}%`,
                }}
              />
            </div>
            <strong>
              {rep > 0 ? "+" : ""}
              {rep}
            </strong>
          </div>
        );
      })}
      {full ? (
        <p className="muted">
          王国认可军需供应；公会看重补给与援助；黑市奖励走私。声望影响订单资格，不会无限提高利润。
        </p>
      ) : (
        <p className="small muted">你的每次选择，都会被记住。</p>
      )}
    </section>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Package size={30} />
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}
export function TextLink({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ChevronRight size={14} />
    </button>
  );
}
