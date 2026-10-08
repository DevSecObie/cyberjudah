import test from 'node:test';
import assert from 'node:assert/strict';
import { parseClassMetadata, correctedClass, classCatalog, CLASS_HEADER, loadClassBroadcasts } from './class-metadata.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const video = 'ABCDEFGHIJK';
test('a corrected undated class is dated in notes, verse readings and the CMS catalog without changing its URL',()=>{
  const overrides = parseClassMetadata(`${CLASS_HEADER}\n${video}\tRecorded teacher\t2024-02-29\tCorrect title\n`);
  const note = {videoId:video,kind:'class',title:'Original title',teacher:'',date:'',year:'undated',file:'blog/2024/test.md',url:'/classes/undated-original',dateEstimated:true,body:'Keep every word'};
  const changed = correctedClass(note,overrides);
  assert.deepEqual([changed.title,changed.date,changed.teacher,changed.year,changed.dateEstimated],['Correct title','2024-02-29','Recorded teacher','2024',false]);
  assert.equal(changed.url,note.url); assert.equal(changed.body,note.body);
  const videos = {[video]:{title:'Original title',date:'',teacher:''},'LMNOPQRSTUV':{title:'Still undated',date:''}};
  const rows = classCatalog(videos,[note],overrides);
  assert.equal(rows[0].date,'2024-02-29'); assert.equal(rows[0].file,note.file); assert.equal(rows[1].date,'');
  assert.equal(correctedClass(videos[video],overrides,video).teacher,'Recorded teacher');
});
test('invalid dates, duplicate ids and malformed TSV rows fail the publication gate',()=>{
  assert.equal(parseClassMetadata(CLASS_HEADER+'\n').size,0);
  for(const text of ['video\tteacher',`${CLASS_HEADER}\n${video}\tTeacher\t2025-02-29\tTitle`,`${CLASS_HEADER}\n../escape\tTeacher\t\tTitle`,`${CLASS_HEADER}\n${video}\tTeacher\t\t`,`${CLASS_HEADER}\n${video}\tTeacher\t\tTitle\tInjected`,`${CLASS_HEADER}\n${video}\tTeacher\t\tTitle\n${video}\tTeacher\t\tTitle`]) assert.throws(()=>parseClassMetadata(text));
});
test('broadcast metadata preserves the teaching day and rejects malformed records', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'broadcasts-'));
  try {
    assert.deepEqual(loadClassBroadcasts(root), {});
    const file = path.join(root, 'data/sources/class-broadcasts.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const row = { date: '2026-10-03', broadcastAt: '2026-10-04T00:05:00Z' };
    fs.writeFileSync(file, JSON.stringify({ [video]: row }));
    assert.deepEqual(loadClassBroadcasts(root), { [video]: row });
    for (const invalid of [{ ...row, date: '2026-02-30' }, { ...row, broadcastAt: '2026-10-03' }, { ...row, broadcastAt: 'bad' }]) {
      fs.writeFileSync(file, JSON.stringify({ [video]: invalid }));
      assert.throws(() => loadClassBroadcasts(root), /Invalid broadcast metadata/);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('the checked-in broadcast catalog is valid', () => {
  assert.ok(Object.keys(loadClassBroadcasts(new URL('..', import.meta.url).pathname)).length > 0);
});
