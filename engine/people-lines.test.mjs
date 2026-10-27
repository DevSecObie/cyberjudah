import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateLines, descendantsOf } from './people-lines.mjs';
const doc = JSON.parse(fs.readFileSync(new URL('../data/people/people.json', import.meta.url)));
const bibleDir = fileURLToPath(new URL('../data/bible', import.meta.url));
const byId = new Map(doc.people.map((p) => [p.id, p]));

test('every line in the catalog names a forefather its verses name', () => assert.deepEqual(validateLines(doc, { bibleDir }), []));

test('Mattathias goes back to Levi: John, Simeon, the sons of Joarib, Aaron, Amram, Kohath', () => {
  const up = (id) => { const p = byId.get(id); return [...p.father, ...(p.line ?? []).map((e) => e.id)]; };
  const path = ['mattathias-1ma-2-1', 'john-1ma-2-1', 'simeon-1ma-2-1', 'jehoiarib-1ch-24-7', 'aaron-exo-4-14', 'amram-exo-6-18', 'kohath-gen-46-11', 'levi-gen-29-34'];
  for (let i = 1; i < path.length; i++) assert.ok(up(path[i - 1]).includes(path[i]), `${path[i - 1]} -> ${path[i]}`);
  assert.deepEqual(descendantsOf(doc).get('jehoiarib-1ch-24-7').map((d) => d.id).sort(), ['simeon-1ma-2-1', 'simon-1ma-2-3']);
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
