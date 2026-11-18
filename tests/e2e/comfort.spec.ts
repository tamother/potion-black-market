import { test, expect, type Page } from "@playwright/test";
async function ready(page: Page) {
  await page.goto("/");
  await page.getByTestId("player").waitFor();
  const news = page.getByRole("dialog", { name: "每日资讯", exact: true });
  if (await news.count())
    await news.getByRole("button", { name: "收好信件", exact: true }).click();
}
test("wide joystick drags keep moving and another finger cannot steal or release movement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await ready(page);
  const box = (await page.getByTestId("joystick").boundingBox())!,
    cx = box.x + box.width / 2,
    cy = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page),
    player = page.getByTestId("player");
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: cx + 25, y: cy, id: 1 }],
  });
  await page.waitForTimeout(150);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: cx + 240, y: cy, id: 1 }],
  });
  const beforeFar = Number(await player.getAttribute("data-x"));
  await page.waitForTimeout(230);
  expect(Number(await player.getAttribute("data-x"))).toBeGreaterThan(
    beforeFar + 15,
  );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: cx + 240, y: cy, id: 1 },
      { x: cx - 12, y: cy, id: 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [{ x: cx - 12, y: cy, id: 2 }],
  });
  const beforeRelease = Number(await player.getAttribute("data-x"));
  await page.waitForTimeout(230);
  expect(Number(await player.getAttribute("data-x"))).toBeGreaterThan(
    beforeRelease + 15,
  );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(70);
  const stopped = Number(await player.getAttribute("data-x"));
  await page.waitForTimeout(170);
  expect(Number(await player.getAttribute("data-x"))).toBe(stopped);
});
test("losing pointer capture outside the pad continues until the owning touch is cancelled", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await ready(page);
  await page.getByTestId("joystick").evaluate((el) => {
    (el.closest(".joystick-zone") ?? el).addEventListener(
      "gotpointercapture",
      (e) => {
        (el as any).__active = (e as PointerEvent).pointerId;
      },
    );
  });
  const b = (await page.getByTestId("joystick").boundingBox())!,
    cx = b.x + b.width / 2,
    cy = b.y + b.height / 2,
    cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: cx + 25, y: cy, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: cx + 70, y: cy, id: 1 }],
  });
  await page.waitForTimeout(60);
  await page.getByTestId("joystick").evaluate((el) => {
    const id = (el as any).__active;
    const target = el.closest(".joystick-zone") ?? el;
    if (id && target.hasPointerCapture(id)) target.releasePointerCapture(id);
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: cx + 250, y: cy, id: 1 }],
  });
  const p = page.getByTestId("player"),
    start = Number(await p.getAttribute("data-x"));
  await page.waitForTimeout(220);
  expect(Number(await p.getAttribute("data-x"))).toBeGreaterThan(start + 15);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await page.waitForTimeout(80);
  const stopped = Number(await p.getAttribute("data-x"));
  await page.waitForTimeout(150);
  expect(Number(await p.getAttribute("data-x"))).toBe(stopped);
});
