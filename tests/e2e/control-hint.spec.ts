import { expect, test } from "@playwright/test";
import { createGame } from "../../src/engine/game";
import { SAVE_KEY, encode } from "../../src/engine/persistence";
test("device guidance advances on movement and stays hidden after successful interaction, reload and town travel", async ({
  page,
}) => {
  test.setTimeout(60000);
  const s = createGame(17);
  s.newsReadDay = 1;
  await page.addInitScript(
    ({ k, v }) => {
      if (!localStorage.getItem(k)) localStorage.setItem(k, v);
    },
    { k: SAVE_KEY, v: encode(s) },
  );
  await page.goto("/");
  const touch = await page.evaluate(
    () =>
      navigator.maxTouchPoints > 0 || matchMedia("(pointer:coarse)").matches,
  );
  await expect(page.getByTestId("control-hint")).toContainText(
    touch ? "左侧" : "WASD",
  );
  if (touch) {
    const client = await page.context().newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 135, y: 220, id: 1 }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 190, y: 220, id: 1 }],
    });
    await expect(page.getByTestId("control-hint")).toContainText("右侧按钮");
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } else {
    await page.keyboard.down("d");
    await expect(page.getByTestId("control-hint")).toContainText("按 E");
    await page.keyboard.up("d");
  }
  await page.getByTestId("station-honors").click();
  await expect(
    page.getByRole("dialog", { name: "荣誉榜", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(page.getByTestId("control-hint")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("control-hint")).toHaveCount(0);
  await page.getByRole("button", { name: "前往月隐镇", exact: true }).click();
  await expect(
    page.getByRole("main", { name: "月隐镇", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("control-hint")).toHaveCount(0);
});
