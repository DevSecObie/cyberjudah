import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateLines, validateLinks, descendantsOf } from './people-lines.mjs';
const doc = JSON.parse(fs.readFileSync(new URL('../data/people/people.json', import.meta.url)));
const bibleDir = fileURLToPath(new URL('../data/bible', import.meta.url));
const byId = new Map(doc.people.map((p) => [p.id, p]));

test('every line in the catalog names a forefather its verses name', () => assert.deepEqual(validateLines(doc, { bibleDir }), []));

test('every same-as, priestly, title and variant link carries its evidence', () => assert.deepEqual(validateLinks(doc, { bibleDir }), []));

test('Mattathias: father John, grandfather Simeon, a priest of the sons of Joarib, with nothing put between', () => {
  const m = byId.get('mattathias-1ma-2-1');
  assert.deepEqual(m.father, ['john-1ma-2-1']);
  assert.deepEqual(byId.get('john-1ma-2-1').father, ['simeon-1ma-2-1']);
  assert.equal(byId.get('simeon-1ma-2-1').line, undefined);
  assert.deepEqual(m.priestly, [{ id: 'joarib-1ma-2-1', evidence: 'scripture', verses: ['1-maccabees/2/1'] }]);
  assert.deepEqual(byId.get('joarib-1ma-2-1').same.map((e) => [e.id, e.evidence]), [['jehoiarib-1ch-24-7', 'parallel']]);
  assert.deepEqual(byId.get('jehoiarib-1ch-24-7').line.map((e) => e.id), ['aaron-exo-4-14']);
  assert.ok(!byId.get('jehoiarib-1ch-24-7').names.includes('Joarib'));
  assert.deepEqual(descendantsOf(doc).get('jarib-1ma-14-29').map((d) => d.id), ['simon-1ma-2-3']);
});

test('the creature called Enoch in 2 Esdras 6:49 is its own record, with Behemoth as a variant', () => {
  const e = byId.get('enoch-2es-6-49');
  assert.equal(e.type, 'Creature');
  assert.deepEqual(e.variants.map((v) => v.reading), ['Behemoth']);
  assert.equal(e.same, undefined);
  for (const id of ['enoch-gen-5-18', 'enoch-gen-4-17']) assert.ok(!byId.get(id).verses.some((v) => v.startsWith('2-esdras/6/')));
});

test('Attharates is Nehemiah\'s title, not his name', () => {
  const n = byId.get('nehemiah-neh-1-1');
  assert.ok(!n.names.includes('Attharates'));
  assert.deepEqual(n.titles.map((t) => [t.title, t.evidence]), [['Tirshatha', 'scripture'], ['Attharates', 'parallel']]);
});

test('kings the text does not name in full are their own records, identified by history', () => {
  for (const [id, to] of [['antiochus-1ma-8-6', 'antiochus-1ma-1-10'], ['ptolemee-1ma-10-51', 'ptolemee-1ma-1-18'], ['demetrius-1ma-15-1', 'demetrius-1ma-7-1'], ['demetrius-1ma-10-67b', 'demetrius-1ma-7-1']]) {
    assert.deepEqual(byId.get(id).same.map((e) => [e.id, e.evidence]), [[to, 'history']], id);
    assert.ok(byId.get(id).same[0].note);
  }
  assert.deepEqual(byId.get('antiochus-1ma-15-1').father, ['demetrius-1ma-15-1']);
});

test('a link without evidence, or with verses that do not name the person, fails', () => {
  const bad = structuredClone(doc), p = bad.people.find((x) => x.id === 'joarib-1ma-2-1');
  p.same = [{ id: 'jehoiarib-1ch-24-7', evidence: 'probably' }];
  assert.match(validateLinks(bad, { bibleDir }).join(' '), /evidence must be one of/);
  p.same = [{ id: 'jehoiarib-1ch-24-7', evidence: 'parallel', verses: ['genesis/1/1'] }];
  assert.match(validateLinks(bad, { bibleDir }).join(' '), /does not name/);
  p.same = [{ id: 'jehoiarib-1ch-24-7', evidence: 'history' }];
  assert.match(validateLinks(bad, { bibleDir }).join(' '), /needs a note/);
});

test('a line the verses do not say, or one that leads back to the person, fails', () => {
  const bad = structuredClone(doc), p = bad.people.find((x) => x.id === 'simeon-1ma-2-1');
  p.line = [{ id: 'jehoiarib-1ch-24-7', verses: ['genesis/1/1'] }];
  assert.match(validateLines(bad, { bibleDir }).join(' '), /does not name/);
  p.line = [{ id: 'mattathias-1ma-2-1', verses: ['1-maccabees/2/1'] }];
  assert.match(validateLines(bad, { bibleDir }).join(' '), /leads back/);
  p.line = [{ id: 'nobody', verses: ['1-maccabees/2/1'] }];
  assert.match(validateLines(bad, { bibleDir }).join(' '), /another catalog person/);
});
