import type { Facing } from "./model";

const playerSheetHeight = 1239;
const playerFrameHeight = playerSheetHeight / 4;
// Crop the uneven rows in shopkeeper.png without cutting into the next pose.
const playerFrameTop: Record<Facing, number> = {
  down: 0,
  left: playerFrameHeight,
  right: 592,
  up: 898,
};

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
  const verticalPosition =
    kind === "player"
      ? (playerFrameTop[facing] * 100) / (playerSheetHeight - playerFrameHeight)
      : facing === "up"
        ? 100
        : 0;
  const col = kind === "player" ? frame : person;
  return (
    <span
      aria-hidden="true"
      className={`actor-sprite ${kind} ${walking ? "walking" : ""}`}
      style={{
        backgroundImage: `url(${import.meta.env.BASE_URL}world/${kind === "player" ? "shopkeeper" : "visitors"}.png)`,
        backgroundSize: `400% ${kind === "player" ? 400 : 200}%`,
        backgroundPosition: `${(col * 100) / 3}% ${verticalPosition}%`,
      }}
    />
  );
}
