# Town relationships implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline, one final independent review.

**Goal:** Playable town, differentiated reputation, consequential multi-day inventory decisions.
**Architecture:** Pure modules for relations, forecasts, contracts/supply and validation; extend the existing turn engine atomically. Reuse movement/window primitives across two scenes; store economic location in the save and positions separately.
**Tech Stack:** Existing React19/TS/Vite/Vitest/Playwright; generated matching pixel environment assets.
**Spec:** docs/superpowers/specs/2026-10-25-town-relations-design.md

## Global Constraints
Preserve publicSite/local saves,8AP/day, free movement/reads/rejection/debt/travel, fixed safe paginated windows, nightly sales preview and simple reports. No immunity from illegal trade. No hidden irreversible cancellation costs. Exact quotes, inventory/cash and seeded persistence.

## Review Focus
- Two contracts competing for same lots must remain fulfillable by priority, and expiry/loss must not duplicate inventory.
- Prepaid transit counts toward capacity/assets and arrives once, including reload/default/terminal boundaries.
- Legacy high reputation grants no invented key history; paid benefits must be effective and bounded.
- Free travel/meet/read must not reset quotes/RNG/AP or allow actions after end/report.
- Town geometry, touch hit targets and safe windows must remain usable on short/portrait layouts.

### Task1 — Pure progression rules
Files: engine/townTypes.ts,relations.ts,forecasts.ts,town.ts,townValidation.ts; tests/town.test.ts.
Interfaces: newTown():TownState; relationRank(s,f):number; townQuote(s,source,product):quote; prepareTown(s), settleContracts(s), reserved(s,product,except?):number; transitValue(s),freeCapacity(s); handleTownAction(s,a):string|undefined.
- [x] RED tests for ranks/actual privileges/diminishing rewards, quote fixedness and forecast effects; contracts acceptance/reservation/FIFO/deadline and transit capacity/asset/reload conservation.
- [x] Implement pure modules, integrate game/types/actions/persistence/economy/events. GREEN targeted + existing logic suite. Commit.

### Task2 — Two scenes and physical honors board
Files: world/model.ts,persistence.ts,useMovement.ts,TownScene.tsx; ShopScene.tsx; App/ShopPanels; generated town/shop honor art.
- [x] RED geometry/position and scene travel tests. Generate environment from accepted room style; move stand-alone reputation to a physical honor board.
- [x] Implement generalized movement with shop defaults, town separate geometry/position, free travel/meta saves and resume. GREEN paths/engine save tests.

### Task3 — Visible town commerce and relationships
Files: ui/TownWindow.tsx,RelationsView.tsx,ContractView.tsx,BoardWindow.tsx,TradeWindow/Inventory/Books/Narrative; town.css.
- [x] Browser RED for travel→meet→new privileges; multi-day accept→reserve→retail→delivery; preorder→reload→arrival; honor board distinct; no scroll at640×320.
- [x] Implement fixed finite pages, explicit terms/remaining AP/availability/benefits; news and milestone notices, upcoming schedule and due reminders. GREEN browser scenarios + build.

### Task4 — Balance, regression, independent review, release
Files: scripts/strategies.ts,balance-town.ts, simulation outputs; README/RULES/ACCEPTANCE/KNOWN-ISSUES and downloads.
- [ ] Run full unit/browser checks and30/100-day strategy simulations with exact cash/assets/stock/AP invariants.
- [ ] Fresh read-only whole-branch reviewer; important fixes RED→GREEN and final regression. Record limitations.
- [ ] Regenerate matching source/static archives, push exact source via existingSites credentials, save/deploy same publicSite and verify terminal success.

## Pre-flight
Task1→2: location persisted economy vs scene position; sharedseed/space namespaces, shop remains default.
Task1→3: contracts, rank/quotes are engine truth; UI only displays and dispatches, never recalculates persisted rewards.
Task1/2/3→4: simulations use transit-aware asset/capacity and contract costs; original strategy control stays comparable.
