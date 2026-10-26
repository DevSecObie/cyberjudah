import { expect, test, type Page } from "@playwright/test";
import fixture from "../tests/fixtures/doctrine.json" with { type: "json" };

async function openEntry(page: Page, entry = fixture, fail = false) {
  await page.route(scan.scan!, (r) => fail ? r.abort() : r.fulfill({ contentType: "image/svg+xml", body: image }));
  await page.route(`${process.env.VITE_DATA_ORIGIN || "https://data.cyberjudah.io"}/**`, (r) => {
    const path = new URL(r.request().url()).pathname;
    if (!path.startsWith("/api/doctrine/")) return r.fulfill({ status: 404 });
    return r.fulfill({ json: path.endsWith("/index.json") ? [{ ...entry, refs: 2, scriptures: entry.scriptures.length, books: entry.books.length }] : entry });
  });
  await page.route("**/*", (r) => r.request().resourceType() === "media" ? r.abort() : r.fallback());
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.locator("footer").getByRole("link", { name: "False Doctrines", exact: true }).click();
  await page.getByRole("link", { name: entry.name }).click();
  await expect(page.getByRole("heading", { name: entry.name, exact: true })).toBeVisible();
}

const scan = fixture.books[0].pages![0];
const image = '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="2400"><rect width="1000" height="2400" fill="#fff8e7"/><text x="100" y="180" font-size="38">Test-only printed page</text><path d="M100 1740H750 M100 1810H650 M200 2075H800" stroke="#222" stroke-width="10"/></svg>';

