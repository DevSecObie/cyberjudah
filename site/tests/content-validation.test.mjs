import test from "node:test";
import assert from "node:assert/strict";
import { validVerseRange, duplicateUrls } from "../../engine/validation.mjs";

test("verse references reject reversed and out-of-bounds ranges", () => {
  const chapter = Array(31).fill("verse");
  for (const [first, last] of [[1, 1], [1, 31], [31, 31]]) assert.equal(validVerseRange(first, last, chapter), true);
  for (const [first, last] of [[0, 1], [32, 32], [33, 1], [5, 4], [1, 32], [1.5, 2]]) assert.equal(validVerseRange(first, last, chapter), false);
});

test("duplicate URLs are rejected across content collections", () => {
  const records = [{ url: "/precepts/love" }, { url: "/cases/love" }, { url: "/precepts/love" }];
  assert.deepEqual(duplicateUrls(records), [records[2]]);
});
