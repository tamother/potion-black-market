import { test, expect, type Page } from "@playwright/test";
import { createGame } from "../../src/engine/game";
import { encode, SAVE_KEY } from "../../src/engine/persistence";
async function noScroll(page: Page) {
  const box = page.locator("dialog[open], .owl-bulletin:not([hidden])").last();
  expect(
    await box.evaluate((el) => ({
      y: el.scrollHeight > el.clientHeight + 1,
      x: el.scrollWidth > el.clientWidth + 1,
    })),
  ).toEqual({ y: false, x: false });
  const body = box.locator("[data-window-content]");
  expect(
    await body.evaluate(
      (el) =>
        el.scrollHeight <= el.clientHeight + 1 &&
        el.scrollWidth <= el.clientWidth + 1,
    ),
  ).toBe(true);
}
async function dismissNews(page: Page) {
  const news = page.getByRole("dialog", { name: "每日资讯", exact: true });
  if (await news.count())
    await news.getByRole("button", { name: "收好信件", exact: true }).click();
}
test("owl briefs the player automatically once per day and survives a refresh", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto("/");
  await expect(
    page.getByRole("dialog", { name: "每日资讯", exact: true }),
  ).toBeVisible();
  await noScroll(page);
  await expect(
    page.getByRole("heading", { name: "小夜的开店来信", exact: true }),
  ).toBeVisible();
  await dismissNews(page);
  await page.reload();
  await expect(
    page.getByRole("dialog", { name: "每日资讯", exact: true }),
  ).toHaveCount(0);
  await page.getByTestId("station-sign").click();
  await page.getByRole("button", { name: "入夜开业", exact: true }).click();
  await page.getByRole("button", { name: "跳至营业收据", exact: true }).click();
  await noScroll(page);
  await page.getByRole("button", { name: "开始第 2 天", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "每日资讯", exact: true }),
  ).toBeVisible();
});
test("inventory is an icon-only grid and clicking a bottle opens its actual batch details", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 360 });
  const s = createGame(8);
  s.day = 3;
  s.batches = [
    { id: "a", product: "healing", qty: 1, cost: 20, day: 1 },
    { id: "b", product: "healing", qty: 2, cost: 31, day: 3 },
  ];
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    { key: SAVE_KEY, value: encode(s) },
  );
  await page.goto("/");
  await dismissNews(page);
  await page.getByTestId("station-chest").click();
  await expect(
    page.getByRole("dialog", { name: "仓库箱", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  const grid = page.getByRole("grid", { name: "仓库格子" });
  await expect(grid.locator('[role="gridcell"]')).toHaveCount(30);
  expect(await grid.innerText()).toBe("");
  await noScroll(page);
  await page
    .getByRole("button", { name: "第 2 格：治疗药水", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "物品详情", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("31 G", { exact: true })).toBeVisible();
  await expect(page.getByText("第 3 天购入", { exact: true })).toBeVisible();
  await noScroll(page);
  await page.getByRole("button", { name: "返回仓库", exact: true }).click();
  await expect(grid).toBeVisible();
});
