import { it, expect } from "vitest";
import { createGame, act, closeDay } from "../src/engine/game";
import { encode, decode } from "../src/engine/persistence";
it("daily briefing acknowledgement persists once without changing money RNG inventory or actions", () => {
  const s = createGame(17);
  expect(s.newsReadDay).toBe(0);
  const n = act(s, { type: "ack-news" }).state;
  expect(n.newsReadDay).toBe(1);
  expect(n.revision).toBe(s.revision + 1);
  expect(n.rng).toBe(s.rng);
  expect(n.cash).toBe(s.cash);
  expect(n.book).toEqual(s.book);
  expect(n.actions).toBe(0);
  expect(s.newsReadDay).toBe(0);
  expect(decode(encode(n))).toEqual(n);
  expect(act(n, { type: "ack-news" }).state).toBe(n);
});
it("new day needs a new briefing only after the previous day report is acknowledged", () => {
  const s = act(createGame(17), { type: "ack-news" }).state,
    n = closeDay(s, 1).state;
  expect(n.newsReadDay).toBe(1);
  expect(n.day).toBe(2);
  expect(act(n, { type: "ack-news" }).error).toBeTruthy();
  const open = act(n, { type: "ack" }).state;
  expect(act(open, { type: "ack-news" }).state.newsReadDay).toBe(2);
});
it("old saves get an unread briefing without losing progress and invalid dates are rejected", () => {
  const raw = JSON.parse(encode(createGame(5)));
  delete raw.state.newsReadDay;
  const s = decode(JSON.stringify(raw));
  expect(s.newsReadDay).toBe(0);
  expect(s.cash).toBe(500);
  raw.state.newsReadDay = 2;
  expect(() => decode(JSON.stringify(raw))).toThrow();
});
