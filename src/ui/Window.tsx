import type { ReactNode } from "react";
import { Dialog } from "../components/Dialogs";
import type { Action, GameState } from "../engine/types";
export type Dispatch = (a: Action) => boolean;
export interface UIProps {
  s: GameState;
  dispatch: Dispatch;
  onClose: () => void;
  notice?: string;
}
export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
}
export function Tabs({
  tabs,
  value,
  onChange,
  label = "窗口标签",
}: {
  tabs: Tab[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  return (
    <div className="window-tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => {
            let n = i;
            if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
            else if (e.key === "ArrowLeft")
              n = (i + tabs.length - 1) % tabs.length;
            else if (e.key === "Home") n = 0;
            else if (e.key === "End") n = tabs.length - 1;
            else return;
            e.preventDefault();
            onChange(tabs[n].id);
            e.currentTarget.parentElement
              ?.querySelectorAll<HTMLButtonElement>("button")
              [n]?.focus();
          }}
        >
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
export function Pager({
  page,
  count,
  onChange,
  label = "页码",
}: {
  page: number;
  count: number;
  onChange: (n: number) => void;
  label?: string;
}) {
  const total = Math.max(1, count),
    index = Math.max(0, Math.min(page, total - 1));
  return (
    <div className="window-pager" role="group" aria-label={label}>
      <button
        type="button"
        className="secondary"
        aria-label="上一页"
        disabled={index === 0}
        onClick={() => onChange(index - 1)}
      >
        ‹
      </button>
      <span>
        {index + 1} / {total}
      </span>
      <button
        type="button"
        className="secondary"
        aria-label="下一页"
        disabled={index === total - 1}
        onClick={() => onChange(index + 1)}
      >
        ›
      </button>
    </div>
  );
}
export function Window({
  label,
  title,
  subtitle,
  header,
  tabs,
  children,
  footer,
  hint,
  notice,
  onClose,
  kind = "",
}: {
  label: string;
  title: string;
  subtitle?: string;
  header?: ReactNode;
  tabs?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  hint?: ReactNode;
  notice?: string;
  onClose?: () => void;
  kind?: string;
}) {
  return (
    <Dialog label={label} onClose={onClose}>
      <section className={`compact-window ${kind}`}>
        <header className="window-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <small>{subtitle}</small>}
          </div>
          {header}
        </header>
        {tabs}
        <div className="window-content" data-window-content>
          {children}
        </div>
        <footer className="window-footer">
          <div
            className={`window-hint ${notice ? "has-notice" : ""}`}
            role={notice ? "status" : undefined}
          >
            {notice || hint}
          </div>
          <div className="window-actions">{footer}</div>
        </footer>
      </section>
    </Dialog>
  );
}
