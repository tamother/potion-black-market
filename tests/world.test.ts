import { it, expect } from "vitest";
import { canStand, step, findPath, STATIONS, SPAWN } from "../src/world/model";
import {
  loadPosition,
  storePosition,
  ROOM_KEY,
} from "../src/world/persistence";
it("walls, furniture and closed edges block feet; aisles and entrance remain walkable", () => {
  expect(canStand({ x: 480, y: 350 })).toBe(true);
  expect(canStand({ x: 170, y: 180 })).toBe(false);
  expect(canStand({ x: 800, y: 300 })).toBe(false);
  expect(canStand({ x: 480, y: 475 })).toBe(true);
  expect(canStand({ x: 700, y: 480 })).toBe(false);
  expect(canStand({ x: 480, y: 120 })).toBe(false);
});
it("every station can be reached by walking without crossing a wall", () => {
  for (const station of STATIONS) {
    expect(canStand(station.approach), station.id).toBe(true);
    const path = findPath(SPAWN, station.approach);
    expect(path.length, station.id).toBeGreaterThan(0);
    expect(path.every((p) => canStand(p))).toBe(true);
    expect(path.at(-1)).toEqual(station.approach);
  }
  expect(findPath(SPAWN, { x: 800, y: 300 })).toEqual([]);
});
it("diagonal speed is normalized, stalled frames capped, and wall motion slides safely", () => {
  const p = { x: 480, y: 350 };
  const a = step(p, { x: 1, y: 0 }, 0.04),
    b = step(p, { x: 1, y: 1 }, 0.04);
  expect(Math.hypot(a.x - p.x, a.y - p.y)).toBeCloseTo(
    Math.hypot(b.x - p.x, b.y - p.y),
  );
  expect(Math.hypot(step(p, { x: 1, y: 0 }, 5).x - p.x, 0)).toBeLessThanOrEqual(
    7,
  );
  let pos = { x: 705, y: 300 };
  for (let i = 0; i < 30; i++) pos = step(pos, { x: 1, y: 0 }, 0.016);
  expect(pos.x).toBeLessThan(722);
});
it("position persists for this run and rejects damaged, blocked or other-run data", () => {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
  storePosition(storage, 12, { x: 480, y: 350, facing: "left" });
  expect(loadPosition(storage, 12)).toEqual({ x: 480, y: 350, facing: "left" });
  expect(loadPosition(storage, 13)).toEqual(SPAWN);
  map.set(
    ROOM_KEY,
    JSON.stringify({ seed: 12, x: 800, y: 300, facing: "left" }),
  );
  expect(loadPosition(storage, 12)).toEqual(SPAWN);
  map.set(ROOM_KEY, "{broken");
  expect(loadPosition(storage, 12)).toEqual(SPAWN);
});
it("central service counter blocks feet while both side aisles and the visitor queue stay clear", () => {
  expect(canStand({ x: 480, y: 265 })).toBe(false);
  expect(canStand({ x: 330, y: 265 })).toBe(true);
  expect(canStand({ x: 635, y: 265 })).toBe(true);
  for (let y = 350; y <= 490; y += 5)
    expect(canStand({ x: 480, y })).toBe(true);
});
