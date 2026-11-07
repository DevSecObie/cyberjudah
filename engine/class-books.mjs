import { createHash } from 'node:crypto';

const KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
const titleKey = title => String(title).normalize('NFKD').replace(/[^\x00-\x7f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 170) || 'book';

/** Stable identities also work for the existing shelf before the next complete-list build. */
export function classBookKeys(rows) {
  const bases = rows.map(row => row.slug || row.archive || titleKey(row.title));
  const counts = new Map();
  for (const key of bases) counts.set(key, (counts.get(key) || 0) + 1);
  return rows.map((row, index) => {
    let key = row.key || bases[index];
    if (!row.key && !row.slug && !row.archive && counts.get(key) > 1) key += '-' + createHash('sha256').update(`${row.title}\0${row.author}`).digest('hex').slice(0, 8);
    if (!KEY.test(key)) throw new Error(`Invalid class-book key: ${key}`);
    return key;
  });
}

/** Enrich existing recording metadata without changing the words quoted from it. */
export function classBookList(row, complete, notes) {
  if (complete.key !== row.key || !Array.isArray(complete.moments)) throw new Error(`Invalid class-book list: ${row.key}`);
  const seen = new Set();
  const moments = complete.moments.map(moment => {
    if (!/^[A-Za-z0-9_-]{11}$/.test(moment.video) || seen.has(moment.video) || !Number.isInteger(moment.t) || moment.t < 0 || typeof moment.said !== 'string') throw new Error(`Invalid recording in class-book list: ${row.key}`);
    seen.add(moment.video);
    const note = notes.get(moment.video.toLowerCase());
    return { video: moment.video, t: moment.t, title: note?.title ?? moment.title, date: note?.date ?? moment.date ?? null,
      teacher: note?.teacher ?? moment.teacher ?? '', url: note?.url ?? moment.url ?? null, said: [...moment.said].slice(0, 300).join('') };
  }).sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')) || b.video.localeCompare(a.video));
  if (complete.total !== moments.length || row.recordings !== moments.length) throw new Error(`Class-book count does not match its complete list: ${row.key}`);
  return { key: row.key, title: complete.title, total: moments.length, moments };
}
