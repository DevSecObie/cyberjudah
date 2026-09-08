import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/search-query.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { parseQuery, ftsExpr } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("quoted phrases retain stop words, including stop-word-only phrases", () => {
  assert.deepEqual(parseQuery('"in the beginning"'), { phrases: ["in the beginning"], terms: [] });
  assert.deepEqual(parseQuery('"the law of the Lord" faith and hope'), { phrases: ["the law of the lord"], terms: ["faith", "hope"] });
  assert.deepEqual(parseQuery('"and the"'), { phrases: ["and the"], terms: [] });
});
test("unquoted terms keep existing normalization", () => {
  assert.deepEqual(parseQuery(" THE faith, and hope! "), { phrases: [], terms: ["faith", "hope"] });
  assert.deepEqual(parseQuery("  "), { phrases: [], terms: [] });
});
test("loose matches still require every explicit phrase", () => {
  assert.equal(ftsExpr(parseQuery('"in the beginning" heaven earth'), "OR"), '"in the beginning" AND ("heaven" OR "earth")');
  assert.equal(ftsExpr(parseQuery('"in the beginning" "the earth"'), "OR"), '"in the beginning" AND "the earth"');
});
test("FTS5 finds Genesis 1:1 and John 1:1 without matching scattered words", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE VIRTUAL TABLE verses USING fts5(ref UNINDEXED, text, tokenize='porter unicode61')");
    const add = db.prepare("INSERT INTO verses(ref,text) VALUES (?,?)");
    add.run("Genesis 1:1", "In the beginning God created the heaven and the earth.");
    add.run("John 1:1", "In the beginning was the Word, and the Word was with God.");
    add.run("not a phrase", "The beginning was spoken of in a different order.");
    const query = db.prepare("SELECT ref FROM verses WHERE verses MATCH ? ORDER BY ref");
    assert.deepEqual(query.all(ftsExpr(parseQuery('"in the beginning"'), "AND")).map((r) => r.ref), ["Genesis 1:1", "John 1:1"]);
    assert.deepEqual(query.all(ftsExpr(parseQuery('"in the beginning" heaven earth'), "OR")).map((r) => r.ref), ["Genesis 1:1"]);
  } finally { db.close(); }
});
