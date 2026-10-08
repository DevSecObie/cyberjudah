import fs from 'node:fs';
import path from 'node:path';

// Scripture-evidence check for People (CYB-313). Ports the name-form matching from
// docs/proposals/apocrypha/check.py (cyberjudah-telegram repo) into this repo's engine:
// every person a batch adds or edits must cite only verses that actually name them.
// Each entry in `verses` (book/chapter/verse) must resolve to a verse in
// data/bible/<book>.json whose text contains one of the person's `names` as a whole
// word — unless engine/people-evidence-exceptions.json records that reference with a
// written reason. Report, do not auto-fix.
//
// Scope follows engine/people-reciprocity.mjs: only the ids a change adds or edits
// (via PEOPLE_BASE in engine/check.mjs) are checked, so the legacy catalog never fails
// CI for data no batch touched. CYB-313 proposed filtering on
// source.name === 'King James Version with Apocrypha', but the real catalog carries no
// source field at all (verified: 0 of 3,234 people on the Judith batch branch have one),
// so that filter would silently check nobody; every changed person is checked instead.
const KJV_SOURCE = 'King James Version with Apocrypha';

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function loadBook(cache, bibleDir, slug) {
  if (!cache.has(slug)) {
    let chapters = null;
    try {
      chapters = JSON.parse(fs.readFileSync(path.join(bibleDir, `${slug}.json`), 'utf8')).chapters;
    } catch { chapters = null; }
    cache.set(slug, chapters);
  }
  return cache.get(slug);
}

/** The KJV text of a book/chapter/verse reference, or null when it does not resolve. */
export function evidenceVerseText(ref, bibleDir, cache = new Map()) {
  const m = /^([a-z0-9-]+)\/(\d+)\/(\d+)$/.exec(ref);
  if (!m) return null;
  const chapters = loadBook(cache, bibleDir, m[1]);
  const verses = chapters?.[m[2]];
  const text = Array.isArray(verses) ? verses[Number(m[3]) - 1] : undefined;
  return typeof text === 'string' ? text : null;
}

/** Every verse a changed person cites must name them (whole-word), or be excepted with
 * a reason. `exceptions` maps "personId|book/chapter/verse" to the written reason. */
export function validatePeopleEvidence(peopleDoc, ids, { bibleDir, exceptions = {} } = {}) {
  const problems = [];
  const byId = new Map((peopleDoc.people ?? []).map((p) => [p.id, p]));
  const cache = new Map();
  for (const id of ids ?? []) {
    const person = byId.get(id);
    if (!person) continue;
    // A future batch may carry the proposal's source field; when it does, only the KJV
    // with Apocrypha is in scope. Batches without it are checked as-is (see note above).
    if (person.source?.name && person.source.name !== KJV_SOURCE) continue;
    const forms = (person.names ?? []).filter((f) => typeof f === 'string' && f.trim());
    for (const ref of person.verses ?? []) {
      const key = `${id}|${ref}`;
      const text = evidenceVerseText(ref, bibleDir, cache);
      if (text === null) {
        problems.push(`${id}: verse ${ref} does not resolve to a verse in data/bible`);
        continue;
      }
      const named = forms.some((form) => new RegExp(`\\b${escapeRegExp(form)}\\b`).test(text));
      if (named) continue;
      const reason = exceptions[key];
      if (typeof reason === 'string' && reason.trim()) continue;
      problems.push(
        `${id}: verse ${ref} names none of ${forms.join(', ') || '(no name forms)'}` +
        (reason === '' || reason ? ` (exception for ${key} needs a reason)` : '') +
        ` — "${text.slice(0, 90)}${text.length > 90 ? '…' : ''}"`,
      );
    }
  }
  return problems;
}
