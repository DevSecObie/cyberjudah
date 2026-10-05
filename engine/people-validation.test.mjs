import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validatePeople,personPicture} from './people-validation.mjs';
const doc=JSON.parse(fs.readFileSync(new URL('../data/people/people.json',import.meta.url)));
test('all existing profiles, including explicitly recorded unresolved legacy links, remain valid',()=>assert.deepEqual(validatePeople(doc),[]));
test('new broken relationships and uncredited or unsafe pictures fail the content gate',()=>{
  const changed=structuredClone(doc);changed.people[0].children.push('invented-person');assert.match(validatePeople(changed).join(' '),/must name another/);
  for(const image of [{src:'javascript:alert(1)',sourceUrl:'https://example.org'}, {src:'https://example.org/photo.jpg',sourceUrl:'https://example.org',caption:'Art',credit:'Artist'}]){changed.people[0].image=image;assert.match(validatePeople(changed).join(' '),/image/);}
});
test('credited picture metadata reaches the reader without creating a picture for existing profiles',()=>{
  assert.deepEqual(personPicture(doc.people[0]),{});
  const image={src:'https://example.org/photo.jpg',sourceUrl:'https://example.org',caption:'Artist’s depiction',credit:'Artist',license:'CC0'};
  const changed=structuredClone(doc);changed.people[0].image=image;assert.deepEqual(validatePeople(changed),[]);assert.deepEqual(personPicture(changed.people[0]),{image});
});
