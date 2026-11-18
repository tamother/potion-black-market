import { test, expect, type Page } from "@playwright/test";
import { createGame } from "../../src/engine/game";
import { encode, SAVE_KEY } from "../../src/engine/persistence";
const load = async (page: Page, s = createGame(19)) => {
  s.newsReadDay = s.day;
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    { key: SAVE_KEY, value: encode(s) },
  );
  await page.goto("/");
};
const station = async (page: Page, id: string, name: string) => {
  await page.getByTestId(`station-${id}`).click();
  await expect(page.getByRole("dialog", { name, exact: true })).toBeVisible({
    timeout: 15000,
  });
};
test("left-side large-area touch spawns a centered stick, drags outside it, then stops", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await load(page);
  const cdp = await page.context().newCDPSession(page),
    p = page.getByTestId("player");
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 300, y: 205, id: 1 }],
  });
  const box = (await page.getByTestId("joystick").boundingBox())!;
  expect(box.x + box.width / 2).toBeCloseTo(300, 0);
  expect(box.y + box.height / 2).toBeCloseTo(205, 0);
  const start = Number(await p.getAttribute("data-x"));
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 650, y: 205, id: 1 }],
  });
  await expect
    .poll(async () => Number(await p.getAttribute("data-x")), { timeout: 3000 })
    .toBeGreaterThan(start + 25);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(80);
  const end = await p.getAttribute("data-x");
  await page.waitForTimeout(200);
  expect(await p.getAttribute("data-x")).toBe(end);
});
test("environment crystal appears on bottom-left crate and ledger opens from below the desk; finance has no formula", async ({
  page,
}) => {
  const s = createGame(19);
  s.day = 6;
  s.accountantHiredDay = 1;
  s.crystalUnlockedDay = 6;
  await load(page, s);
  await expect(page.locator(".room-art")).toHaveAttribute(
    "src",
    "/world/shop-honors.webp",
  );
  await expect
    .poll(async () =>
      page
        .locator(".room-art")
        .evaluate(
          (el) =>
            (el as HTMLImageElement).complete &&
            (el as HTMLImageElement).naturalWidth > 0,
        ),
    )
    .toBe(true);
  await expect(page.locator(".world-crystal")).toHaveCount(0);
  await expect(page.locator(".crystal-environment")).toHaveCount(1);
  await station(page, "ledger", "基础账本");
  expect(
    Number(await page.getByTestId("player").getAttribute("data-y")),
  ).toBeGreaterThan(375);
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "前往财务人员", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "财务咨询", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("tab")).toHaveText([
    "利润",
    "现金",
    "费用",
    "销量",
  ]);
});
test("zero AP leaves informative costs and free opening reachable", async ({
  page,
}) => {
  const s = createGame(19);
  s.actionPointsUsed = 8;
  await load(page, s);
  await expect(page.getByLabel("今日行动力")).toContainText("0 / 8");
  await station(page, "supplies", "商队进货簿");
  await expect(
    page.getByRole("button", { name: "采购治疗药水", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("行动力已用完", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await station(page, "sign", "准备开业");
  await page.getByRole("button", { name: "入夜开业", exact: true }).click();
  await expect(page.getByLabel("夜市营业")).toBeVisible();
  await page.getByRole("button", { name: "跳至营业收据", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "营业报告", exact: true }),
  ).toBeVisible();
});
test("night customers and coins replay actual receipts; refresh never repeats the saved settlement", async ({
  page,
}) => {
  const s = createGame(19);
  s.batches = [{ id: "stock", product: "healing", qty: 6, cost: 20, day: 1 }];
  await load(page, s);
  await station(page, "sign", "准备开业");
  await page.getByRole("button", { name: "入夜开业", exact: true }).click();
  await expect(page.getByLabel("夜市营业")).toBeVisible();
  await expect(page.getByTestId("night-customer").first()).toBeVisible();
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).state,
    SAVE_KEY,
  );
  expect(saved.phase).toBe("report");
  expect(saved.ledger).toHaveLength(1);
  await page.getByRole("button", { name: "营业速度4倍", exact: true }).click();
  await expect(page.getByTestId("coin-receipt").first()).toBeVisible({
    timeout: 5000,
  });
  await page.reload();
  await expect(
    page.getByRole("dialog", { name: "营业报告", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).state,
      SAVE_KEY,
    ),
  ).toEqual(saved);
});
test("short landscape night controls stay near the bottom within cutout margins", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 320 });
  const s = createGame(19);
  s.batches = [{ id: "h", product: "healing", qty: 4, cost: 20, day: 1 }];
  await load(page, s);
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--safe-left", "40px");
    document.documentElement.style.setProperty("--safe-bottom", "20px");
  });
  await station(page, "sign", "准备开业");
  await page.getByRole("button", { name: "入夜开业", exact: true }).click();
  const b = (await page
    .getByRole("button", { name: "跳至营业收据", exact: true })
    .boundingBox())!;
  expect(b.y + b.height).toBeGreaterThan(270);
  expect(b.y + b.height).toBeLessThanOrEqual(288);
  expect(
    (await page.locator(".night-summary").boundingBox())!.x,
  ).toBeGreaterThanOrEqual(52);
});
test("empty nights finish automatically, and reduced-motion players go straight to receipts", async ({
  page,
}) => {
  await load(page);
  await station(page, "sign", "准备开业");
  await page.getByRole("button", { name: "入夜开业", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "营业报告", exact: true }),
  ).toBeVisible({ timeout: 4000 });
  await page.getByRole("button", { name: "开始第 2 天", exact: true }).click();
  const news = page.getByRole("dialog", { name: "每日资讯", exact: true });
  if (await news.count())
    await news.getByRole("button", { name: "收好信件", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await station(page, "sign", "准备开业");
  await page.getByRole("button", { name: "入夜开业", exact: true }).click();
  await expect(page.getByLabel("夜市营业")).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "营业报告", exact: true }),
  ).toBeVisible();
});
test("failed settlement save leaves the old planning turn intact and permits one clean retry", async ({
  page,
}) => {
  await load(page);
  await station(page, "sign", "准备开业");
  const before = await page.evaluate(
    (key) => localStorage.getItem(key),
    SAVE_KEY,
  );
  await page.evaluate((key) => {
    const proto = Storage.prototype;
    (window as any).__nightSet = proto.setItem;
    proto.setItem = function (k: string, v: string) {
      if (k === key) throw new DOMException("Full", "QuotaExceededError");
      return (window as any).__nightSet.call(this, k, v);
    };
  }, SAVE_KEY);
  await page.getByRole("button", { name: "入夜开业", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "准备开业", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("夜市营业")).toHaveCount(0);
  await expect(
    page
      .getByRole("dialog", { name: "准备开业", exact: true })
      .getByRole("status"),
  ).toContainText("尚未开业");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY),
  ).toBe(before);
  await expect(page.getByTestId("cash")).toHaveText("500 G");
  await page.evaluate(() => {
    Storage.prototype.setItem = (window as any).__nightSet;
  });
  await page.getByRole("button", { name: "入夜开业", exact: true }).click();
  await page.getByRole("button", { name: "跳至营业收据", exact: true }).click();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).state.ledger.length,
      SAVE_KEY,
    ),
  ).toBe(1);
});
test("terminal nights retain their actual final receipt and deductions after reload", async ({
  page,
}) => {
  const s = createGame(19);
  s.day = 3;
  s.cash = 0;
  s.book.openingCash = 0;
  s.status = "default";
  s.arrears = 300;
  s.defaultSince = 1;
  s.batches = [{ id: "last", product: "mana", qty: 2, cost: 35, day: 1 }];
  await load(page, s);
  await station(page, "sign", "准备开业");
  await page.getByRole("button", { name: "入夜开业", exact: true }).click();
  await page.getByRole("button", { name: "跳至营业收据", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "经营结束", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "最后一晚收据", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "营业报告", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "返回经营结局", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "纪事", exact: true }).click();
  await expect(page.getByText("今天发生的事", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "返回经营结局", exact: true }).click();
  await page.reload();
  await page.getByRole("tab", { name: "最后一晚收据", exact: true }).click();
  await page.getByRole("tab", { name: "售出药水", exact: true }).click();
  await expect(page.getByText("2 瓶", { exact: true })).toBeVisible();
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).state,
    SAVE_KEY,
  );
  expect(saved.ledger).toHaveLength(1);
  expect(saved.status).toBe("ended");
});
