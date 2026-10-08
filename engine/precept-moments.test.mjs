import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLibrary } from './library.mjs';
test('a precept’s own playback moment reaches both linked verses; an omitted moment retains the passage timestamp',()=>{
  const root=fileURLToPath(new URL('../',import.meta.url)),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cms-precepts-'));
  const linkExcept=(from,to,excluded)=>{fs.mkdirSync(to,{recursive:true});for(const name of fs.readdirSync(from))if(!excluded.includes(name))fs.symlinkSync(path.join(from,name),path.join(to,name));};
  try {
    linkExcept(root,tmp,['data']);linkExcept(path.join(root,'data'),path.join(tmp,'data'),['precepts']);
    linkExcept(path.join(root,'data/precepts'),path.join(tmp,'data/precepts'),['classes']);
    fs.mkdirSync(path.join(tmp,'data/precepts/classes'));
    fs.writeFileSync(path.join(tmp,'data/precepts/classes/CMSPRECEPT1.json'),JSON.stringify({video:'CMSPRECEPT1',title:'Playback fixture',date:'2024-02-29',passages:[{opened:'Genesis 1:1-3',ts:'1:00',precepts:[{ref:'John 1:1',at:'1',why:'Explicit moment',ts:'1:23'},{ref:'John 1:2',at:'2',why:'Passage moment'}]}]}));
    const {linked}=loadLibrary(tmp),rows=[...linked.values()].flat().filter(r=>r.note.label==='Playback fixture');
    assert.equal(rows.length,4);
    assert.deepEqual(rows.filter(r=>r.why==='Explicit moment').map(r=>r.ts),['1:23','1:23']);
    assert.deepEqual(rows.filter(r=>r.why==='Passage moment').map(r=>r.ts),['1:00','1:00']);
  } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});
