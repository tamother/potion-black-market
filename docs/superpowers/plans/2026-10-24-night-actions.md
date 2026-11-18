# Night actions implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline, with one final independent review.

**Goal:** 有限的白天准备、可见的夜间营业与舒适的触屏移动。
**Architecture:** Pure engine AP accounting; deterministic presentation-only basket model; transient React night playback after persisted closeDay. Retain legacy save format2 with validated additive migration.
**Tech Stack:** React19, TypeScript, Vite, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-10-24-night-action-design.md

## Global Constraints
8AP/day, buy1/price1/order2/hire1/crystal1/ward1; free navigation, reads, rejection, debt relief, opening. Final saved ledger is source of truth; no RNG in replay. Preserve public Site and pixel art, safe compact windows and simple reports.

## Review Focus
- Interrupted playback/reload must never repeat settlement or leave a persistent lock.
- Zero AP and default status must permit debt rescue and opening.
- Invalid repeated actions must not mutate AP/cash/stock/RNG.
- Wide touch areas must preserve actionable room objects and stop movement on owner cancellation.
- Actual baskets, visitor sprites and floating receipts must match sold bottles and retail income; closing deductions remain clear.

### Task 1: Engine/action budget and replay receipts
Files: engine/actions.ts (new), engine/game.ts/types.ts/config.ts/persistence.ts; world/night.ts (new); tests/action-points.test.ts and night.test.ts.
Interfaces: actionCost(state, action):number; remainingActions(state):number; nightBaskets(row):Basket[].
- [x] Write failing tests for action exhaustion, no-op/free/failed operations, migration/reset, basket conservation and empty night.
- [x] Run targeted Vitest, verify RED; implement validations and pure baskets; verify GREEN plus full unit suite.
- [x] Commit engine and regression evidence.

### Task 2: Room/control/windows/night presentation
Files: world/Joystick.tsx, model.ts, ShopScene.tsx, NightTrade.tsx(new), night.css(new); App.tsx; UI Books/Trade/Crystal/NarrativeWindows.
Consumes: AP helpers, nightBaskets; final closeDay result.
- [x] Write browser scenarios covering AP labels/exhaustion, broad touch origin, below-desk ledger, small crystal, finance tabs, night receipts/reload/speed/skip.
- [x] Observe failures then implement, with exact object coordinates and strings from spec. Use transparent window pointer handlers so buttons remain reachable.
- [x] Verify focused scenarios, all dense windows and existing flows; build production; inspect desktop/mobile screenshots and console.
- [x] Commit runtime/UI/tests.

### Task 3: Balance, docs, independent review and publication
Files: simulation outputs; docs README/RULES/KNOWN-ISSUES/ACCEPTANCE; downloadable artifacts.
- [x] Run 900 three-strategy and 900 risk balance cases with AP budgets; inspect viability and daily guards.
- [x] Review entire diff with a fresh reviewer. Fix important findings with RED→GREEN regression tests; run final suites/build.
- [ ] Refresh source/static downloads, commit final archive, push exact source to existing native Sites repository, save and deploy public Site. Native success is publication evidence; record browser/device limits.

## Execution evidence

Task1: 56466cb;6 new AP/basket regressions RED→GREEN; all84 unit tests pass. Task2:28c1170; wide origin/position/AP/replay tests12/12; short footer RED→GREEN; pressed station reduced-motion case RED→GREEN; desktop/mobile screenshots checked.1800 simulations regenerated with AP guards.

Final independent review: night_actions_review, range dea29ff..28c1170. Two Important findings fixed in2097242: save failure now preserves planning state and permits atomic retry; terminal games expose saved final-night receipt. Four desktop/mobile regression cases RED→GREEN. Physical devices/Safari and new-player subjective balance require actual playtesting; publication verified separately by native Sites success. No deferred code findings.

The added final receipt tab changes the old dense-window helper's last-view assumption; helper now checks its tabs/pages and returns to the ending screen before asserting final assets. Final browser result and publication are recorded in completion-report.md; no app runtime change for this helper update.

Dense terminal-window regression helper updated for receipt→return navigation; touch-origin movement assertion now polls real displacement instead of assuming350ms of animation frames during concurrent browser load. These are test harness corrections, with no runtime change.

Final verification:84/84 unit tests; TypeScript/Vite build pass. Complete66-case browser run:63 passed,3 failures (old terminal-view assumption; two fixed350ms movement timings under concurrent load). Corrected helpers/assertions, then final ending-fit2/2, touch-origin2/2, owl-reading2/2 passed. All66 unique scenarios verified on unchanged final runtime; no additional runtime edits after2097242. Publication archive/source preparation complete only after the matching final build; native publication result is the final authority.
