import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePeopleEvidence, evidenceVerseText } from './people-evidence.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bibleDir = path.join(ROOT, 'data/bible');

const kjv = { name: 'King James Version with Apocrypha' };
const person = (over) => ({
  id: 'synthetic-test-person',
  name: 'Test Person',
  names: ['Test Person'],
  verses: [],
  ...over,
});
const doc = (people) => ({ people });

test('a verse that resolves and names the person passes', () => {
  // Genesis 1:1 names no one, so use a person whose name form occurs in a real verse.
  const d = doc([person({ id: 'aaron-check', names: ['Aaron'], verses: ['exodus/4/14'] })]);
  assert.deepEqual(validatePeopleEvidence(d, ['aaron-check'], { bibleDir }), []);
});

test('a verse that does not name the person fails the check', () => {
  const d = doc([person({ id: 'no-evidence', names: ['Nobody Here'], verses: ['exodus/4/14'], source: kjv })]);
  const problems = validatePeopleEvidence(d, ['no-evidence'], { bibleDir });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /no-evidence: verse exodus\/4\/14 names none of Nobody Here/);
});

test('a documented exception with a reason passes', () => {
  const d = doc([person({ id: 'excepted', names: ['Nobody Here'], verses: ['exodus/4/14'], source: kjv })]);
  const exceptions = { 'excepted|exodus/4/14': 'The verse is about him under a title the catalog does not list as a name form.' };
  assert.deepEqual(validatePeopleEvidence(d, ['excepted'], { bibleDir, exceptions }), []);
});

test('an exception without a reason still fails', () => {
  const d = doc([person({ id: 'empty-reason', names: ['Nobody Here'], verses: ['exodus/4/14'], source: kjv })]);
  const problems = validatePeopleEvidence(d, ['empty-reason'], { bibleDir, exceptions: { 'empty-reason|exodus/4/14': '  ' } });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /needs a reason/);
});

test('a verse that does not resolve fails the check', () => {
  const d = doc([person({ id: 'bad-ref', names: ['Aaron'], verses: ['exodus/999/1'], source: kjv })]);
  const problems = validatePeopleEvidence(d, ['bad-ref'], { bibleDir });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /does not resolve/);
});

test('a person with a non-KJV source is out of scope', () => {
  const d = doc([person({ id: 'other-source', names: ['Nobody Here'], verses: ['exodus/4/14'], source: { name: 'Something Else' } })]);
  assert.deepEqual(validatePeopleEvidence(d, ['other-source'], { bibleDir }), []);
});

test('an unchanged person id is not checked', () => {
  const d = doc([person({ id: 'untouched', names: ['Nobody Here'], verses: ['exodus/4/14'], source: kjv })]);
  assert.deepEqual(validatePeopleEvidence(d, [], { bibleDir }), []);
});

test('matching is whole-word, like check.py', () => {
  // "Aaron" must not match inside another word; check the helper against real text.
  assert.ok(evidenceVerseText('exodus/4/14', bibleDir).includes('Aaron'));
  assert.equal(evidenceVerseText('exodus/4/14', bibleDir).includes('Aaro'), true); // substring, not whole word
  const d = doc([person({ id: 'whole-word', names: ['Aaro'], verses: ['exodus/4/14'], source: kjv })]);
  assert.equal(validatePeopleEvidence(d, ['whole-word'], { bibleDir }).length, 1);
});

test('a patched person keeps a legacy verse that does not name them', () => {
  // The person is already in beforeDoc with a verse that does not name them (a legacy
  // citation this check never proved); the batch patches an unrelated field (description)
  // and keeps that verse untouched. Only person.verses - before.verses needs evidence
  // (docs/proposals/apocrypha/check.py's semantics), so the legacy verse is not re-checked.
  const before = doc([person({ id: 'patched', names: ['Aaron'], verses: ['exodus/1/1'], source: kjv })]);
  const after = doc([person({ id: 'patched', names: ['Aaron'], verses: ['exodus/1/1'], description: 'patched', source: kjv })]);
  assert.deepEqual(validatePeopleEvidence(after, ['patched'], { bibleDir, beforeDoc: before }), []);
});

