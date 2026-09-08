import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://127.0.0.1:33359", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [390, 880, 1280, 1600].map((width) => ({
    name: `chromium-${width}`, use: { browserName: "chromium", viewport: { width, height: 900 } },
  })),
  webServer: {
    command: "npx wrangler d1 execute cyberjudah --local --persist-to .wrangler/e2e --file e2e/search.sql && npm run preview -- --port 33359 --persist-to .wrangler/e2e",
    url: "http://127.0.0.1:33359/search",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
