import type { Facing } from "./model";
export function Sprite({
  kind = "player",
  facing = "down",
  frame = 0,
  person = 0,
  walking = false,
}: {
  kind?: "player" | "npc";
  facing?: Facing;
  frame?: number;
  person?: number;
  walking?: boolean;
}) {
  const row =
    kind === "player"
      ? ["down", "left", "right", "up"].indexOf(facing)
      : facing === "up"
        ? 1
        : 0;
  const col = kind === "player" ? frame : person;
  return (
    <span
      aria-hidden="true"
      className={`actor-sprite ${kind} ${walking ? "walking" : ""}`}
      style={{
        backgroundImage: `url(/world/${kind === "player" ? "shopkeeper" : "visitors"}.png)`,
        backgroundSize: `400% ${kind === "player" ? 400 : 200}%`,
        backgroundPosition: `${(col * 100) / 3}% ${(row * 100) / (kind === "player" ? 3 : 1)}%`,
      }}
    />
  );
}
