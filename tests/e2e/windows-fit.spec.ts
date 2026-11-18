import { test, expect, type Page } from "@playwright/test";
import { createGame, closeDay, act } from "../../src/engine/game";
import { makeOrder } from "../../src/engine/events";
import { IDS, type GameState } from "../../src/engine/types";
import { encode, SAVE_KEY } from "../../src/engine/persistence";

async function fits(page: Page) {
  const dialog = page
    .locator("dialog[open], .owl-bulletin:not([hidden])")
    .last();
  const issues = await dialog.evaluate((root) => {
    const bad: string[] = [];
    for (const el of [
      root,
      ...root.querySelectorAll<HTMLElement>("[data-window-content]"),
    ])
      if (
        el.scrollHeight > el.clientHeight + 1 ||
        el.scrollWidth > el.clientWidth + 1
      )
        bad.push(
          `overflow: ${el.className} ${el.clientHeight}/${el.scrollHeight}`,
        );
    for (const region of root.querySelectorAll<HTMLElement>(
      ".window-header,.window-tabs,.window-content,.window-footer",
    )) {
      const b = region.getBoundingClientRect();
      const walker = document.createTreeWalker(region, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = walker.nextNode())) {
        if (!n.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const r of range.getClientRects())
          if (
            r.width &&
            r.height &&
            (r.top < b.top - 2 ||
              r.bottom > b.bottom + 2 ||
              r.left < b.left - 2 ||
              r.right > b.right + 2)
          )
            bad.push(`clipped text: ${n.textContent.slice(0, 45)}`);
      }
      for (const control of region.querySelectorAll<HTMLElement>(
        "button,input,select",
      )) {
        const r = control.getBoundingClientRect();
        if (
          r.width &&
          r.height &&
          (r.top < b.top - 1 ||
            r.bottom > b.bottom + 1 ||
            r.left < b.left - 1 ||
            r.right > b.right + 1)
        )
          bad.push(
            `clipped control: ${control.getAttribute("aria-label") || control.textContent}`,
          );
      }
    }
    return bad;
  });
  expect(
    issues,
    (await dialog.getAttribute("aria-label")) || "window fits",
  ).toEqual([]);
}
async function pages(page: Page, max = 5) {
  await fits(page);
  for (let i = 1; i < max; i++) {
    const next = page
      .locator("dialog[open], .owl-bulletin:not([hidden])")
      .last()
      .getByRole("button", { name: "下一页", exact: true });
    if (!(await next.count()) || (await next.isDisabled())) break;
    await next.click();
    await fits(page);
  }
}
async function tabs(page: Page) {
  const root = page.locator("dialog[open], .owl-bulletin:not([hidden])").last();
  const labels = await root.getByRole("tab").allTextContents();
  if (!labels.length) await pages(page);
  for (const label of labels) {
    await root.getByRole("tab", { name: label.trim(), exact: true }).click();
    await pages(page);
    if (label.trim() === "最后一晚收据") {
      await tabs(page);
      await page
        .getByRole("button", { name: "返回经营结局", exact: true })
        .click();
      await fits(page);
    }
  }
}
async function close(page: Page) {
  await page
    .locator("dialog[open], .owl-bulletin:not([hidden])")
    .last()
    .getByRole("button", { name: /^(关闭|收好信件)$/ })
    .click();
}
async function open(page: Page, id: string, label: string) {
  await page.getByTestId(`station-${id}`).click();
  await expect(
    page.getByRole("dialog", { name: label, exact: true }),
  ).toBeVisible({ timeout: 15000 });
}
function fullShop() {
  let s = createGame(284);
  s.cash = 10000;
  s.book.openingCash = 10000;
  s = act(s, { type: "hire-accountant" }).state;
  for (let i = 0; i < 12; i++) {
    s = closeDay(s, s.day).state;
    s = act(s, { type: "ack" }).state;
  }
  s.batches = Array.from({ length: 30 }, (_, i) => ({
    id: `lot-${i}`,
    product: IDS[i % 5],
    qty: 1,
    cost: 20 + i,
    day: s.day - Math.floor(i / 5),
  }));
  s.news = Array.from(
    { length: 12 },
    (_, i) =>
      `消息${i + 1}：${"巷间的消息随风传来，商队绕过山岭，新的客人将会在夜里抵达。".repeat(5)}`,
  );
  s.log = Array.from({ length: 600 }, (_, i) => ({
    id: `history-${i}`,
    day: s.day,
    text: `记录${i}：${"过去的故事写在旧纸上，店里的灯依旧亮着。".repeat(7)}`,
    kind: "world" as const,
  }));
  s.orders = [
    "doctor",
    "army",
    "warblack",
    "smuggler",
    "guild",
    "royal",
    "collector",
    "clinic",
  ].map((k) => makeOrder(s, k as any));
  s.effects = [
    {
      id: "long",
      title: "商路传闻",
      description: "商队抵达带来了新的货品，市场上的需求正在改变。".repeat(7),
      until: s.day + 3,
      buy: {},
      demand: {},
      supply: {},
    },
  ];
  s.status = "default";
  s.arrears = 24;
  s.defaultSince = s.day;
  s.reputation.guild = 25;
  return s;
}
async function inject(page: Page, s: GameState) {
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    { key: SAVE_KEY, value: encode(s) },
  );
  await page.goto("/");
}
for (const size of [
  { width: 640, height: 320 },
  { width: 844, height: 390 },
  { width: 390, height: 844 },
]) {
  test(`all shop windows keep text and actions inside pages at ${size.width}×${size.height}`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    await page.setViewportSize(size);
    await inject(page, fullShop());
    if (size.width === 844)
      await page.evaluate(() => {
        for (const [key, value] of Object.entries({
          "--safe-left": "64px",
          "--safe-right": "32px",
          "--safe-top": "24px",
          "--safe-bottom": "20px",
        }))
          document.documentElement.style.setProperty(key, value);
      });
    await expect(
      page.getByRole("dialog", { name: "每日资讯", exact: true }),
    ).toBeVisible();
    await pages(page, 5);
    await close(page);
    const rotate = page.getByRole("button", {
      name: "先这样看看",
      exact: true,
    });
    if (await rotate.count()) await rotate.click();
    for (const [id, label] of [
      ["supplies", "商队进货簿"],
      ["shelves", "魔药货架"],
      ["board", "巷间布告栏"],
      ["ledger", "基础账本"],
    ]) {
      await open(page, id, label);
      await tabs(page);
      await close(page);
    }
    await open(page, "chest", "仓库箱");
    await fits(page);
    await page
      .getByRole("button", { name: "第 1 格：治疗药水", exact: true })
      .click();
    await tabs(page);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "物品详情", exact: true }),
    ).toHaveCount(0);
    await fits(page);
    await close(page);
    await page.getByRole("button", { name: "前往来访者", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "今日来客", exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await pages(page, 8);
    await close(page);
    await page
      .getByRole("button", { name: "前往财务人员", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "财务咨询", exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await tabs(page);
    await close(page);
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await fits(page);
    await page
      .getByRole("button", { name: "操作与经营规则", exact: true })
      .click();
    await tabs(page);
    await close(page);
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await page.getByRole("button", { name: "重新开局", exact: true }).click();
    await fits(page);
    await close(page);
    await close(page);
    await open(page, "sign", "准备开业");
    await fits(page);
    await page.getByRole("button", { name: "入夜开业", exact: true }).click();
    await page
      .getByRole("button", { name: "跳至营业收据", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "营业报告", exact: true }),
    ).toBeVisible();
    await tabs(page);
  });
}

