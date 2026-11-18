import { test, expect, type Page } from "@playwright/test";
import { createGame, closeDay, act } from "../../src/engine/game";
import { makeOrder } from "../../src/engine/events";
import { SAVE_KEY, encode } from "../../src/engine/persistence";
async function dismissNews(page: Page) {
  const news = page.getByRole("dialog", { name: "每日资讯", exact: true });
  if (await news.count())
    await news.getByRole("button", { name: "收好信件", exact: true }).click();
}
export async function openStation(page: Page, id: string, label: string) {
  await dismissNews(page);
  await page.getByTestId(`station-${id}`).click();
  await expect(
    page.getByRole("dialog", { name: label, exact: true }),
  ).toBeVisible({ timeout: 15000 });
}
export async function closePanel(page: Page) {
  await page.getByRole("button", { name: "关闭", exact: true }).click();
}
export async function endDay(page: Page, day: number) {
  await openStation(page, "sign", "准备开业");
  await page.getByRole("button", { name: "入夜开业", exact: true }).click();
  await page.getByRole("button", { name: "跳至营业收据", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: `第 ${day} 天 · 营业报告`, exact: true }),
  ).toBeVisible();
}
async function fixture(page: Page, s: ReturnType<typeof createGame>) {
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    { key: SAVE_KEY, value: encode(s) },
  );
}
test("walk to shop objects, purchase, price, inspect inventory, close day and restore report", async ({
  page,
}) => {
  test.setTimeout(60000);
  await fixture(page, createGame(77));
  await page.goto("/");
  await openStation(page, "supplies", "商队进货簿");
  await page
    .getByRole("button", { name: "增加治疗药水采购数量", exact: true })
    .click();
  await page.getByRole("button", { name: "采购治疗药水", exact: true }).click();
  await closePanel(page);
  await openStation(page, "shelves", "魔药货架");
  const price = page.getByRole("spinbutton", {
    name: "治疗药水售价",
    exact: true,
  });
  await price.fill("0");
  await price.press("Tab");
  await expect(
    page
      .getByRole("dialog", { name: "魔药货架", exact: true })
      .getByRole("status"),
  ).toContainText("售价须为");
  await price.fill("30");
  await price.press("Tab");
  await closePanel(page);
  await openStation(page, "chest", "仓库箱");
  await page
    .getByRole("button", { name: "第 1 格：治疗药水", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "物品详情", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("第 1 天购入", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "返回仓库", exact: true }).click();
  await closePanel(page);
  await openStation(page, "board", "巷间布告栏");
  await expect(
    page.getByRole("tab", { name: "传闻", exact: true }),
  ).toBeVisible();
  await closePanel(page);
  await openStation(page, "ledger", "基础账本");
  await expect(
    page.getByRole("tab", { name: "每日流水", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("这笔利润从哪里来", { exact: true })).toHaveCount(
    0,
  );
  await closePanel(page);
  await endDay(page, 1);
  await expect(
    page.getByRole("tab", { name: "看懂利润", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "第 1 天 · 营业报告", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "开始第 2 天", exact: true }).click();
  await expect(page.getByRole("main", { name: "月隐巷魔药店" })).toBeVisible();
});
test("keyboard and touch joystick move a real character and modal pauses movement", async ({
  page,
}, info) => {
  await page.goto("/");
  await dismissNews(page);
  const player = page.getByTestId("player");
  const start = Number(await player.getAttribute("data-x"));
  await page.keyboard.down("d");
  await page.waitForTimeout(350);
  await page.keyboard.up("d");
  expect(Number(await player.getAttribute("data-x"))).toBeGreaterThan(
    start + 25,
  );
  if (info.project.name === "mobile-landscape") {
    const box = (await page.getByTestId("joystick").boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const points = [
      { x: box.x + box.width / 2 + 27, y: box.y + box.height / 2, id: 0 },
    ];
    const before = Number(await player.getAttribute("data-x"));
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: points,
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: points[0].x + 65, y: points[0].y, id: 0 }],
    });
    await page.waitForTimeout(300);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    expect(Number(await player.getAttribute("data-x"))).toBeGreaterThan(
      before + 20,
    );
    const stopped = Number(await player.getAttribute("data-x"));
    await page.waitForTimeout(200);
    expect(Number(await player.getAttribute("data-x"))).toBe(stopped);
  }
  await openStation(page, "chest", "仓库箱");
  const x = await player.getAttribute("data-x");
  await page.keyboard.down("d");
  await page.waitForTimeout(200);
  await page.keyboard.up("d");
  expect(await player.getAttribute("data-x")).toBe(x);
  await closePanel(page);
  await page.reload();
  expect(Number(await player.getAttribute("data-x"))).toBeCloseTo(251, 0);
});
test("visitor enters daily and refusal preserves money inventory reputation and actions after reload", async ({
  page,
}) => {
  const s = createGame(12);
  s.batches = [{ id: "stock", product: "healing", qty: 2, cost: 20, day: 1 }];
  await fixture(page, s);
  await page.goto("/");
  await dismissNews(page);
  await page.getByRole("button", { name: "前往来访者", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "今日来客" })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText("实际批次成本", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "拒绝后", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "拒绝公会的补给箱", exact: true })
    .click();
  await closePanel(page);
  await expect(page.getByTestId("visitor")).toHaveCount(0, { timeout: 10000 });
  await page.reload();
  await expect(page.getByTestId("visitor")).toHaveCount(0);
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).state,
    SAVE_KEY,
  );
  expect(saved.cash).toBe(500);
  expect(saved.actions).toBe(0);
  expect(saved.batches[0].qty).toBe(2);
  expect(saved.reputation.guild).toBe(0);
});
test("doctor commission is delivered once and its delayed clinic cooperation survives refresh", async ({
  page,
}) => {
  const s = createGame(20);
  s.chains.plague = {
    stage: "active",
    start: 1,
    end: 6,
    cooldown: 0,
    choice: null,
  };
  s.orders = [makeOrder(s, "doctor")];
  await fixture(page, s);
  await page.goto("/");
  await openStation(page, "supplies", "商队进货簿");
  await page.getByRole("tab", { name: "解毒药剂", exact: true }).click();
  await page
    .getByRole("button", { name: "增加解毒药剂采购数量", exact: true })
    .click();
  await page.getByRole("button", { name: "采购解毒药剂", exact: true }).click();
  await closePanel(page);
  await dismissNews(page);
  await page.getByRole("button", { name: "前往来访者", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "今日来客" })).toBeVisible({
    timeout: 15000,
  });
  await expect(
    page.getByText("两天后开启诊所合作", { exact: false }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "接受医生的请求", exact: true })
    .click();
  await closePanel(page);
  await page.reload();
  let saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).state,
    SAVE_KEY,
  );
  expect(saved.delayed.length).toBe(1);
  expect(saved.actions).toBe(1);
  expect(saved.book.orderRevenue).toBe(42);
  for (let day = 1; day <= 2; day++) {
    await endDay(page, day);
    await page
      .getByRole("button", { name: `开始第 ${day + 1} 天`, exact: true })
      .click();
  }
  await page.reload();
  saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).state,
    SAVE_KEY,
  );
  expect(saved.orders.some((o: any) => o.kind === "clinic")).toBe(true);
});
test("another tab blocks stale economic actions and refresh reads the winning save", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await openStation(page, "ledger", "基础账本");
  const other = await context.newPage();
  await other.goto("/");
  await openStation(other, "supplies", "商队进货簿");
  await other
    .getByRole("button", { name: "采购治疗药水", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 1000 });
  await expect(page.getByRole("alert")).toContainText("另一个标签页");
  await page.bringToFront();
  await page
    .getByRole("button", { name: "刷新读取新进度", exact: true })
    .click();
  await openStation(page, "chest", "仓库箱");
  await page
    .getByRole("button", { name: "第 1 格：治疗药水", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "物品详情", exact: true }),
  ).toBeVisible();
});
test("damaged saves remain protected until a deliberate new run", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    if (!sessionStorage.getItem("injected")) {
      localStorage.setItem(key, "{broken");
      sessionStorage.setItem("injected", "1");
    }
  }, SAVE_KEY);
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("存档格式无效");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY),
  ).toBe("{broken");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "重读今日来信", exact: true }).click();
  await page.getByRole("button", { name: "收好信件", exact: true }).click();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY),
  ).toBe("{broken");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "重新开局", exact: true }).click();
  await page.getByRole("button", { name: "开始新一轮", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).state.day,
      SAVE_KEY,
    ),
  ).toBe(1);
});
test("bankruptcy screen restarts into a playable shop", async ({ page }) => {
  const s = createGame(2);
  s.cash = 0;
  s.status = "default";
  s.arrears = 24;
  s.defaultSince = 1;
  s.day = 3;
  const ended = closeDay(s, 3).state;
  await fixture(page, ended);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "店铺歇业了", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "重新开始", exact: true }).click();
  await expect(page.getByTestId("player")).toBeVisible();
  await expect(page.getByTestId("cash")).toHaveText("500 G");
});
