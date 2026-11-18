import type { Batch, GameState } from "../engine/types";
export function textPages(text: string, limit = 88): string[] {
  const chars = Array.from(text),
    size = Math.max(1, Math.floor(limit) || 88),
    pages: string[] = [];
  for (let i = 0; i < chars.length; i += size)
    pages.push(chars.slice(i, i + size).join(""));
  return pages.length ? pages : [""];
}
export function inventorySlots(s: GameState): (Batch | null)[] {
  const bottles = s.batches
    .slice()
    .sort((a, b) => a.day - b.day)
    .flatMap((b) => Array.from({ length: b.qty }, () => b));
  return Array.from({ length: s.capacity }, (_, i) => bottles[i] ?? null);
}