test('a verse newly added to a patched person still needs evidence', () => {
  const before = doc([person({ id: 'patched2', names: ['Aaron'], verses: ['exodus/1/1'], source: kjv })]);
  const after = doc([person({ id: 'patched2', names: ['Aaron'], verses: ['exodus/1/1', 'exodus/4/14'], source: kjv })]);
  assert.deepEqual(validatePeopleEvidence(after, ['patched2'], { bibleDir, beforeDoc: before }), []);
  const bad = doc([person({ id: 'patched2', names: ['Nobody Here'], verses: ['exodus/1/1', 'exodus/4/14'], source: kjv })]);
  const problems = validatePeopleEvidence(bad, ['patched2'], { bibleDir, beforeDoc: before });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /exodus\/4\/14/);
});

test('a hyphenated name form meets its unhyphenated verse text', () => {
  // esarhaddon-2ki-19-37 (data/people/people.json): names include "Esar-haddon", and
  // 2-kings/19/37 reads "...Esarhaddon his son..." with no hyphen.
  const d = doc([person({ id: 'esar', names: ['Esar-haddon'], verses: ['2-kings/19/37'], source: kjv })]);
  assert.deepEqual(validatePeopleEvidence(d, ['esar'], { bibleDir }), []);
});

test('a singular name form meets its pluralised verse text', () => {
  // israel-gen-25-26: names include "Israelite", and exodus/9/7 reads "...Israelites dead...".
  const d = doc([person({ id: 'isr', names: ['Israelite'], verses: ['exodus/9/7'], source: kjv })]);
  assert.deepEqual(validatePeopleEvidence(d, ['isr'], { bibleDir }), []);
});

test('normalisation does not loosen matching past whole words: "Aaro" still fails', () => {
  const d = doc([person({ id: 'still-fails', names: ['Aaro'], verses: ['exodus/4/14'], source: kjv })]);
  const problems = validatePeopleEvidence(d, ['still-fails'], { bibleDir });
  assert.equal(problems.length, 1);
});

test('"Juda" does not meet "Judas" when Judas is another person\'s own name form (CYB-451)', () => {
  // luke/22/3 names Judas Iscariot, not the "Juda" of the Luke genealogy. Without the
  // other person in the catalog, the trailing-s suffix is harmless (nothing to cross into).
  const juda = person({ id: 'joda-luk-3-26', names: ['Juda'], verses: ['luke/22/3'], source: kjv });
  const onlyJuda = doc([juda]);
  assert.deepEqual(validatePeopleEvidence(onlyJuda, ['joda-luk-3-26'], { bibleDir }), []);
  // With Judas Iscariot present as a different person carrying the literal name "Judas",
  // the match must be refused: "Juda" does not meet "Judas".
  const withJudas = doc([juda, person({ id: 'judas-iscariot', names: ['Judas', 'Judas Iscariot'], verses: [] })]);
  const problems = validatePeopleEvidence(withJudas, ['joda-luk-3-26'], { bibleDir });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /joda-luk-3-26: verse luke\/22\/3/);
});

test('"Anna" does not meet "Annas" when Annas is another person\'s own name form (CYB-451)', () => {
  const anna = person({ id: 'anna-luk-2-36', names: ['Anna'], verses: ['john/18/13'], source: kjv });
  const withAnnas = doc([anna, person({ id: 'annas-high-priest', names: ['Annas'], verses: [] })]);
  const problems = validatePeopleEvidence(withAnnas, ['anna-luk-2-36'], { bibleDir });
  assert.equal(problems.length, 1);
});

test('a name a person shares with itself under the trailing s still passes', () => {
  // A person's own name form matching only through the trailing s (no other owner of
  // the matched word) still counts as evidence — only a *different* person's name form
  // is refused.
  const d = doc([person({ id: 'self-match', names: ['Israelite'], verses: ['exodus/9/7'], source: kjv })]);
  assert.deepEqual(validatePeopleEvidence(d, ['self-match'], { bibleDir }), []);
});

test('the real exceptions file parses', () => {
  const ex = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine/people-evidence-exceptions.json'), 'utf8'));
  assert.ok(ex && typeof ex.exceptions === 'object');
});
