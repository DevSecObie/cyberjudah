import { test, expect } from "@playwright/test";

test("offline SQLite downloads from GitHub while other downloads stay on the data host", async ({ page }) => {
  await page.goto("/downloads");
  await expect(page.getByRole("link", { name: "library.sqlite.gz", exact: true })).toHaveAttribute(
    "href", "https://raw.githubusercontent.com/DevSecObie/cyberjudah/data/library.sqlite.gz",
  );
  await expect(page.getByRole("link", { name: "vault.zip", exact: true })).toHaveAttribute(
    "href", "https://data.cyberjudah.io/downloads/vault.zip",
  );
  await expect(page.locator("main").getByRole("link", { name: "notes", exact: true })).toHaveAttribute(
    "href", "https://data.cyberjudah.io/api/notes/index.json",
  );
  await page.goto("/api");
  await expect(page.locator(".api-table")).not.toContainText("library.sqlite.gz");
  await expect(page.locator("main")).toContainText("The offline SQLite database is hosted on GitHub");
});
