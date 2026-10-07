import { test } from "node:test";
import assert from "node:assert/strict";
import { compile, fixText } from "./fix-names.mjs";

test("a variant-less row builds no rule and leaves text unchanged", () => {
  const rules = compile([{ name: "Captain Matthew", variants: [] }]);
  assert.equal(rules.length, 0);
  const text = "Captain Jerham spoke today.";
  assert.deepEqual(fixText(text, rules), { text, n: 0 });
});

test("a variant-less row does not block rules for other rows", () => {
  const rules = compile([
    { name: "Captain Matthew", variants: [] },
    { name: "Bishop Kani", variants: ["Bishop Kanai", "Bishop Kai"] },
  ]);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].name, "Bishop Kani");
  const { text, n } = fixText("Bishop Kai spoke.", rules);
  assert.equal(text, "Bishop Kani spoke.");
  assert.equal(n, 1);
});

test("a row with variants still respells as before", () => {
  const rules = compile([{ name: "Bishop Kani", variants: ["Bishop Kanai", "Bishop Kai"] }]);
  const { text, n } = fixText("BISHOP KANAI's class and Bishop Kai's class.", rules);
  assert.equal(text, "Bishop Kani's class and Bishop Kani's class.");
  assert.equal(n, 2);
});
