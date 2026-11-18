import { test, expect, type Page } from "@playwright/test";
import { createGame, act } from "../../src/engine/game";
import { encode, SAVE_KEY } from "../../src/engine/persistence";
async function inject(page: Page, s: ReturnType<typeof createGame>) {
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    { key: SAVE_KEY, value: encode(s) },
  );
  await page.goto("/");
}
async function news(page: Page) {
  const d = page.getByRole("dialog", { name: "每日资讯", exact: true });
  if (await d.count())
    await d.getByRole("button", { name: "收好信件", exact: true }).click();
}
async function station(page: Page, id: string, label: string) {
  await news(page);
  await page.getByTestId(`station-${id}`).click();
  await expect(
    page.getByRole("dialog", { name: label, exact: true }),
  ).toBeVisible({ timeout: 15000 });
}
test("hired accountant still leaves a simple closing report, salary is paid and analysis is next-day only", async ({
  page,
}) => {
  await inject(page, act(createGame(9), { type: "hire-accountant" }).state);
  await station(page, "sign", "准备开业");
  await page.getByRole("button", { name: "入夜开业", exact: true }).click();
  await page.getByRole("button", { name: "跳至营业收据", exact: true }).click();
  await expect(page.getByRole("tab")).toHaveText([
    "收支记录",
    "售出药水",
    "纪事",
  ]);
  await expect(page.getByLabel("利润解释")).toHaveCount(0);
  await page.getByRole("button", { name: "开始第 2 天", exact: true }).click();
  await news(page);
  await page.getByRole("button", { name: "前往财务人员", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "财务咨询", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await page.getByRole("tab", { name: "费用", exact: true }).click();
  await expect(page.getByText("埃德温日薪", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      (key) =>
        JSON.parse(localStorage.getItem(key)!).state.ledger[0].staffSalary,
      SAVE_KEY,
    ),
  ).toBe(10);
});
test("merchant first arrives after five completed days, sells a persistent crystal with a once-daily paid ward", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 320 });
  const s = createGame(11);
  s.day = 5;
  await inject(page, s);
  await news(page);
  await expect(page.getByTestId("merchant")).toHaveCount(0);
  await expect(page.locator(".room-art")).toHaveAttribute(
    "src",
    "/world/shop-honors.webp",
  );
  await station(page, "sign", "准备开业");
  await page.getByRole("button", { name: "入夜开业", exact: true }).click();
  await page.getByRole("button", { name: "跳至营业收据", exact: true }).click();
  await page.getByRole("button", { name: "开始第 6 天", exact: true }).click();
  await news(page);
  await expect(page.getByTestId("merchant")).toBeVisible();
  await page.getByRole("button", { name: "前往黑市商人", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "黑市商人", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "购入水晶球", exact: true }).click();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(page.getByTestId("merchant")).toHaveCount(0);
  await expect(page.getByTestId("station-crystal")).toBeVisible();
  await expect(page.locator(".crystal-environment")).toHaveCount(1);
  await expect(page.locator(".room-art")).toHaveAttribute(
    "src",
    "/world/shop-honors.webp",
  );
  await station(page, "crystal", "水晶球");
  await page.getByRole("button", { name: "施放护店结界", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "今晚已设结界", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.locator(".room-art")).toHaveAttribute(
    "src",
    "/world/shop-honors.webp",
  );
  await station(page, "crystal", "水晶球");
  await expect(
    page.getByRole("button", { name: "今晚已设结界", exact: true }),
  ).toBeDisabled();
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).state,
    SAVE_KEY,
  );
  expect(saved.crystalUnlockedDay).toBe(6);
  expect(saved.wardDay).toBe(6);
  expect(saved.book.crystalCost).toBe(168);
});
