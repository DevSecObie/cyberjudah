import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadKjvPeople, validateKjvPeople } from './people-kjv.mjs';

const bibleDir = fileURLToPath(new URL('../data/bible', import.meta.url));
const people = loadKjvPeople(fileURLToPath(new URL('../data/people-kjv', import.meta.url)));
const byName = (name, verse) => people.find((p) => p.name === name && p.verses.includes(verse));

test('the rebuilt catalog passes its checks', () => assert.deepEqual(validateKjvPeople(people, { bibleDir }), []));

test('Genesis: family links carry the verse that states them', () => {
  const isaac = byName('Isaac', 'genesis/21/3');
  assert.equal(isaac.father[0].id, byName('Abraham', 'genesis/25/19').id);
  assert.ok(isaac.father[0].verses.includes('genesis/25/19'));
  assert.equal(isaac.mother[0].id, byName('Sarah', 'genesis/21/2').id);
  assert.equal(isaac.father[0].evidence, 'scripture');
});

test('Genesis: one person under every KJV spelling, and men of the same name kept apart', () => {
  assert.deepEqual(byName('Abraham', 'genesis/17/5').names, ['Abraham', 'Abram']);
  assert.deepEqual(byName('Jacob', 'genesis/35/10').names, ['Jacob', 'Israel']);
  const enochs = people.filter((p) => p.name === 'Enoch');
  assert.equal(enochs.length, 2);
  assert.notEqual(byName('Enoch', 'genesis/4/17').id, byName('Enoch', 'genesis/5/24').id);
});

test('Genesis: Laban is "the son of Nahor" as a forefather, his father is Bethuel', () => {
  const laban = byName('Laban', 'genesis/24/29');
  assert.equal(laban.father[0].id, byName('Bethuel', 'genesis/28/5').id);
  assert.equal(laban.line[0].id, byName('Nahor', 'genesis/29/5').id);
});

test('Genesis: no uncertain links; two men called Abimelech stay separate', () => {
  const [a, b] = [byName('Abimelech', 'genesis/20/2'), byName('Abimelech', 'genesis/26/1')];
  assert.notEqual(a.id, b.id);
  assert.equal(a.same, undefined);
  for (const p of people) for (const f of ['father', 'mother', 'partners', 'siblings', 'children', 'line', 'nation', 'same']) for (const e of p[f] ?? []) assert.notEqual(e.evidence, 'uncertain');
});

test('bad links fail', () => {
  const copy = structuredClone(people);
  copy[0].father = [{ id: 'nobody', evidence: 'scripture', verses: ['genesis/1/1'] }];
  copy[1].verses = ['genesis/1/1'];
  copy[2].children = [{ id: copy[3].id, evidence: 'uncertain', verses: ['genesis/1/1'] }];
  const problems = validateKjvPeople(copy, { bibleDir }).join('\n');
  assert.match(problems, /no such person/);
  assert.match(problems, /does not name/);
  assert.match(problems, /evidence uncertain/);
  assert.match(problems, /not recorded back/);
});
