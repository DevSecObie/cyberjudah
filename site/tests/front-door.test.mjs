import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { frontDoorUrl } from "../src/lib/front-door.mjs";
import { launchPath } from "../src/lib/telegram-links.mjs";

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

test("the server front door preserves Bible verse queries on GET and HEAD without changing the destination", async () => {
  // Exercise the real server entry without starting TanStack's unrelated page renderer.
  const source = readFileSync(new URL("../src/server.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const imports = {
    "./lib/front-door.mjs": { frontDoorUrl },
    "./lib/telegram-links.mjs": { launchPath },
    "./lib/error-page": { renderErrorPage: () => "Unexpected server fallback" },
    "./lib/security-headers.server": { applySecurityHeaders: response => response },
  };
  runInNewContext(compiled, { module, exports: module.exports, URL, Response, console, require: name => {
    assert.ok(Object.hasOwn(imports, name), `unexpected renderer import: ${name}`);
    return imports[name];
  } });
  const server = module.exports.default;
  for (const method of ["GET", "HEAD"]) {
    const response = await server.fetch(new Request("https://cyberjudah.io/bible/john/3?v=16-18&next=https%3A%2F%2Fexample.test#v16", { method }), { APP_FRONT_DOOR: "on" }, {});
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "https://web.cyberjudah.io/bible/john/3?v=16-18&next=https%3A%2F%2Fexample.test");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(await response.text(), "");
  }
});
