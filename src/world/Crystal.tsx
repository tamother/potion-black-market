export function Crystal({ active = false }: { active?: boolean }) {
  return (
    <svg
      className={`crystal-sprite ${active ? "warded" : ""}`}
      viewBox="0 0 48 64"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <path
        fill="#282137"
        d="M14 2h20v4h6v6h4v20h-4v6h-6v4H14v-4H8v-6H4V12h4V6h6z"
      />
      <path
        fill="#665d98"
        d="M15 5h18v4h6v7h3v14h-5v6h-6v4H17v-4h-6v-6H7V15h4V9h4z"
      />
      <path fill="#9fa5d1" d="M15 8h16v4h6v8h-4v11h-6v6H17v-4h-5v-6H9V16h6z" />
      <path
        fill={active ? "#b8e7d0" : "#b8cee0"}
        d="M17 10h11v4h-7v5h-7v8h-3v-9h3v-5h3z"
      />
      <path fill="#f3e4c1" d="M17 11h5v5h-5zM12 17h4v5h-4z" />
      <path
        fill={active ? "#83d7ba" : "#816bab"}
        d="M28 19h7v10h-4v5h-8v-5h5z"
      />
      <path
        fill="#483358"
        d="M12 34h6v6h13v-6h6v10h-6v7h4v5h6v6H7v-6h6v-5h4v-7h-5z"
      />
      <path
        fill="#a77b49"
        d="M13 36h3v6h16v-6h3v9H13zM20 45h9v8h-9zM13 55h23v4H13z"
      />
      <path
        fill="#e2ba72"
        d="M15 40h3v3h13v-3h3v5H15zM21 47h3v6h-3zM15 55h18v2H15z"
      />
      <path fill="#f5dcaa" d="M23 19h2v4h4v2h-4v4h-2v-4h-4v-2h4z" />
    </svg>
  );
}