test("passage and source hyperlinks replace numbered answers and jump to visible sections", async ({ page }) => {
  const entry = structuredClone(fixture);
  entry.answers.push(structuredClone(entry.answers[0]));
  await openEntry(page, entry);
  await expect(page.locator(".doctrine-evidence")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: /^Answer \d+/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Scripture & teaching", exact: true })).toHaveCount(1);
  await expect(page.locator(".doctrine-evidence .refq__ref").first()).toHaveCSS("text-decoration-line", "underline");
  await expect(page.getByRole("link", { name: /Fixture teacher.*Watch at 1:05/ }).first()).toHaveAttribute("href", "/classes/2026/fixture?t=65");
  await page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: /^Books/ }).click();
  await expect(page).toHaveURL(/#doctrine-books$/);
  await expect.poll(() => page.getByRole("heading", { name: "Books against it", exact: true }).evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(64);
});

test("35 fixture scriptures keep the quiet reading column without horizontal overflow", async ({ page }) => {
  const entry = structuredClone(fixture);
  entry.scriptures = Array.from({ length: 35 }, (_, i) => structuredClone(fixture.scriptures[i % fixture.scriptures.length]));
  await openEntry(page, entry);
  const scripture = page.locator("section").filter({ has: page.getByRole("heading", { name: "Scriptures against it", exact: true }) }).last();
  await expect(scripture.locator(".refq")).toHaveCount(35);
  await expect.poll(() => page.locator(".doctrine-page").evaluate((el) => el.getBoundingClientRect().width)).toBeLessThanOrEqual(600);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(scripture.locator(".refq").first()).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(scripture.locator(".refq blockquote p").first()).toHaveCSS("white-space", "pre-wrap");
});

async function aligned(page: Page) {
  const expected = scan.quotes!.flatMap((q) => q.highlight);
  await expect(page.locator(".dpv__highlight")).toHaveCount(expected.length);
  await expect.poll(() => page.locator(".dpv__canvas").evaluate((canvas) => {
    const img = canvas.querySelector("img")!.getBoundingClientRect();
    return [...canvas.querySelectorAll(".dpv__highlight")].map((mark) => {
      const box = mark.getBoundingClientRect();
      return [(box.x - img.x) / img.width, (box.y - img.y) / img.height, box.width / img.width, box.height / img.height];
    });
  }).then((boxes) => Math.max(...boxes.flatMap((box, i) => box.map((value, n) => Math.abs(value - expected[i][n])))))).toBeLessThan(0.002);
}

test("OCR quotes open a full-screen page with all marks aligned through zoom, pinch and pan", async ({ page }) => {
  await openEntry(page);
  const quotes = page.locator("blockquote").filter({ hasText: scan.quotes![0].text });
  await expect(quotes).toHaveJSProperty("textContent", scan.quotes![0].text);
  await expect(page.getByText(scan.quotes![1].text, { exact: true })).toHaveJSProperty("textContent", scan.quotes![1].text);
  const trigger = page.getByRole("button", { name: "See it on the page", exact: true }).nth(1);
  await trigger.scrollIntoViewIfNeeded();
  const backgroundY = await page.evaluate(() => scrollY);
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).toBe("hidden");
  await expect(dialog).toHaveAttribute("data-lenis-prevent");
  await expect.poll(() => dialog.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return box.width === innerWidth && box.height === innerHeight
      && [...el.children].every((child) => child.getBoundingClientRect().width <= box.width);
  })).toBe(true);
  const bar = (await dialog.locator(".dpv__bar").boundingBox())!;
  await page.mouse.move(bar.x + bar.width / 2, bar.y + bar.height / 2);
  await page.mouse.wheel(0, 200);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(() => scrollY)).toBe(backgroundY);
  await expect(dialog.getByRole("img")).toHaveJSProperty("naturalWidth", 1000);
  await expect(dialog.getByRole("link", { name: "Open in the book", exact: true })).toHaveAttribute("href", scan.url);
  await aligned(page);
  await expect.poll(() => page.locator(".dpv__viewport").evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  const first = await page.locator(".dpv__highlight").first().boundingBox(), vp = await page.locator(".dpv__viewport").boundingBox();
  expect(first!.y).toBeGreaterThanOrEqual(vp!.y);
  expect(first!.y + first!.height).toBeLessThanOrEqual(vp!.y + vp!.height);
  await dialog.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.locator(".dpv__canvas")).toHaveAttribute("data-scale", "1.6");
  await aligned(page);
  const region = page.locator(".dpv__viewport"), before = await region.evaluate((el) => el.scrollTop);
  const area = (await region.boundingBox())!;
  await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2);
  await page.mouse.down();
  await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2 - 40, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBeGreaterThan(before);
  const beforeWheel = await region.evaluate((el) => el.scrollTop);
  await page.mouse.wheel(0, 60);
  await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBeGreaterThan(beforeWheel);
  expect(await page.evaluate(() => scrollY)).toBe(backgroundY);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  const touch = (dx: number) => [{ x: area.x + area.width / 2 - dx, y: area.y + area.height / 2, id: 1 }, { x: area.x + area.width / 2 + dx, y: area.y + area.height / 2, id: 2 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touch(30) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: touch(60) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => page.locator(".dpv__canvas").getAttribute("data-scale").then(Number)).toBeGreaterThan(1.6);
  await aligned(page);
  await cdp.detach();
  await dialog.getByRole("button", { name: "Reset zoom", exact: true }).click();
  await expect(page.locator(".dpv__canvas")).toHaveAttribute("data-scale", "1");
  await aligned(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(backgroundY);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("empty highlights keep the scan available without marks", async ({ page }) => {
  const entry = structuredClone(fixture);
  for (const quote of entry.books[0].pages![0].quotes!) quote.highlight = [];
  await openEntry(page, entry);
  await page.getByRole("button", { name: "See it on the page", exact: true }).first().click();
  await expect(page.getByRole("dialog").getByRole("img")).toHaveJSProperty("naturalWidth", 1000);
  await expect(page.locator(".dpv__highlight")).toHaveCount(0);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("unavailable scans preserve all OCR quotes and the book link", async ({ page }) => {
  await openEntry(page, fixture, true);
  await page.getByRole("button", { name: "See it on the page", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("status")).toHaveText("Scan unavailable.");
  for (const quote of scan.quotes!) await expect(dialog.locator("blockquote").filter({ hasText: quote.text })).toHaveJSProperty("textContent", quote.text);
  await expect(dialog.getByRole("link", { name: "Open in the book", exact: true })).toHaveAttribute("href", scan.url);
  await expect(dialog.getByRole("button", { name: "Zoom in", exact: true })).toBeDisabled();
});
