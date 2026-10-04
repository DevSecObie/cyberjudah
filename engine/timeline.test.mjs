import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { teachingDate } from "./timeline.mjs";

test("a date is taken only where the teaching gives it, as written", () => {
  assert.deepEqual(teachingDate({ offenseFull: ["In the twenty-third year of Joash king of Judah, Jehoahaz began to reign; the teaching dates it about 814 to 798 BC (2 Kings 13:1). He did evil."] }),
    { label: "about 814 to 798 BC", text: "In the twenty-third year of Joash king of Judah, Jehoahaz began to reign; the teaching dates it about 814 to 798 BC (2 Kings 13:1)." });
  assert.equal(teachingDate({ offenseFull: ["The Three Waves teaching dates his reign from about 608 BC."] }).label, "from about 608 BC");
  assert.equal(teachingDate({ offenseFull: ["The class teaches that Edom aided the Babylonians in the destruction of the first temple in 586 BC."] }).label, "586 BC");
  // A year in passing, not given by the teaching as this event's date, is not a date.
  assert.equal(teachingDate({ summary: "A governor hurrying his province toward 70 AD." }), null);
  assert.equal(teachingDate({ summary: "No years here, though the teaching is clear." }), null);
});

test("every date in the case studies comes from a sentence naming the teaching", () => {
  const cases = JSON.parse(fs.readFileSync(new URL("../data/cases.json", import.meta.url), "utf8")).cases;
  const dated = cases.map((c) => [c.code, teachingDate(c)]).filter(([, d]) => d);
  assert.ok(dated.length >= 8, `found ${dated.length}`);
  for (const [code, d] of dated) {
    assert.match(d.text, /teach/i, code);
    assert.ok(d.text.includes(d.label.replace(/^from /, "")) || d.text.includes(d.label), code);
  }
});
