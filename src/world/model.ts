export type Space = "shop" | "town";
export type Facing = "down" | "left" | "right" | "up";
export interface Point {
  x: number;
  y: number;
}
export interface Position extends Point {
  facing: Facing;
}
export const SERVICE_VISITOR = { x: 480, y: 350 };
export const SERVICE_STAFF = { x: 480, y: 205 };
export const SERVICE_ENTRY = [
  { x: 480, y: 490 },
  { x: 480, y: 410 },
  SERVICE_VISITOR,
];
export const SPAWN: Position = { x: 440, y: 335, facing: "down" };
export const WIDTH = 960,
  HEIGHT = 540;
export type StationId =
  | "board"
  | "chest"
  | "shelves"
  | "supplies"
  | "ledger"
  | "sign"
  | "visitor"
  | "accountant"
  | "merchant"
  | "crystal"
  | "honors"
  | "exit"
  | "town-market"
  | "town-guild"
  | "town-alley"
  | "return-shop";
export interface Station {
  id: StationId;
  label: string;
  approach: Point;
  anchor: Point;
  radius: number;
  hint: string;
}
export const STATIONS: Station[] = [
  {
    id: "board",
    label: "布告栏",
    approach: { x: 300, y: 193 },
    anchor: { x: 295, y: 106 },
    radius: 66,
    hint: "查看巷间传闻",
  },
  {
    id: "chest",
    label: "仓库箱",
    approach: { x: 251, y: 238 },
    anchor: { x: 161, y: 175 },
    radius: 64,
    hint: "查看库存",
  },
  {
    id: "shelves",
    label: "魔药货架",
    approach: { x: 625, y: 196 },
    anchor: { x: 622, y: 111 },
    radius: 62,
    hint: "调整售价",
  },
  {
    id: "supplies",
    label: "进货簿",
    approach: { x: 635, y: 278 },
    anchor: { x: 480, y: 230 },
    radius: 44,
    hint: "向商队订货",
  },
  {
    id: "ledger",
    label: "基础账本",
    approach: { x: 790, y: 389 },
    anchor: { x: 791, y: 298 },
    radius: 44,
    hint: "收支与债务",
  },
  {
    id: "sign",
    label: "营业牌",
    approach: { x: 561, y: 396 },
    anchor: { x: 589, y: 414 },
    radius: 46,
    hint: "备好货，入夜开业",
  },
];
export const TOWN_SPAWN: Position = { x: 480, y: 410, facing: "up" };
export const TOWN_STATIONS: Station[] = [
  {
    id: "town-market",
    label: "镇集市",
    anchor: { x: 225, y: 204 },
    approach: { x: 230, y: 275 },
    radius: 52,
    hint: "与米拉交谈",
  },
  {
    id: "town-guild",
    label: "冒险者公会",
    anchor: { x: 530, y: 135 },
    approach: { x: 530, y: 220 },
    radius: 54,
    hint: "拜访塞拉",
  },
  {
    id: "town-alley",
    label: "旧巷",
    anchor: { x: 815, y: 260 },
    approach: { x: 810, y: 345 },
    radius: 50,
    hint: "与阿缇交谈",
  },
  {
    id: "return-shop",
    label: "魔药店",
    anchor: { x: 480, y: 455 },
    approach: { x: 480, y: 410 },
    radius: 38,
    hint: "返回店铺",
  },
];
STATIONS.push(
  {
    id: "honors",
    label: "荣誉榜",
    anchor: { x: 371, y: 400 },
    approach: { x: 443, y: 391 },
    radius: 40,
    hint: "查看关系与合作权益",
  },
  {
    id: "exit",
    label: "去镇上",
    anchor: { x: 480, y: 482 },
    approach: { x: 480, y: 474 },
    radius: 32,
    hint: "出门逛月隐镇",
  },
);
const TOWN_OBSTACLES = [
  { x: 383, y: 265, w: 175, h: 87 },
  { x: 70, y: 120, w: 235, h: 126 },
  { x: 735, y: 150, w: 195, h: 145 },
];
const OBSTACLES = [
  { x: 333, y: 376, w: 77, h: 24 },
  { x: 75, y: 140, w: 158, h: 78 },
  { x: 55, y: 210, w: 108, h: 132 },
  { x: 65, y: 326, w: 185, h: 100 },
  { x: 360, y: 214, w: 245, h: 90 },
  { x: 730, y: 265, w: 185, h: 100 },
];
export function canStand(p: Point, space: Space = "shop"): boolean {
  if (space === "town")
    return (
      Number.isFinite(p.x) &&
      Number.isFinite(p.y) &&
      p.x >= 90 &&
      p.x <= 915 &&
      p.y >= 193 &&
      p.y <= 440 &&
      !(p.y > 398 && (p.x < 300 || p.x > 665)) &&
      !TOWN_OBSTACLES.some(
        (r) =>
          p.x > r.x - 9 &&
          p.x < r.x + r.w + 9 &&
          p.y > r.y - 7 &&
          p.y < r.y + r.h + 7,
      )
    );
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  if (p.x < 88 || p.x > 915 || p.y < 178 || p.y > 493) return false;
  if (p.y > 409 && (p.x < 435 || p.x > 529)) return false;
  return !OBSTACLES.some(
    (r) =>
      p.x > r.x - 9 &&
      p.x < r.x + r.w + 9 &&
      p.y > r.y - 7 &&
      p.y < r.y + r.h + 7,
  );
}
export function step(
  p: Point,
  input: Point,
  dt: number,
  space: Space = "shop",
): Point {
  const mag = Math.hypot(input.x, input.y);
  if (!mag || !Number.isFinite(mag)) return { ...p };
  const distance = 140 * Math.max(0, Math.min(0.05, dt));
  const divisor = Math.max(1, mag);
  const x = p.x + (input.x / divisor) * distance,
    y = p.y + (input.y / divisor) * distance;
  const next = { ...p };
  if (canStand({ x, y: p.y }, space)) next.x = x;
  if (canStand({ x: next.x, y }, space)) next.y = y;
  return next;
}
/** Four-neighbour A* on a small fixed grid. Every returned segment remains walkable. */
export function findPath(
  from: Point,
  to: Point,
  space: Space = "shop",
): Point[] {
  if (!canStand(from, space) || !canStand(to, space)) return [];
  const grid = 12,
    key = (p: Point) => `${p.x},${p.y}`;
  const closest = (p: Point) => {
    const choices: Point[] = [];
    for (let dx = -2; dx <= 2; dx++)
      for (let dy = -2; dy <= 2; dy++) {
        const q = {
          x: Math.round(p.x / grid) * grid + dx * grid,
          y: Math.round(p.y / grid) * grid + dy * grid,
        };
        if (canStand(q, space) && clearSegment(p, q, space)) choices.push(q);
      }
    return choices.sort(
      (a, b) =>
        Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
    )[0];
  };
  const start = closest(from),
    goal = closest(to);
  if (!start || !goal) return [];
  const queue: Point[] = [start],
    parents = new Map<string, Point | null>([[key(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (key(p) === key(goal)) {
      const path: Point[] = [to];
      let node: Point | null = p;
      while (node) {
        path.unshift(node);
        node = parents.get(key(node)) ?? null;
      }
      return path;
    }
    for (const d of [
      { x: grid, y: 0 },
      { x: -grid, y: 0 },
      { x: 0, y: grid },
      { x: 0, y: -grid },
    ]) {
      const q = { x: p.x + d.x, y: p.y + d.y },
        k = key(q);
      if (!parents.has(k) && canStand(q, space) && clearSegment(p, q, space)) {
        parents.set(k, p);
        queue.push(q);
      }
    }
  }
  return [];
}
function clearSegment(a: Point, b: Point, space: Space = "shop") {
  const n = Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) / 4);
  for (let i = 1; i <= n; i++)
    if (
      !canStand(
        {
          x: a.x + ((b.x - a.x) * i) / n,
          y: a.y + ((b.y - a.y) * i) / n,
        },
        space,
      )
    )
      return false;
  return true;
}
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);
