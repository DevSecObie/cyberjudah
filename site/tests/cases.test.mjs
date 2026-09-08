import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadLibrary } from "../../engine/library.mjs";
import { validateCases } from "../../engine/case-validation.mjs";

const library = loadLibrary(fileURLToPath(new URL("../../", import.meta.url)));
test("all cases have valid metadata, unique API keys, scripture ranges and law IDs", () => {
  assert.deepEqual(validateCases(library), []);
});
test("case validation catches reversed ranges, invalid laws and duplicate slugs", () => {
  const sample = structuredClone(library.cases.cases[0]);
  sample.refs = [{ book: "Genesis", chapter: 1, verses: "33-1" }];
  sample.laws = ["NONEXISTENT"];
  const errors = validateCases({ ...library, cases: { ...library.cases, cases: [sample, sample] } });
  for (const phrase of ["invalid range", "unknown law", "duplicate slug"]) assert.ok(errors.some((e) => e.includes(phrase)));
});
