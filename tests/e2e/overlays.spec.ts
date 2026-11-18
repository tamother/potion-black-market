import { test, expect } from "@playwright/test";
import { createGame } from "../../src/engine/game";
import { encode, SAVE_KEY } from "../../src/engine/persistence";
test("owl news is a small automatic scene bubble that permits walking and can resume after a shop window", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/");
  const news = page.getByRole("dialog", { name: "每日资讯", exact: true });
  await expect(news).toBeVisible();
  expect(await news.evaluate((el) => el instanceof HTMLDialogElement)).toBe(
    false,
  );
  const box = (await news.boundingBox())!;
  expect(box.width).toBeLessThan(520);
  expect(box.height).toBeLessThan(180);
  const x = Number(await page.getByTestId("player").getAttribute("data-x"));
  await page.keyboard.down("d");
  await expect
    .poll(
      async () =>
        Number(await page.getByTestId("player").getAttribute("data-x")),
      { timeout: 3000 },
    )
    .toBeGreaterThan(x + 20);
  await page.keyboard.up("d");
  await page.getByTestId("station-chest").click();
  await expect(
    page.getByRole("dialog", { name: "仓库箱", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(news).toBeHidden();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(news).toBeVisible();
  await page.getByRole("button", { name: "收好信件", exact: true }).click();
  await page.reload();
  await expect(news).toHaveCount(0);
});
test("single-page owl news dismisses itself and saves its daily read state", async ({
  page,
}) => {
  const s = createGame(16);
  s.news = ["小夜轻轻落在窗边，带来今夜的消息。"];
  await page.addInitScript(({ k, v }) => localStorage.setItem(k, v), {
    k: SAVE_KEY,
    v: encode(s),
  });
  await page.goto("/");
  const news = page.getByRole("dialog", { name: "每日资讯", exact: true });
  await expect(news).toBeVisible();
  await expect(news).toHaveCount(0, { timeout: 10000 });
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)!).state.newsReadDay,
      SAVE_KEY,
    ),
  ).toBe(1);
});
test("compact markers, readable buttons and dialog boundaries respect simulated cutouts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/");
  await page.getByRole("button", { name: "收好信件", exact: true }).click();
  await page
    .getByRole("button", { name: "前往来访者", exact: true })
    .waitFor({ timeout: 10000 });
  const marker = page.locator(".visitor-marker");
  expect(
    await marker.evaluate(
      (el) =>
        el.getBoundingClientRect().height /
        Number(
          (el.closest(".room-world") as HTMLElement).style.transform.match(
            /[\d.]+/,
          )![0],
        ),
    ),
  ).toBeLessThanOrEqual(32);
  await page.evaluate(() => {
    for (const [p, v] of Object.entries({
      "--safe-left": "64px",
      "--safe-right": "32px",
      "--safe-top": "24px",
      "--safe-bottom": "20px",
    }))
      document.documentElement.style.setProperty(p, v);
  });
  await page.getByTestId("station-sign").click();
  const dialog = page.getByRole("dialog", { name: "准备开业", exact: true });
  await expect(dialog).toBeVisible({ timeout: 15000 });
  const b = (await dialog.boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(76);
  expect(b.y).toBeGreaterThanOrEqual(36);
  expect(b.x + b.width).toBeLessThanOrEqual(844 - 44);
  expect(b.y + b.height).toBeLessThanOrEqual(390 - 32);
  const button = page.getByRole("button", { name: "继续备货", exact: true });
  expect(await button.evaluate((el) => getComputedStyle(el).textShadow)).toBe(
    "none",
  );
});
