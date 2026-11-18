import type { CSSProperties } from "react";
export function Potion({
  color = "#aa8bd6",
  large = false,
}: {
  color?: string;
  large?: boolean;
}) {
  const liquid =
    (
      {
        "#dc7a79": "#ec536b",
        "#7eaee2": "#65b2ef",
        "#93bb8e": "#7ec283",
        "#aa8bd6": "#b182ee",
        "#dfa16c": "#eaae52",
      } as Record<string, string>
    )[color] ?? color;
  return (
    <svg
      className={`potion ${large ? "large" : ""}`}
      style={{ "--potion": color } as CSSProperties}
      viewBox="0 0 32 40"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <path
        d="M11 1h10v6h-2v7l7 6v14h-3v3H9v-3H6V20l7-6V7h-2z"
        fill="#100e0d"
      />
      <path d="M12 2h8v4h-8z" fill="#b68d54" />
      <path d="M13 3h5v2h-5z" fill="#e9be7a" />
      <path d="M14 7h4v8l7 6v12h-3v3H10v-3H7V21l7-6z" fill="#77838f" />
      <path d="M15 8h2v9l6 5v10h-2v2H11v-2H9V22l6-5z" fill="#252534" />
      <path d="M10 23h12v9h-2v2h-8v-2h-2z" fill={liquid} />
      <path d="M10 22h12v3H10z" fill={liquid} opacity=".65" />
      <path d="M11 26h2v5h-2zM14 32h5v1h-5z" fill="#fff" opacity=".65" />
      <path d="M14 9h1v7h-1z" fill="#e3e7ee" />
      <path d="M9 21h2v3H9z" fill="#d6d9e3" />
    </svg>
  );
}
