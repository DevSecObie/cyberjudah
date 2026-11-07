import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classBookKeys, classBookList } from './class-books.mjs';

test('keys prefer exact library/archive identities and disambiguate title collisions stably', () => {
  const rows = [{ title: 'Alias one', slug: 'held-book' }, { title: 'Alias two', slug: 'held-book' }, { title: 'Archived book', archive: 'Archive.ID_1970' }, { title: 'Same title', author: 'One' }, { title: 'Same title', author: 'Two' }];
  const keys = classBookKeys(rows);
  assert.deepEqual(keys.slice(0, 3), ['held-book', 'held-book', 'Archive.ID_1970']);
  assert.notEqual(keys[3], keys[4]);
  assert.deepEqual(classBookKeys([...rows].reverse()), [...keys].reverse());
  assert.throws(() => classBookKeys([{ key: '../outside', title: 'Invalid' }]));
});

test('all counted classes survive enrichment, with newest-first dates and verbatim excerpts', () => {
  const moments = Array.from({ length: 12 }, (_, number) => ({ video: String(number).padStart(11, '0'), t: number * 10, title: `Class ${number}`, date: `2025-01-${String(number + 1).padStart(2, '0')}`, teacher: '', url: `https://www.youtube.com/watch?v=${String(number).padStart(11, '0')}`, said: 'Exact source words. '.repeat(25) }));
  const notes = new Map([['00000000000', { title: 'Existing note title', date: '2026-01-01', teacher: 'Existing teacher', url: '/classes/existing-note' }]]);
  const list = classBookList({ key: 'held-book', recordings: 12 }, { key: 'held-book', title: 'Recorded title', total: 12, moments }, notes);
  assert.equal(list.total, 12);
  assert.equal(list.moments.length, 12);
  assert.equal(list.moments[0].title, 'Existing note title');
  assert.equal(list.moments[0].teacher, 'Existing teacher');
  assert.equal(list.moments[0].url, '/classes/existing-note');
  assert.ok(list.moments.every(moment => moment.said.length <= 300 && moments[0].said.startsWith(moment.said)));
  assert.equal(moments[0].said.length, 500);
});

test('duplicate, truncated or mismatched lists cannot be published as complete', () => {
  const moment = { video: 'aaaaaaaaaaa', t: 10, title: 'Class', date: null, teacher: '', url: 'https://example.test/class', said: 'Exact words.' };
  const row = { key: 'book', recordings: 1 }, complete = { key: 'book', title: 'Book', total: 1, moments: [moment] };
  assert.equal(classBookList(row, complete, new Map()).moments[0].date, null);
  assert.throws(() => classBookList(row, { ...complete, total: 385 }, new Map()));
  assert.throws(() => classBookList(row, { ...complete, moments: [moment, moment] }, new Map()));
  assert.throws(() => classBookList(row, { ...complete, key: 'other-book' }, new Map()));
});
