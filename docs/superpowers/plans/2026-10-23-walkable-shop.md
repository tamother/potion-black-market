# Implementation plan: walkable potion shop
Spec: ../specs/2026-10-23-walkable-shop-design.md

Global: preserve seed-based game engine, existing save key/version2 and old saves. Work in clean dedicated `work` branch. User accepted landscape + original room proposal and delegated routine details. Assets generated before UI implementation. Use native implementation in this session; one whole-branch fresh review at end.

1. Engine/accountant + original orders.
- Files: engine/types, config, game, events, persistence, explanations; tests/room-economy.test.
- Add accountantHiredDay nullable; book staffCost, optional ledger staffCost; hire-accountant action120G once, active/planning only. Op profit and cash flow expense reconciled; migrate absent keys without changing funds. No unlock inferred from old detailed ledger.
- Restore ordinary quotes to original base66/112 * factor, no random ratio; ensure daily order on empty days incl day1, finalize new ordinary orders after daily market. Test old saves, cost conservation, locks, refusal, quote invariance and all-day visitor.
- RED tests, GREEN code, existing tests adjusted for explicitly replaced random bulk behavior; commit.
2. Room geometry/controller/persistence.
- Files: world/model.ts, world/persistence.ts, tests/world.test.
- Logical960x540, collision floor bounds, furniture, radius9, normalized movement, frame cap, grid16 pathfinding and nearest station interactions. Persist seed-bound walkable position/facing. Tests every station reachable, walls solid, diagonal speed and large-dt clamp, invalid/other-seed save safe spawn.
- RED tests then code, commit.
3. Game presentation.
- Files world/ShopScene, Sprite, useMovement, audio, room.css, components/ShopPanels, BasicLedger, FinanceDesk, VisitorDialog; App slim state/save composition; Dialogs basic Report with gated analyst controls. Existing Warehouse/Events reused; Market purchase/pricing mode; old financial LedgerPage inaccessible and additionally gated.
- Extract color/font/frame tokens from concept and refined asset. Render main actual game, not webpage. Actor/art atlas and hit regions correspond to geometry. Touch joystick with pointer capture; keyboard reset on focus loss/modal; click station path, proximity opens only in range. NPC enters once per day and resolved visitor exits. Animated glow/motes, audio toggle. Real panels with close/back keyboard; no result spoilers in orders. Accountant absent until hire, desk contract then NPC detailed consultation. Portrait prompt dismissible, settings help/restart/mute.
- Meaningful browser tests written for new actual navigation; desktop + mobile landscape. Keep report restoration and CAS protections. Verify build/screenshots against concepts, no console errors, 640x360,844x390,1024x600,1440x900 + portrait fallback.
4. Validation/release.
- Full unit/build/E2E; 900 seeded simulations incl staff cash-flow invariant. Fresh branch review of controls, staff gate, save migration and collision. Fix material findings with regression tests.
- Update README/RULES/KNOWN-ISSUES/ACCEPTANCE and download report. Source zip from source commit, static zip from exact matching build (exclude downloads). Commit downloads, build, secure push exact HEAD to existing Sites remote, archive/save/deploy preserving public audience. Native deployment success is sufficient verification; external Site domain blocked by current proxy, don't claim live browser test.

Review focus: mobile pointer cancellation and overlay focus; collision around desk/door; no economic actions through report/conflict; no profit explanations before hire via history/report routes; one-time hire cost in income/cashflow/netassets and old-save migration.
