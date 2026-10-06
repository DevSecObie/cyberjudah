import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { changedPersonIds, validateReciprocity } from './people-reciprocity.mjs';

const peopleDoc = JSON.parse(fs.readFileSync(new URL('../data/people/people.json', import.meta.url)));

test('an id with no relations at all has nothing to check', () => {
  const noRelations = peopleDoc.people.find((p) => ['father', 'mother', 'siblings', 'partners', 'children'].every((k) => !(p[k]?.length)));
  assert.ok(noRelations, 'fixture must contain a person with no relation fields to make this test meaningful');
  assert.deepEqual(validateReciprocity(peopleDoc, [noRelations.id]), []);
});

test('a one-directional relationship from a changed id fails the check', () => {
  const changed = structuredClone(peopleDoc);
  const parent = changed.people[0], child = changed.people[1];
  parent.children = [...(parent.children ?? []), child.id]; // only the parent side names the link
  const problems = validateReciprocity(changed, [parent.id]);
  assert.match(problems.join(' '), new RegExp(`${parent.id}: children names ${child.id}, but ${child.id} does not name ${parent.id} back`));
});

test('a two-way link the batch adds on both sides passes', () => {
  const changed = structuredClone(peopleDoc);
  const parent = changed.people[0], child = changed.people[1];
  parent.children = [...(parent.children ?? []), child.id];
  child.father = [...(child.father ?? []), parent.id];
  assert.deepEqual(validateReciprocity(changed, [parent.id, child.id]), []);
});

test('siblings and partners are symmetric', () => {
  const changed = structuredClone(peopleDoc);
  const a = changed.people[0], b = changed.people[1];
  a.siblings = [...(a.siblings ?? []), b.id];
  assert.match(validateReciprocity(changed, [a.id]).join(' '), new RegExp(`${a.id}: siblings names ${b.id}`));
  b.siblings = [...(b.siblings ?? []), a.id];
  assert.deepEqual(validateReciprocity(changed, [a.id, b.id]), []);
});

test('a documented exception is accepted without a reverse link', () => {
  const changed = structuredClone(peopleDoc);
  const parent = changed.people[0], child = changed.people[1];
  parent.children = [...(parent.children ?? []), child.id];
  assert.deepEqual(validateReciprocity(changed, [parent.id], [`${parent.id}|children|${child.id}`]), []);
});

test('a link to an id outside the catalog is left for validatePeople, not flagged here', () => {
  const changed = structuredClone(peopleDoc);
  changed.people[0].children = [...(changed.people[0].children ?? []), 'not-a-real-id'];
  assert.deepEqual(validateReciprocity(changed, [changed.people[0].id]), []);
});

test('changedPersonIds finds new and edited ids, and leaves untouched ids out', () => {
  const before = { people: [{ id: 'a', name: 'A', verses: [] }, { id: 'b', name: 'B', verses: [] }] };
  const after = { people: [{ id: 'a', name: 'A', verses: ['genesis/1/1'] }, { id: 'b', name: 'B', verses: [] }, { id: 'c', name: 'C', verses: [] }] };
  assert.deepEqual(changedPersonIds(before, after), ['a', 'c']);
});

test('with no prior catalog (a new file), every person counts as changed', () => {
  const after = { people: [{ id: 'a', name: 'A', verses: [] }] };
  assert.deepEqual(changedPersonIds(null, after), ['a']);
});
