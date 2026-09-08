import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dictionaryRefs } from '../src/lib/dictionary-refs.mjs';
const bounds = JSON.parse(fs.readFileSync(new URL('../src/data/dictionary/verse-bounds.json',import.meta.url)));
test('dictionary citations preserve text, ranges, lists and inherited chapters', () => {
  const text = 'See Rev. 1:8, 11; 21:6; 22:13 and Ex. 6:20; 1 Chr. 2:10.';
  const parts = dictionaryRefs(text,bounds);
  assert.equal(parts.map(p=>p.text).join(''),text);
  assert.deepEqual(parts.filter(p=>p.href).map(p=>p.href), ['/bible/revelation/1#v8','/bible/revelation/21#v6','/bible/revelation/22#v13','/bible/exodus/6#v20','/bible/1-chronicles/2#v10']);
  assert.equal(parts.find(p=>p.href).verses,'8, 11');
  assert.equal(dictionaryRefs('Num. 20:23-29',bounds)[0].verses,'23-29');
});
test('invalid and ambiguous references remain plain text', () => {
  for (const text of ['Gen. 99:1','Genesis 1:999','Gen. 1:9-2','Born in 1897 (2:1, 4).','<script>alert(1)</script>']) {
    const parts = dictionaryRefs(text,bounds);
    assert.equal(parts.map(p=>p.text).join(''),text);
    assert.ok(parts.every(p=>!p.href));
  }
});
test('every imported paragraph round-trips without changing its text', () => {
  const entries = JSON.parse(fs.readFileSync(new URL('../src/data/dictionary/easton.json',import.meta.url)));
  for (const entry of entries) for (const p of entry.definitions) assert.equal(dictionaryRefs(p,bounds).map(t=>t.text).join(''),p,entry.term);
});
