import { test, expect, type Page } from "@playwright/test";
import { createGame, closeDay, act } from "../../src/engine/game";
import { SAVE_KEY, encode } from "../../src/engine/persistence";
async function dismissNews(page: Page) {
  const news = page.getByRole("dialog", { name: "每日资讯", exact: true });
  if (await news.count())
    await news.getByRole("button", { name: "收好信件", exact: true }).click();
}
async function station(page: Page, id: string, label: string) {
  await dismissNews(page);
  await page.getByTestId(`station-${id}`).click();
  await expect(
    page.getByRole("dialog", { name: label, exact: true }),
  ).toBeVisible({ timeout: 15000 });
}
async function close(page: Page) {
  await page.getByRole("button", { name: "关闭", exact: true }).click();
}
function history() {
  let s = createGame(91);
  s.batches = [
    { id: "h", product: "healing", qty: 8, cost: 20, day: 1 },
    { id: "i", product: "invisibility", qty: 3, cost: 60, day: 1 },
  ];
  s.prices.healing = Math.floor(s.market.healing.reference * 1.6);
  s.prices.invisibility = Math.floor(s.market.invisibility.reference * 1.6);
  return closeDay(s, 1).state;
}
async function inject(page: Page, s: ReturnType<typeof createGame>) {
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    { key: SAVE_KEY, value: encode(s) },
  );
}
test("financial explanations are gated in reports and books until paid hiring, then persist", async ({
  page,
}) => {
  const s = history();
  await inject(page, s);
  await page.goto("/");
  await expect(
    page.getByRole("tab", { name: "看懂利润", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("各商品销量解释")).toHaveCount(0);
  await page.getByRole("button", { name: "开始第 2 天", exact: true }).click();
  await station(page, "ledger", "基础账本");
  await expect(
    page.getByRole("tab", { name: "每日流水", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("利润解释")).toHaveCount(0);
  await expect(page.getByText("营业利润", { exact: false })).toHaveCount(0);
  await page.getByRole("tab", { name: "财务人员", exact: true }).click();
  await page.getByRole("button", { name: "雇佣财务人员", exact: true }).click();
  await close(page);
  await expect(page.getByTestId("cash")).toHaveText(`${s.cash - 120} G`);
  await page.reload();
  await expect(page.getByTestId("accountant")).toBeVisible();
  await page.getByRole("button", { name: "前往财务人员", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "财务咨询", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByLabel("利润解释")).toBeVisible();
  await page.getByRole("tab", { name: "销量", exact: true }).click();
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(page.getByTestId("sale-detail-invisibility")).toContainText(
    "不足 1 瓶",
  );
  await close(page);
  await station(page, "sign", "准备开业");
  await page.getByRole("button", { name: "入夜开业", exact: true }).click();
  await page.getByRole("button", { name: "跳至营业收据", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "看懂利润", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("tab")).toHaveText([
    "收支记录",
    "售出药水",
    "纪事",
  ]);
  await page.getByRole("button", { name: "开始第 3 天", exact: true }).click();
  await dismissNews(page);
  await page.getByRole("button", { name: "前往财务人员", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "财务咨询", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await page.getByRole("tab", { name: "费用", exact: true }).click();
  await expect(page.getByText("雇佣支出", { exact: true })).toBeVisible();
  await expect(page.getByText("120 G", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "销量", exact: true }).click();
  await expect(page.getByLabel("各商品销量解释")).toBeVisible();
});
test("legacy reports gain no free accountant and remain playable", async ({
  page,
}) => {
  const s = history();
  delete s.ledger[0].saleDetails;
  const envelope = JSON.parse(encode(s));
  delete envelope.state.accountantHiredDay;
  delete envelope.state.book.staffCost;
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    { key: SAVE_KEY, value: JSON.stringify(envelope) },
  );
  await page.goto("/");
  await expect(
    page.getByRole("tab", { name: "销售原因", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "开始第 2 天", exact: true }).click();
  await station(page, "ledger", "基础账本");
  await page.getByRole("tab", { name: "财务人员", exact: true }).click();
  await page.getByRole("button", { name: "雇佣财务人员", exact: true }).click();
  await close(page);
  await page.getByRole("button", { name: "前往财务人员", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "财务咨询", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await page.getByRole("tab", { name: "销量", exact: true }).click();
  await expect(page.getByText(/未记录当时的客流与售价/)).toBeVisible({
    timeout: 15000,
  });
});
test("after hiring the basic ledger and accountant remain separately reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 360 });
  const s = act(createGame(12), { type: "hire-accountant" }).state;
  await inject(page, s);
  await page.goto("/");
  await dismissNews(page);
  await page.getByTestId("station-ledger").click({ timeout: 3000 });
  await expect(
    page.getByRole("dialog", { name: "基础账本", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await close(page);
  await page
    .getByRole("button", { name: "前往财务人员", exact: true })
    .click({ timeout: 3000 });
  await expect(
    page.getByRole("dialog", { name: "财务咨询", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await close(page);
  await page.getByTestId("station-ledger").click({ timeout: 3000 });
  await expect(
    page.getByRole("dialog", { name: "基础账本", exact: true }),
  ).toBeVisible({ timeout: 10000 });
});