test("ending reasons and final accounts remain paginated on a short landscape screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 320 });
  const start = fullShop();
  start.cash = 0;
  start.batches = [];
  start.defaultSince = start.day - 2;
  const s = closeDay(start, start.day).state;
  expect(s.status).toBe("ended");
  s.reason = "租金未能结清，小店在月色中收起了招牌。".repeat(9);
  await inject(page, s);
  await expect(
    page.getByRole("dialog", { name: "经营结束", exact: true }),
  ).toBeVisible();
  await tabs(page);
  await expect(page.getByText("最大单日亏损", { exact: true })).toBeVisible();
});

for (const size of [
  { width: 640, height: 320 },
  { width: 390, height: 844 },
])
  test(`merchant and crystal pages fit ${size.width}×${size.height}`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize(size);
    const s = createGame(16);
    s.day = 6;
    s.omen = { kind: "blackout", chance: 0.44 };
    await inject(page, s);
    await close(page);
    const rotate = page.getByRole("button", {
      name: "先这样看看",
      exact: true,
    });
    if (await rotate.count()) await rotate.click();
    await page
      .getByRole("button", { name: "前往黑市商人", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "黑市商人", exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await tabs(page);
    await page.getByRole("button", { name: "购入水晶球", exact: true }).click();
    await fits(page);
    await close(page);
    await open(page, "crystal", "水晶球");
    await tabs(page);
    await page
      .getByRole("button", { name: "施放护店结界", exact: true })
      .click();
    await fits(page);
  });
