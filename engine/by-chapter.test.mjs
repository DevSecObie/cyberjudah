import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chapterIndex, writeByChapter, BY_CHAPTER_BUDGET } from "./by-chapter.mjs";
import { loadKjvPeople } from "./people-kjv.mjs";
import { publish } from "./publish.mjs";
import { memoryStore, r2Binding, memoryCache } from "./r2-memory.mjs";
import worker, { forget } from "./worker/index.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const people = loadKjvPeople(path.join(root, "data", "people-kjv"));
const places = JSON.parse(fs.readFileSync(path.join(root, "data", "places-kjv", "places.json"), "utf8")).places;
const BIBLE = path.join(root, "data", "bible");
const books = fs.readdirSync(BIBLE).filter((f) => f.endsWith(".json") && f !== "index.json").sort().map((f) => [
  f.slice(0, -5), Object.keys(JSON.parse(fs.readFileSync(path.join(BIBLE, f), "utf8")).chapters).map(Number).sort((a, b) => a - b),
]);
const fixture = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cyberjudah-by-chapter-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};
const read = (dir, slug, c) => JSON.parse(fs.readFileSync(path.join(dir, slug, `${c}.json`), "utf8"));

for (const [kind, records] of [["people", people], ["places", places]]) {
  test(`${kind}: every verse a record cites lands in its chapter file, once, with fields copied from the record`, (t) => {
    const dir = fixture(t);
    const result = writeByChapter(dir, books, chapterIndex(records));
    assert.equal(result.files, books.reduce((n, [, chs]) => n + chs.length, 0), "one file for every chapter");
    const byId = new Map(records.map((r) => [r.id, r]));
    const seen = new Set();
    for (const [slug, chs] of books) for (const c of chs) {
      const rows = read(dir, slug, c);
      assert.equal(new Set(rows.map((r) => r.id)).size, rows.length, `${slug} ${c}: a record listed twice`);
      for (const row of rows) {
        const r = byId.get(row.id);
        assert.ok(r, `${slug} ${c}: ${row.id} is not a record`);
        const copied = { id: r.id, name: r.name, names: r.names, ...(r.image ? { image: r.image } : {}) };
        assert.deepEqual(Object.keys(row).sort(), [...Object.keys(copied), "verses"].sort(), `${row.id}: only copied fields`);
        for (const [k, v] of Object.entries(copied)) assert.deepEqual(row[k], v, `${row.id}.${k}`);
        assert.deepEqual(row.verses, [...new Set(row.verses)].sort((a, b) => a - b), `${row.id}: verses sorted, no repeats`);
        for (const v of row.verses) {
          assert.ok(r.verses.includes(`${slug}/${c}/${v}`), `${row.id}: ${slug}/${c}/${v} is not one of its verses`);
          seen.add(`${row.id} ${slug}/${c}/${v}`);
        }
      }
      for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].verses[0] <= rows[i].verses[0], `${slug} ${c}: ordered by first verse`);
    }
    for (const r of records) for (const ref of r.verses) assert.ok(seen.has(`${r.id} ${ref}`), `${r.id} ${ref} missing from its chapter file`);
    assert.ok(result.largest.bytes <= BY_CHAPTER_BUDGET.file && result.bytes <= BY_CHAPTER_BUDGET.total);
  });
}

test("the order is stable: the same input gives the same bytes, and ties keep the records' order", (t) => {
  const a = fixture(t), b = fixture(t);
  writeByChapter(a, books, chapterIndex(people));
  writeByChapter(b, books, chapterIndex(people));
  for (const [slug, chs] of books) for (const c of chs) {
    assert.ok(fs.readFileSync(path.join(a, slug, `${c}.json`)).equals(fs.readFileSync(path.join(b, slug, `${c}.json`))), `${slug} ${c}`);
  }
  const rows = chapterIndex([
    { id: "b", name: "B", names: ["B"], verses: ["genesis/1/3", "genesis/1/1", "genesis/1/3"] },
    { id: "a", name: "A", names: ["A"], image: "/people/a.jpg", verses: ["genesis/1/1"] },
    { id: "c", name: "C", names: ["C"], verses: ["genesis/1/2"] },
  ]).get("genesis|1");
  assert.deepEqual(rows, [
    { id: "b", name: "B", names: ["B"], verses: [1, 3] },
    { id: "a", name: "A", names: ["A"], image: "/people/a.jpg", verses: [1] },
    { id: "c", name: "C", names: ["C"], verses: [2] },
  ]);
});

test("a chapter that names no one is an empty list; bad verses, unknown chapters and the budget fail the build", (t) => {
  const dir = fixture(t);
  writeByChapter(dir, [["genesis", [1, 2]]], chapterIndex([{ id: "a", name: "A", names: ["A"], verses: ["genesis/1/1"] }]));
  assert.deepEqual(read(dir, "genesis", 2), []);
  assert.throws(() => chapterIndex([{ id: "a", name: "A", names: ["A"], verses: ["Genesis 1:1"] }]), /malformed verse/);
  assert.throws(() => chapterIndex([{ id: "a", name: "A", names: ["A"], verses: ["genesis/1/1"] }, { id: "a", name: "B", names: ["B"], verses: ["genesis/1/2"] }]), /appears twice/);
  assert.throws(() => writeByChapter(fixture(t), [["genesis", [1]]], chapterIndex([{ id: "a", name: "A", names: ["A"], verses: ["genesis/51/1"] }])), /not a chapter/);
  const many = chapterIndex([{ id: "a", name: "A".repeat(100), names: ["A"], verses: ["genesis/1/1"] }]);
  assert.throws(() => writeByChapter(fixture(t), [["genesis", [1]]], many, { file: 50, total: 1e6 }), /over the 50-byte budget/);
  assert.throws(() => writeByChapter(fixture(t), [["genesis", [1]]], many, { file: 1e6, total: 50 }), /over the 50-byte budget in all/);
});

test("the data Worker serves a chapter file with the usual CORS, cache and ETag headers", async (t) => {
  const dir = fixture(t);
  writeByChapter(path.join(dir, "api", "people", "by-chapter"), books, chapterIndex(people));
  writeByChapter(path.join(dir, "api", "places", "by-chapter"), books, chapterIndex(places));
  const store = memoryStore();
  globalThis.caches = { default: memoryCache() }; forget();
  await publish(store, { dir, source: "0".repeat(40), log: () => {} });
  const get = (pathname, init) => worker.fetch(new Request(`https://data.cyberjudah.io${pathname}`, init), { DATA: r2Binding(store) }, { waitUntil: (p) => p });
  for (const kind of ["people", "places"]) {
    const res = await get(`/api/${kind}/by-chapter/genesis/2.json`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
    assert.equal(res.headers.get("access-control-allow-origin"), "*");
    assert.equal(res.headers.get("cache-control"), "public, max-age=300");
    assert.deepEqual(await res.json(), read(path.join(dir, "api", kind, "by-chapter"), "genesis", 2));
    assert.equal((await get(`/api/${kind}/by-chapter/genesis/2.json`, { headers: { "if-none-match": res.headers.get("etag") } })).status, 304);
  }
  assert.ok((await (await get("/api/people/by-chapter/genesis/2.json")).json()).some((p) => p.name === "Adam"));
});
