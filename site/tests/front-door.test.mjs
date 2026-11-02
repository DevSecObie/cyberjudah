import { test } from "node:test";
import assert from "node:assert/strict";
import { frontDoorUrl } from "../src/lib/front-door.mjs";

test("the home page opens the web app's Home", () => {
  assert.equal(frontDoorUrl("/"), "https://web.cyberjudah.io/home");
});

test("a Bible chapter or verse opens the same address in the web app", () => {
  assert.equal(frontDoorUrl("/bible/john/3"), "https://web.cyberjudah.io/bible/john/3");
  assert.equal(frontDoorUrl("/bible/1-kings/8/27"), "https://web.cyberjudah.io/bible/1-kings/8/27");
});

test("pages without a known app screen stay on the site", () => {
  for (const path of ["/about", "/teachings", "/shows/x", "/giving-the-sense", "/downloads", "/api", "/bible", "/bible/john", "/bible/john/3/16/extra", "/bible/John/3", "/bible/john/abc", "/precepts/x", "/robots.txt", "/sitemap.xml", "/app", "/search"])
    assert.equal(frontDoorUrl(path), null, path);
});
