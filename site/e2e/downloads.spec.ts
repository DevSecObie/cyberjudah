import { test, expect } from "@playwright/test";

test("every download is served from the data host", async ({ page }) => {
  await page.goto("/downloads");
  await expect(page.getByRole("link", { name: "library.sqlite.gz", exact: true })).toHaveAttribute(
    "href", "https://data.cyberjudah.io/library.sqlite.gz",
  );
  await expect(page.getByRole("link", { name: "vault.zip", exact: true })).toHaveAttribute(
    "href", "https://data.cyberjudah.io/downloads/vault.zip",
  );
  await expect(page.locator("main").getByRole("link", { name: "notes", exact: true })).toHaveAttribute(
    "href", "https://data.cyberjudah.io/api/notes/index.json",
  );
  await page.goto("/api");
  await expect(page.locator(".api-table")).toContainText("/library.sqlite.gz");
  await expect(page.locator("main")).not.toContainText("jsdelivr");
});
