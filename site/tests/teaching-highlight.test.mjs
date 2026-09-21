import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const source = readFileSync(new URL('../src/components/search-highlight.tsx', import.meta.url), 'utf8');
const exports = {};
runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: createRequire(import.meta.url) });
const render = text => renderToStaticMarkup(createElement(exports.SearchHighlight, { text }));
const sql = readFileSync(new URL('../src/lib/teachings.ts', import.meta.url), 'utf8').match(/prepare\(`([^`]+)`\)/)[1];

test('actual teaching query highlights phrases, case and accents without partial-word matches', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE VIRTUAL TABLE teaching_passages USING fts5(title,text,feed UNINDEXED,date UNINDEXED,video UNINDEXED,start UNINDEXED,note UNINDEXED)');
    db.prepare('INSERT INTO teaching_passages VALUES(?,?,?,?,?,?,?)').run('FAITH and café', 'Faithful people say love thy neighbour; café and faith.', 'classes', '', 'test', 0, '');
    const hit = db.prepare(sql).get('"faith" AND "cafe" AND "love thy neighbour"', '', '', 0);
    assert.match(hit.matchedTitle, /\uE000FAITH\uE001/);
    assert.match(hit.excerpt, /\uE000café\uE001/);
    assert.match(hit.excerpt, /\uE000love thy neighbour\uE001/);
    assert.doesNotMatch(hit.excerpt, /\uE000Faithful/);
    assert.equal((render(hit.excerpt).match(/<mark /g) || []).length, 3);
    assert.doesNotMatch(render(hit.excerpt), /[\uE000\uE001]/);
  } finally { db.close(); }
});

test('transcript HTML is escaped inside and outside highlights', () => {
  const html = render('<img src=x onerror=alert(1)> \uE000<script>alert(2)</script>\uE001');
  assert.doesNotMatch(html, /<img|<script/);
  assert.match(html, /&lt;img/);
  assert.match(html, /<mark [^>]+>&lt;script&gt;/);
  assert.equal(render('plain unmarked text'), 'plain unmarked text');
});
