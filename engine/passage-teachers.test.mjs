import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadLeaderNames, loadRankTeachers, parseNames, passageTeacher } from './class-metadata.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const names = loadLeaderNames(ROOT), ranks = loadRankTeachers(ROOT);
const official = new Set(names.values());

test('a passage teacher is spelled as data/names.tsv spells the leader', () => {
  const map = parseNames('name\tvariants\tnote\nDeacon Yoshua\tDeacon Yashua;Deacon Yeshua\t\nCaptain Uri\tCaptain Yuri\t\n');
  assert.equal(passageTeacher('Deacon Yashua', undefined, new Map(), map), 'Deacon Yoshua');
  assert.equal(passageTeacher(' captain yuri ', undefined, new Map(), map), 'Captain Uri');
  assert.equal(passageTeacher('Bishop Nathanyel', undefined, new Map(), map), 'Bishop Nathanyel');
  assert.equal(passageTeacher('', undefined, new Map(), map), '');
  // A bare rank named for a recording by rank-teachers.tsv is resolved before the spelling.
  const rank = new Map([['ABCDEFGHIJK', [{ rank: 'deacon', teacher: 'Deacon Yashua' }]]]);
  assert.equal(passageTeacher('Deacon', 'ABCDEFGHIJK', rank, map), 'Deacon Yoshua');
});

test('no caption spelling of a leader reaches a verse from the per-passage teachers', () => {
  const teachers = JSON.parse(fs.readFileSync(new URL('../data/precepts/teachers.json', import.meta.url), 'utf8'));
  const leaked = new Set();
  for (const name of Object.values(teachers)) {
    const shown = passageTeacher(name, undefined, ranks, names);
    if (names.has(String(shown).trim().toLowerCase()) && !official.has(shown)) leaked.add(`${name} -> ${shown}`);
  }
  assert.deepEqual([...leaked], []);
});

test('two different men are never listed as spellings of each other', () => {
  // Kept apart by the owner's rulings in data/names.tsv: Mattathias, Matthew and Matt are three men;
  // Malachi and Malachiyah are two; Yadin and Yadon are two; Zakai and Captain Zakar are two.
  for (const [a, b] of [['Captain Mattathias', 'Captain Matthew'], ['Captain Mattathias', 'Captain Matt'], ['Captain Matthew', 'Captain Matt'], ['Deacon Malachi', 'Deacon Malachiyah'], ['Captain Yadin', 'Captain Yadon'], ['Zakai', 'Captain Zakar']]) {
    assert.notEqual(names.get(a.toLowerCase()) ?? a, names.get(b.toLowerCase()) ?? b, `${a} / ${b}`);
  }
});

test('the verse commentary, precepts and class moments name each teacher as the class pages do', async () => {
  const { loadLibrary } = await import('./library.mjs');
  const lib = loadLibrary(ROOT);
  const leaked = new Set();
  const look = (teacher) => { if (teacher && names.has(teacher.trim().toLowerCase()) && !official.has(teacher)) leaked.add(teacher); };
  for (const [, list] of lib.commentary) for (const p of list) look(p.note?.teacher);
  for (const [, list] of lib.moments) for (const m of list) look(m.teacher);
  assert.deepEqual([...leaked].sort(), []);
});
