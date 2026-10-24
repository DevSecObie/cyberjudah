import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLibrary } from './library.mjs';

// A class note's points go to the verse they speak to, in Comments; a precept carries only its
// own lines and breakdown, never the last point before it.
test('a class point reaches Comments only when it speaks to the verse, and never rides on a precept', () => {
  const root = fileURLToPath(new URL('../', import.meta.url)), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'class-points-'));
  try {
    for (const name of fs.readdirSync(root)) if (name !== 'blog') fs.symlinkSync(path.join(root, name), path.join(tmp, name));
    fs.mkdirSync(path.join(tmp, 'blog/2099'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'blog/2099/2099-01-01-points-fixture.md'), [
      '---', 'title: "Points fixture"', 'slug: "2099/2099-01-01-points-fixture"', 'date: "2099-01-01"', 'teacher: "Bishop Nathanyel"', '---', '',
      '**[Leviticus 15:19](/bible/leviticus/15#v19)**  *[[1:00](https://www.youtube.com/watch?v=FIXTURE0001&t=60s)]*', '',
      '- If her issue in her flesh be blood, she shall be put apart seven days.', '',
      '- A woman in her issue is put apart seven days; that is the law of separation for our women.', '',
      '- Put apart: separated.', '',
      '- All these pictures are in Paris, France.', '',
      '  Precepts:',
      '  - **[Genesis 1:5](/bible/genesis/1#v5)**',
      '    The evening and the morning were the first day.',
      '',
    ].join('\n'));
    const { linked, commentary } = loadLibrary(tmp);
    const rows = [...linked.values()].flat().filter((r) => r.note.label === 'Points fixture');
    assert.equal(rows.length, 2);
    for (const r of rows) {
      assert.equal(r.point, '', `${r.kind} row carries no class point`);
      assert.equal(r.text, 'The evening and the morning were the first day.');
    }
    const comments = (commentary.get('Leviticus|15') ?? []).filter((c) => c.note.label === 'Points fixture');
    assert.deepEqual(comments.map((c) => [c.verses, c.points]), [['19', ['A woman in her issue is put apart seven days; that is the law of separation for our women.', 'Put apart: separated.']]]);
    assert.equal((commentary.get('Genesis|1') ?? []).some((c) => c.note.label === 'Points fixture'), false);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
