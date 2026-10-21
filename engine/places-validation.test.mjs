import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validatePlaces} from './places-validation.mjs';
const doc=JSON.parse(fs.readFileSync(new URL('../data/places/places.json',import.meta.url)));
test('every place from TIPNR is valid',()=>assert.deepEqual(validatePlaces(doc),[]));
test('the places of Genesis 2 are there by their King James names',()=>{
  const named=new Set(doc.places.filter(p=>p.verses.some(v=>v.startsWith('genesis/2/'))).map(p=>p.name));
  for(const name of ['Eden','Pison','Havilah','Gihon','Ethiopia','Hiddekel','Assyria','Euphrates'])assert.ok(named.has(name),name);
});
test('a broken place fails the content gate',()=>{
  const changed=structuredClone(doc);
  changed.places[0].verses=['Genesis 2:8'];changed.places[1].coords=[0,999];changed.places[2].names=[];
  const problems=validatePlaces(changed).join(' ');
  assert.match(problems,/verses must be/);assert.match(problems,/coords must be/);assert.match(problems,/names must include/);
});
