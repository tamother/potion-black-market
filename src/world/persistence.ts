import {
  canStand,
  SPAWN,
  TOWN_SPAWN,
  type Space,
  type Position,
} from "./model";
export const ROOM_KEY = "potion-black-market-room-v1";
export function loadPosition(
  storage: Pick<Storage, "getItem">,
  seed: number,
  space: Space = "shop",
): Position {
  try {
    const p = JSON.parse(
      storage.getItem(
        space === "shop" ? ROOM_KEY : "potion-black-market-town-position-v1",
      ) ?? "null",
    );
    if (
      p &&
      p.seed === seed &&
      canStand(p, space) &&
      ["down", "left", "right", "up"].includes(p.facing)
    )
      return { x: p.x, y: p.y, facing: p.facing };
  } catch {
    /* Room position is non-economic; a bad record safely respawns. */
  }
  return { ...(space === "shop" ? SPAWN : TOWN_SPAWN) };
}
export function storePosition(
  storage: Pick<Storage, "setItem">,
  seed: number,
  p: Position,
  space: Space = "shop",
) {
  try {
    if (canStand(p, space))
      storage.setItem(
        space === "shop" ? ROOM_KEY : "potion-black-market-town-position-v1",
        JSON.stringify({ seed, ...p }),
      );
  } catch {
    /* Economy saving has its own visible error. */
  }
}
