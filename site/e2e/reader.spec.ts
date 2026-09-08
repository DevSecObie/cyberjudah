import { test, expect } from "@playwright/test";

test("verse links filter study material and tabs do not navigate chapters", async ({ page }) => {
  await page.goto("/bible/numbers/15#v32");
  const mobile = (page.viewportSize()?.width ?? 1440) < 1100;
  if (mobile) await page.getByRole("button", { name: "Open the study panel" }).click();
  await expect(page.getByRole("button", { name: "Showing verse 32; clear" })).toBeVisible();
  const cases = page.getByRole("tab", { name: /Cases/ });
  await cases.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/numbers\/15/);
  await cases.click();
  await page.getByRole("button", { name: /man gathering sticks/ }).click();
  await expect(page.getByRole("region", { name: "Laws broken" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Laws broken" }).getByRole("link").first()).toBeVisible();
});

test("homepage stays within a phone viewport", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".lion-film")).toBeAttached();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const cards = await page.locator(".bento__cell").evaluateAll(elements => elements.map(element => {
    const bounds = element.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height };
  }));
  for (const card of cards) {
    expect(card.width).toBeGreaterThan(150);
    expect(card.height).toBeLessThan(900);
  }
});
