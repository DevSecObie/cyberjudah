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

test('the real exceptions file parses', () => {
  const ex = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine/people-evidence-exceptions.json'), 'utf8'));
  assert.ok(ex && typeof ex.exceptions === 'object');
});
