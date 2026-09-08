import { test, expect } from "@playwright/test";
import type { FeedRow } from "../src/lib/api";

test("case judgment filter narrows results and survives reload", async ({ page }) => {
  await page.goto("/cases");
  const filter = page.getByRole("combobox", { name: "Judgment", exact: true });
  await filter.selectOption("death");
  await expect(page).toHaveURL(/verdict=death/);
  await expect(page.locator("main .verdict").first()).toBeVisible();
  for (const label of await page.locator("main .verdict").allTextContents()) expect(label).toBe("Put to death");
  await page.reload();
  await expect(filter).toHaveValue("death");
  await filter.selectOption("blessed");
  await expect(page.locator("main .verdict").first()).toHaveText("Kept the law");
  await expect(page.locator("main .verdict--death")).toHaveCount(0);
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(filter).toHaveValue("");
  await expect(page.locator("main .verdict--death").first()).toBeVisible();
});

test("case timeline keeps judgment filters and offers era breadcrumbs", async ({ page }) => {
  await page.goto("/cases?verdict=death&view=timeline");
  await expect(page.getByRole("combobox", { name: "View", exact: true })).toHaveValue("timeline");
  const eras = page.getByRole("navigation", { name: "Case eras" });
  await expect(eras).toBeVisible();
  await eras.getByRole("link").first().click();
  await expect(page).toHaveURL(/#era-/);
  await page.getByRole("button", { name: "Remove Judgment: Put to death", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Judgment", exact: true })).toHaveValue("");
  await expect(page).toHaveURL(/view=timeline/);
  await page.locator("main .case-era .list a").first().click();
  const breadcrumbs = page.getByRole("navigation", { name: "Breadcrumb", exact: true });
  await expect(breadcrumbs).toBeVisible();
  await expect(breadcrumbs.locator('[aria-current="page"]')).toBeVisible();
  await breadcrumbs.getByRole("link", { name: "Cases", exact: true }).click();
  await expect(page).toHaveURL(/\/cases\/?$/);
});

test("navigation fits and primary sections remain reachable", async ({ page }) => {
  await page.goto("/classes");
  const header = page.locator("header.cj-nav");
  const toggle = header.getByRole("button", { name: "Menu", exact: true });
  if (page.viewportSize()!.width <= 860) {
    await expect(toggle).toBeVisible();
    await toggle.click();
  } else await expect(toggle).toBeHidden();
  for (const label of ["Precepts", "Case Studies", "The Law", "Sabbath Classes"]) {
    const link = header.getByRole("link", { name: new RegExp(`${label}$`) });
    await expect(link).toBeVisible();
    const bounds = await link.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  await header.getByRole("link", { name: /Precepts$/ }).click();
  await expect(page).toHaveURL(/\/precepts\/?$/);
  await expect(page.locator("main h1")).toBeVisible();
});

test("combined class filters survive reload and clear", async ({ page, request }) => {
  const response = await request.get("https://data.cyberjudah.io/search/classes.json");
  expect(response.ok()).toBeTruthy();
  const rows: FeedRow[] = await response.json();
  const sample = rows.find((row) => (row.allBooks ?? row.books).length > 0)!;
  expect(sample).toBeTruthy();
  await page.goto("/classes");
  const book = page.getByRole("combobox", { name: "Book cited" });
  const teacher = page.getByRole("combobox", { name: "Teacher", exact: true });
  await book.selectOption((sample.allBooks ?? sample.books)[0]);
  await teacher.selectOption(sample.teacher || "Not recorded");
  const chosenBook = await book.inputValue();
  const chosenTeacher = await teacher.inputValue();
  await expect(page).toHaveURL(/teacher=/);
  await page.reload();
  await expect(book).toHaveValue(chosenBook);
  await expect(teacher).toHaveValue(chosenTeacher);
  const expected = rows.filter((row) => (row.allBooks ?? row.books).includes(chosenBook) && (row.teacher || "Not recorded") === chosenTeacher);
  await expect(page.getByRole("status")).toContainText(`${expected.length} of ${rows.length}`);
  await expect(page.locator(".card-grid h3")).toHaveCount(expected.length);
  await page.getByRole("button", { name: "clear", exact: true }).click();
  await expect(book).toHaveValue("");
  await expect(teacher).toHaveValue("");
  await expect(page.locator(".card-grid h3").first()).toBeVisible();
  await page.getByRole("link", { name: "Search inside class notes →" }).click();
  await expect(page).toHaveURL(/only=class/);
});

test("quoted search preserves phrase and opens the verse anchor", async ({ page }) => {
  await page.goto("/search");
  await page.getByRole("textbox", { name: "Search the library" }).fill('"in the beginning"');
  await page.getByRole("search").getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Search the library" })).toHaveValue('"in the beginning"');
  await expect(page.getByRole("status")).toContainText("2 results");
  await expect(page.getByRole("link", { name: /John 1:1/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Scattered words/ })).toHaveCount(0);
  await page.getByRole("link", { name: /Genesis 1:1/ }).click();
  await expect(page).toHaveURL(/\/bible\/genesis\/1#v1$/);
  await expect(page.locator("#v1")).toContainText("In the beginning");
});
