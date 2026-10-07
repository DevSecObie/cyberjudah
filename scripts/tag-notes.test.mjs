import { test } from "node:test";
import assert from "node:assert/strict";

// tag-notes.mjs runs its corpus scan as a side effect of being imported. Force --dry before
// importing so this test (like any other import of the module) never writes to a real note,
// then test the exported selection rule in isolation with made-up inputs.
process.argv.push("--dry");
const { needsTagDerivation, isSelectedForTags } = await import("./tag-notes.mjs");

const SERIES = "IUIC in the ClassRoom";

test("no tags line at all needs derivation", () => {
  assert.equal(needsTagDerivation(-1, [], SERIES), true);
});

test("a tags line with only the series tag needs derivation", () => {
  assert.equal(needsTagDerivation(3, [SERIES], SERIES), true);
});

test("a tags line that already carries a derived topic does not need derivation", () => {
  assert.equal(needsTagDerivation(3, [SERIES, "betrayal"], SERIES), false);
});

test("a hand-added tag alongside the series tag is not 'only the series tag'", () => {
  assert.equal(needsTagDerivation(3, [SERIES, "my-hand-tag"], SERIES), false);
});

test("an untagged note is selected on a default run", () => {
  assert.equal(
    isSelectedForTags({ all: false, tagLine: -1, existingTags: [], seriesTag: SERIES, explicit: false }),
    true,
  );
});

test("an already-tagged note is left alone on a default run", () => {
  assert.equal(
    isSelectedForTags({ all: false, tagLine: 3, existingTags: [SERIES, "betrayal"], seriesTag: SERIES, explicit: false }),
    false,
  );
});

test("--all selects every note regardless of its existing tags", () => {
  assert.equal(
    isSelectedForTags({ all: true, tagLine: 3, existingTags: [SERIES, "betrayal"], seriesTag: SERIES, explicit: false }),
    true,
  );
});

test("a file named on the command line is selected even if already tagged", () => {
  assert.equal(
    isSelectedForTags({ all: false, tagLine: 3, existingTags: [SERIES, "betrayal"], seriesTag: SERIES, explicit: true }),
    true,
  );
});
