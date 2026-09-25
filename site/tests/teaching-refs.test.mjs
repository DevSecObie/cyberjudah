import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/teaching-refs.ts', import.meta.url), 'utf8');
const refs = {};
runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: refs });
const sql = readFileSync(new URL('../src/lib/teachings.ts', import.meta.url), 'utf8').match(/const taughtSql = `([^`]+)`/)[1];

// The table exactly as scripts/corpus/index.py creates it.
const SCHEMA = 'CREATE TABLE teaching_refs(slug TEXT NOT NULL, chapter INTEGER NOT NULL, first INTEGER NOT NULL, last INTEGER, video TEXT NOT NULL, start REAL NOT NULL, timing TEXT NOT NULL, title TEXT, feed TEXT, date TEXT, note TEXT, heard TEXT)';
const row = (video, first, last, start, date = '2024-01-01', title = video) => ({ slug: 'isaiah', chapter: 14, first, last, video, start, timing: 'caption', title, feed: 'classes', date, note: '', heard: `Isaiah 14 ${first}` });

function database(rows) {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  const insert = db.prepare('INSERT INTO teaching_refs VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  for (const r of rows) insert.run(r.slug, r.chapter, r.first, r.last, r.video, r.start, r.timing, r.title, r.feed, r.date, r.note, r.heard);
  return db;
}
const query = (db, verses = []) => db.prepare(sql).all('isaiah', 14, JSON.stringify(verses));

test('the chapter query ranks recordings by how often they return to it', () => {
  const db = database([
    row('once', 12, null, 50),
    row('often', 12, null, 10), row('often', 13, 14, 90), row('often', 12, null, 400),
    row('elsewhere', 12, null, 5),
  ]);
  db.prepare("UPDATE teaching_refs SET chapter = 15 WHERE video = 'elsewhere'").run();
  const rows = query(db);
  assert.deepEqual([...new Set(rows.map(r => r.video))], ['often', 'once']);
  assert.equal(rows[0].total, 2);
  assert.deepEqual(rows.filter(r => r.video === 'often').map(r => r.start), [10, 90, 400]);
});

test('the chapter query narrows to selected verses, ranges included', () => {
  const db = database([row('a', 12, null, 1), row('b', 13, 15, 2), row('c', 20, null, 3)]);
  assert.deepEqual(query(db, [14]).map(r => r.video), ['b']);
  assert.deepEqual(query(db, [12, 20]).map(r => r.video).sort(), ['a', 'c']);
  assert.equal(query(db, [99]).length, 0);
});

test('the chapter query caps the list at 100 recordings but counts them all', () => {
  const db = database(Array.from({ length: 130 }, (_, i) => row(`v${String(i).padStart(3, '0')}`, 12, null, i)));
  const rows = query(db);
  assert.equal(new Set(rows.map(r => r.video)).size, 100);
  assert.equal(rows[0].total, 130);
});

test('grouping keeps one entry per recording with its moments in time order', () => {
  // JSON round trip: arrays made in the module's context are not this context's arrays.
  const grouped = JSON.parse(JSON.stringify(refs.groupTaught([
    row('x', 12, null, 300), row('x', 12, null, 20), row('x', 12, null, 20.4), row('x', 13, 15, 100),
    row('y', 12, null, 5, ''),
  ])));
  assert.deepEqual(grouped.map(g => g.video), ['x', 'y']);
  assert.deepEqual(grouped[0].moments.map(m => [m.verses, m.start]), [['12', 20], ['13-15', 100], ['12', 300]]);
  assert.equal(grouped[1].date, '');
});

test('verse filtering, clock and watch links', () => {
  assert.equal(refs.touches({ first: 13, last: 15 }, [14]), true);
  assert.equal(refs.touches({ first: 13, last: null }, [14]), false);
  assert.equal(refs.touches({ first: 13, last: null }, []), true);
  assert.equal(refs.clock(59), '0:59');
  assert.equal(refs.clock(3723.9), '1:02:03');
  assert.equal(refs.watchAt('a-b_c', 61.8), 'https://www.youtube.com/watch?v=a-b_c&t=61s');
});
