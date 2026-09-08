# Browser regression tests

From `site/`, install dependencies, then:

```sh
npx playwright install chromium
npm run build
npm run test:e2e
```

Tests launch the built Worker locally on port 33359 and stop it afterwards.
Search fixtures are loaded only into `.wrangler/e2e`, never a remote database.
Do not execute the fixture SQL against production: it replaces the test search table.

The 12 checks cover Chromium at 390, 880, 1280 and 1600 pixels: navigation
bounds and Precepts navigation, combined class filters with reload/clear and
full-text handoff, and quoted D1 search followed by a verse-anchor link.
Content pages read the public data service, so these are integration tests requiring
network access. A service outage or a data publish during the run can fail them.
The search fixture verifies the actual local D1 query path, not the completeness
of the production index. Safari/Firefox and video playback are not covered.

Failures retain local traces/screenshots and an HTML report. CI retains failure
artifacts for seven days. No production writes or user authentication are used.
