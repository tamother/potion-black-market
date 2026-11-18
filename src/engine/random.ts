export function random(s: { rng: number }): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const clamp = (n: number, low: number, high: number) =>
  Math.max(low, Math.min(high, n));
export const integer = (n: number) => Number.isSafeInteger(n) && n >= 0;
