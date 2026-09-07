import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
// Use the already-installed compiler so the tests also run on supported Node 20.
const source = fs.readFileSync(new URL("../src/utils/noteFilters.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { filterNotes, notePath } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const filters = { q: "", years: [], topics: [], teachers: [], book: "", sort: "new" };
const notes = [
  { title: "Mercy", url: "/classes/mercy", date: "2026-01-02", year: "2026", books: ["Matthew"], allBooks: ["Matthew", "Numbers"], teacher: "Captain Noah", topics: ["mercy", "law"] },
  { title: "Law", url: "/classes/law", date: "2025-01-02", year: "2025", books: ["Numbers"], topics: ["law"] },
];
test("combines teacher, cited book, topic and year", () => {
  assert.deepEqual(filterNotes(notes, { ...filters, teachers: ["Captain Noah"], book: "Numbers", topics: ["law"], years: ["2026"] }), [notes[0]]);
});
test("multiple topics require all tags; absent teacher is not invented", () => {
  assert.deepEqual(filterNotes(notes, { ...filters, topics: ["law", "mercy"] }), [notes[0]]);
  assert.deepEqual(filterNotes(notes, { ...filters, teachers: ["Unknown"] }), []);
});
test("full text supplements title matching and still respects facets", () => {
  const hits = new Set(["/classes/law"]);
  assert.deepEqual(filterNotes(notes, { ...filters, q: "sabbath" }, hits), [notes[1]]);
  assert.deepEqual(filterNotes(notes, { ...filters, q: "sabbath", years: ["2026"] }, hits), []);
  assert.deepEqual(filterNotes(notes, { ...filters, q: "  NOAH " }), [notes[0]]);
});
test("sorts without mutating source", () => {
  assert.deepEqual(filterNotes(notes, { ...filters, sort: "old" }), [notes[1], notes[0]]);
  assert.deepEqual(filterNotes(notes, { ...filters, sort: "az" }), [notes[1], notes[0]]);
  assert.equal(notes[0].title, "Mercy");
});
test("normalizes Pagefind URLs without confusing a similar base path", () => {
  assert.equal(notePath("/cyberjudah/classes/law.html#heading", "/cyberjudah/"), "/classes/law");
  assert.equal(notePath("https://devsecobie.github.io/cyberjudah/classes/law/", "/cyberjudah/"), "/classes/law");
  assert.equal(notePath("/cyberjudah-other/classes/law", "/cyberjudah/"), "/cyberjudah-other/classes/law");
});
