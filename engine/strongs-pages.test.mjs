import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { strongsPages } from "./strongs-pages.mjs";

test("the real Hebrew concordance loses no verses beyond the former 600 limit", () => {
  const rows = [];
  for (const file of fs.readdirSync(new URL("../data/strongs/tags/", import.meta.url)).sort()) {
    const chapters = JSON.parse(fs.readFileSync(new URL(`../data/strongs/tags/${file}`, import.meta.url)));
    for (const [chapter, verses] of Object.entries(chapters)) for (const [verse, spans] of Object.entries(verses)) {
      if (spans.some(([, codes]) => codes.includes("H430"))) rows.push({ slug: file.replace(/\.json$/, ""), chapter: Number(chapter), verse: Number(verse) });
    }
  }
  assert.ok(rows.length > 600);
  const result = strongsPages("H430", rows);
  assert.deepEqual(result.pages.flatMap((p) => p.occurrences), rows);
  assert.deepEqual(result.pages[0].occurrences, rows.slice(0, 600));
  assert.equal(result.pages.at(-1).nextPage, null);
  for (const p of result.pages) assert.equal(p.total, rows.length);
  assert.equal(strongsPages("H430", rows).revision, result.revision);
  assert.notEqual(strongsPages("H430", rows.slice(1)).revision, result.revision);
});
test("empty entries and exact page boundaries terminate without a phantom page", () => {
  assert.deepEqual(strongsPages("G1", []).pages[0].occurrences, []);
  assert.equal(strongsPages("G1", []).pages[0].nextPage, null);
  const rows = [{ verse: 1 }, { verse: 2 }];
  assert.equal(strongsPages("G1", rows, 2).pages.length, 1);
  assert.equal(strongsPages("G1", rows, 2).pages[0].nextPage, null);
  assert.throws(() => strongsPages("../H1", rows));
});
