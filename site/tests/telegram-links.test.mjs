import test from "node:test";
import assert from "node:assert/strict";
import { appLink, pathToStartParam, startParamToPath } from "../src/lib/telegram-links.mjs";

test("start params open the page they name", () => {
  assert.equal(startParamToPath(""), "/");
  assert.equal(startParamToPath(undefined), "/");
  assert.equal(startParamToPath("bible_john_3"), "/bible/john/3");
  assert.equal(startParamToPath("john_3_16"), "/bible/john/3?v=16#v16");
  assert.equal(startParamToPath("John_3_16-18"), "/bible/john/3?v=16-18#v16");
  assert.equal(startParamToPath("1-kings_8_22x27"), "/bible/1-kings/8?v=22,27#v22");
  assert.equal(startParamToPath("psalms"), "/bible/psalms");
  assert.equal(startParamToPath("classes_2026_the-coming-crisis"), "/classes/2026/the-coming-crisis");
  assert.equal(startParamToPath("truth-shall-make-you-free"), "/truth-shall-make-you-free");
});

test("unsafe start params fall back to the front door", () => {
  assert.equal(startParamToPath("a/b"), "/");
  assert.equal(startParamToPath("..%2f"), "/");
  assert.equal(startParamToPath("x".repeat(513)), "/");
});

test("paths round-trip through start params", () => {
  for (const [path, v] of [["/bible/john/3", "16-18,20"], ["/classes/2026/the-coming-crisis", undefined], ["/law", undefined], ["/", undefined]]) {
    const param = pathToStartParam(path, v);
    const back = startParamToPath(param);
    assert.equal(back.split("?")[0], path);
    if (v) assert.ok(back.includes(`v=${v}`));
  }
});

test("share links use the Mini App when configured", () => {
  assert.equal(appLink("https://t.me/bot/read", "https://cyberjudah.io", "/bible/john/3", "16"), "https://t.me/bot/read?startapp=bible_john_3_16");
  assert.equal(appLink("https://t.me/bot/read", "https://cyberjudah.io", "/"), "https://t.me/bot/read");
  assert.equal(appLink("", "https://cyberjudah.io", "/bible/john/3", "16"), "https://cyberjudah.io/bible/john/3?v=16");
});
