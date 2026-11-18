import { test, expect, type Page } from "@playwright/test";
import { createGame, act } from "../../src/engine/game";
import { SAVE_KEY, encode } from "../../src/engine/persistence";
import { prepareTown } from "../../src/engine/town";
import { PRODUCTS } from "../../src/engine/config";
async function load(page: Page, s = createGame(17)) {
  s.newsReadDay = s.day;
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    { key: SAVE_KEY, value: encode(s) },
  );
  await page.goto("/");
}
async function dismiss(page: Page) {
  const n = page.getByRole("dialog", { name: "每日资讯", exact: true });
  if (await n.count())
    await n.getByRole("button", { name: "收好信件", exact: true }).click();
}
async function station(page: Page, id: string, label: string) {
  await dismiss(page);
  await page.getByTestId(`station-${id}`).click();
  await expect(
    page.getByRole("dialog", { name: label, exact: true }),
  ).toBeVisible({ timeout: 15000 });
}
async function close(page: Page) {
  await page.getByRole("button", { name: "关闭", exact: true }).click();
}
async function goTown(page: Page) {
  await dismiss(page);
  await page.getByRole("button", { name: "前往月隐镇", exact: true }).click();
  await expect(
    page.getByRole("main", { name: "月隐镇", exact: true }),
  ).toBeVisible();
}
async function back(page: Page) {
  await page
    .getByRole("button", { name: "快捷返回魔药店", exact: true })
    .click();
  await expect(
    page.getByRole("main", { name: "月隐巷魔药店", exact: true }),
  ).toBeVisible();
}
async function saved(page: Page) {
  return page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!).state,
    SAVE_KEY,
  );
}
test("honors are a separate scene plaque; town travel and relations persist without spending actions", async ({
  page,
}) => {
  test.setTimeout(90000);
  const s = createGame(17);
  s.day = 10;
  s.reputation.guild = 60;
  s.town.keys.guild = 1;
  await load(page, s);
  await station(page, "board", "巷间布告栏");
  await expect(
    page.getByRole("tab", { name: "声望", exact: true }),
  ).toHaveCount(0);
  await close(page);
  await station(page, "honors", "荣誉榜");
  await expect(page.getByRole("tab")).toHaveText(["公会", "王国", "黑市"]);
  await close(page);
  await goTown(page);
  await station(page, "town-guild", "冒险者公会");
  await expect(page.getByTestId("relation-rank")).toHaveText("合作");
  await close(page);
  const n = await saved(page);
  expect(n.cash).toBe(500);
  expect(n.actionPointsUsed).toBe(0);
  expect(n.rng).toBe(s.rng);
  await page.reload();
  await expect(
    page.getByRole("main", { name: "月隐镇", exact: true }),
  ).toBeVisible();
  await back(page);
  await station(page, "honors", "荣誉榜");
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(page.getByText(/预订/).first()).toBeVisible();
});
test("a real cross-day promise reserves retail stock then pays once and unlocks cooperation", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const s = createGame(17);
  s.day = 3;
  s.reputation.guild = 40;
  await load(page, s);
  await goTown(page);
  await station(page, "town-guild", "冒险者公会");
  const offer = (await saved(page)).town.offers.find(
    (o: any) => o.faction === "guild",
  );
  await page.getByRole("button", { name: "接受跨日委托", exact: true }).click();
  await close(page);
  await back(page);
  await station(page, "supplies", "商队进货簿");
  for (const l of offer.lines) {
    await page
      .getByRole("tab", {
        name: PRODUCTS[l.product as keyof typeof PRODUCTS].name,
        exact: true,
      })
      .click();
    await page
      .getByRole("spinbutton", {
        name: `${PRODUCTS[l.product as keyof typeof PRODUCTS].name}采购数量`,
        exact: true,
      })
      .fill(String(l.qty));
    await page
      .getByRole("button", {
        name: `采购${PRODUCTS[l.product as keyof typeof PRODUCTS].name}`,
        exact: true,
      })
      .click();
  }
  await close(page);
  await station(page, "board", "巷间布告栏");
  await page.getByRole("tab", { name: "约定", exact: true }).click();
  await expect(page.getByText(offer.title, { exact: true })).toBeVisible();
  await close(page);
  await station(page, "sign", "准备开业");
  await page.getByRole("button", { name: "入夜开业", exact: true }).click();
  await page.getByRole("button", { name: "开始第 4 天", exact: true }).click();
  expect(
    Object.values((await saved(page)).ledger[0].sales).reduce(
      (a: any, b: any) => a + b,
      0,
    ),
  ).toBe(0);
  await goTown(page);
  await station(page, "town-guild", "冒险者公会");
  const cash = (await saved(page)).cash;
  await page.getByRole("button", { name: "交付跨日委托", exact: true }).click();
  let n = await saved(page);
  expect(n.cash).toBe(cash + offer.reward);
  expect(n.town.keys.guild).toBe(1);
  await expect(page.getByTestId("relation-rank")).toHaveText("合作");
  await page.reload();
  expect((await saved(page)).town.keys.guild).toBe(1);
});
test("guild preorders reserve capacity and arrive once after overnight settlement and reload", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const s = createGame(17);
  s.day = 7;
  s.reputation.guild = 30;
  s.town.met.guild = true;
  await load(page, s);
  await goTown(page);
  await station(page, "town-market", "镇集市");
  await page.getByLabel("供货渠道").selectOption("reserve");
  await page
    .getByRole("spinbutton", { name: "镇区采购数量", exact: true })
    .fill("2");
  await page
    .getByRole("button", { name: "镇区采购治疗药水", exact: true })
    .click();
  await expect(page.getByText("第8天到货", { exact: true })).toBeVisible();
  await close(page);
  await back(page);
  await page.reload();
  expect((await saved(page)).town.deliveries).toHaveLength(1);
  await station(page, "sign", "准备开业");
  await page.getByRole("button", { name: "入夜开业", exact: true }).click();
  await page.getByRole("button", { name: "开始第 8 天", exact: true }).click();
  await dismiss(page);
  await page.reload();
  const n = await saved(page);
  expect(n.town.deliveries).toHaveLength(0);
  expect(
    n.batches
      .filter((b: any) => b.id.startsWith("arrival-"))
      .reduce((a: number, b: any) => a + b.qty, 0),
  ).toBe(2);
});
async function fits(page: Page) {
  const issues = await page
    .locator("dialog[open]")
    .last()
    .evaluate((root) => {
      const bad: string[] = [];
      for (const region of root.querySelectorAll<HTMLElement>(
        ".window-header,.window-tabs,.window-content,.window-footer",
      )) {
        const b = region.getBoundingClientRect();
        const scrollable = region.matches(".town-conversation .window-content");
        if (
          (!scrollable && region.scrollHeight > region.clientHeight + 1) ||
          region.scrollWidth > region.clientWidth + 1
        )
          bad.push(`overflow ${region.className}`);
        const walk = document.createTreeWalker(region, NodeFilter.SHOW_TEXT);
        let n: Node | null;
        while ((n = walk.nextNode())) {
          if (!n.textContent?.trim()) continue;
          const r = document.createRange();
          r.selectNodeContents(n);
          for (const x of r.getClientRects())
            if (
              x.width &&
              x.height &&
              (x.left < b.left - 2 ||
                x.right > b.right + 2 ||
                (!scrollable && (x.top < b.top - 2 || x.bottom > b.bottom + 2)))
            )
              bad.push(`text ${n.textContent.slice(0, 28)}`);
        }
        for (const el of region.querySelectorAll<HTMLElement>("button,input")) {
          const x = el.getBoundingClientRect();
          if (
            x.width &&
            x.height &&
            (x.left < b.left - 1 ||
              x.right > b.right + 1 ||
              (!scrollable && (x.top < b.top - 1 || x.bottom > b.bottom + 1)))
          )
            bad.push(
              `control ${el.getAttribute("aria-label") || el.textContent}`,
            );
        }
      }
      return bad;
    });
  expect(issues).toEqual([]);
}
async function allPages(page: Page) {
  await fits(page);
  for (let i = 0; i < 12; i++) {
    const next = page
      .locator("dialog[open]")
      .last()
      .getByRole("button", { name: "下一页", exact: true });
    if (!(await next.count()) || (await next.isDisabled())) break;
    await next.click();
    await fits(page);
  }
}
for (const size of [
  { width: 640, height: 320 },
  { width: 844, height: 390 },
  { width: 390, height: 844 },
])
  test(`town windows and honors keep all text and controls visible at ${size.width}×${size.height}`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    await page.setViewportSize(size);
    let s = createGame(17);
    s.day = 21;
    s.cash = 10000;
    s.book.openingCash = 10000;
    s.location = "town";
    for (const f of ["guild", "kingdom", "black"] as const) {
      s.reputation[f] = 100;
      s.town.met[f] = true;
      s.town.keys[f] = 2;
    }
    s.town.deliveries = [
      { id: "one", product: "healing", qty: 2, cost: 17, due: 22 },
      { id: "two", product: "mana", qty: 2, cost: 29, due: 22 },
    ];
    prepareTown(s);
    for (const faction of ["guild", "kingdom"] as const) {
      const offer = s.town.offers.find((o) => o.faction === faction)!;
      s = act(s, { type: "contract", id: offer.id, choice: "accept" }).state;
    }
    await load(page, s);
    for (const [id, label] of [
      ["town-market", "镇集市"],
      ["town-guild", "冒险者公会"],
      ["town-alley", "旧巷"],
    ]) {
      await station(page, id, label);
      const dialog = page.getByRole("dialog", { name: label, exact: true });
      await expect(dialog.getByRole("tab")).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: "下一页" })).toHaveCount(
        0,
      );
      await expect(
        dialog.getByRole("heading", { name: "新委托", exact: true }),
      ).toBeVisible();
      await fits(page);
      await close(page);
    }
    await back(page);
    const rotate = page.getByRole("button", {
      name: "先这样看看",
      exact: true,
    });
    if (await rotate.count()) await rotate.click();
    await station(page, "honors", "荣誉榜");
    for (const name of ["公会", "王国", "黑市"]) {
      await page.getByRole("tab", { name, exact: true }).click();
      await allPages(page);
    }
  });
