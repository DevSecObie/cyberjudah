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
const sql = readFileSync(new URL('../src/lib/teachings.ts', import.meta.url), 'utf8').match(/const sql = `([^`]+)`/)[1];

test('actual teaching query highlights phrases, case and accents without partial-word matches', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE VIRTUAL TABLE teaching_passages USING fts5(title,text,feed UNINDEXED,date UNINDEXED,video UNINDEXED,start UNINDEXED,note UNINDEXED,cues UNINDEXED)');
    db.prepare('INSERT INTO teaching_passages VALUES(?,?,?,?,?,?,?,?)').run('FAITH and café', 'Faithful people say love thy neighbour; café and faith.', 'classes', '', 'test', 0, '', '[[0,0]]');
    const hit = db.prepare(sql).get('"faith" AND "cafe" AND "love thy neighbour"', '', '', 0);
    assert.match(hit.matchedTitle, /\uE000FAITH\uE001/);
    assert.match(hit.matchedText, /\uE000café\uE001/);
    assert.match(hit.matchedText, /\uE000love thy neighbour\uE001/);
    assert.doesNotMatch(hit.matchedText, /\uE000Faithful/);
    assert.equal((render(hit.matchedText).match(/<mark /g) || []).length, 3);
    assert.doesNotMatch(render(hit.matchedText), /[\uE000\uE001]/);
  } finally { db.close(); }
});

test('transcript HTML is escaped inside and outside highlights', () => {
  const html = render('<img src=x onerror=alert(1)> \uE000<script>alert(2)</script>\uE001');
  assert.doesNotMatch(html, /<img|<script/);
  assert.match(html, /&lt;img/);
  assert.match(html, /<mark [^>]+>&lt;script&gt;/);
  assert.equal(render('plain unmarked text'), 'plain unmarked text');
});

const excerptSource = readFileSync(new URL('../src/lib/passage-excerpt.ts', import.meta.url), 'utf8');
const excerptModule = ts.transpileModule(excerptSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { passageExcerpt } = await import(`data:text/javascript;base64,${Buffer.from(excerptModule).toString('base64')}`);

test('video target follows the shown caption rather than the start of the long passage', () => {
  const intro = 'Intro words '.repeat(70);
  const body = `${intro}right here forgiveness and compassion. Later forgiveness again.`;
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE VIRTUAL TABLE teaching_passages USING fts5(title,text,feed UNINDEXED,date UNINDEXED,video UNINDEXED,start UNINDEXED,note UNINDEXED,cues UNINDEXED)');
    const cues = JSON.stringify([[0,1028],[intro.length,1127.6],[body.indexOf('Later'),1200]]);
    db.prepare('INSERT INTO teaching_passages VALUES(?,?,?,?,?,?,?,?)').run('Forgiveness',body,'captains','','test',1028,'',cues);
    const row = db.prepare(sql).get('"forgiveness"','','',0);
    const result = passageExcerpt(row.matchedText, row.cues, row.start);
    assert.equal(result.start,1127.6);
    assert.equal(result.timing,'caption');
    assert.match(result.excerpt,/\uE000forgiveness\uE001/);
    assert.ok(result.excerpt.length < body.length);
    assert.equal(passageExcerpt(row.matchedText,null,row.start).timing,'passage');
  } finally { db.close(); }
});

test('phrases crossing captions seek to the first caption; title-only matches are labelled passage starts', () => {
  const marked = '😀 Before \uE000love thy neighbour\uE001 after';
  assert.equal(passageExcerpt(marked,JSON.stringify([[0,10],[10,20],[19,30]]),10).start,20);
  const titleOnly = passageExcerpt('Unmatched passage text','[[0,42]]',42);
  assert.equal(titleOnly.start,42);
  assert.equal(titleOnly.timing,'passage');
  assert.equal(passageExcerpt(marked,'invalid JSON',10).timing,'passage');
});
