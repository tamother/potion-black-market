import { it, expect } from "vitest";
import { textPages, inventorySlots } from "../src/ui/paging";
import { createGame } from "../src/engine/game";
it("long Unicode records preserve all text while fitting finite page budgets", () => {
  const text = "猫头鹰🦉带来了一封新信。".repeat(50),
    pages = textPages(text, 72);
  expect(pages.join("")).toBe(text);
  expect(pages.every((p) => Array.from(p).length <= 72)).toBe(true);
  expect(pages.length).toBeGreaterThan(1);
  expect(textPages("", 72)).toEqual([""]);
});
it("inventory slots retain each physical bottle and its source batch without merging costs", () => {
  const s = createGame(7);
  s.batches = [
    { id: "old", product: "healing", qty: 1, cost: 20, day: 1 },
    { id: "new", product: "healing", qty: 2, cost: 31, day: 1 },
  ];
  const slots = inventorySlots(s);
  expect(slots.length).toBe(30);
  expect(slots[0]?.id).toBe("old");
  expect(slots[1]?.id).toBe("new");
  expect(slots[2]?.cost).toBe(31);
  expect(slots.slice(3).every((x) => x === null)).toBe(true);
});
