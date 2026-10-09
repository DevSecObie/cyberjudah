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

// A name form matches with its hyphen/space joins optional (so "Esar-haddon" meets
// "Esarhaddon" in 2-kings/19/37) and a trailing s/'s accepted (so "Israelite" meets
// "Israelites" in exodus/9/7), \b anchored on both ends as check.py anchors the
// unnormalised form.
function namePattern(form) {
  const parts = form.split(/[-\s]+/).filter(Boolean).map(escapeRegExp);
  return new RegExp(`\\b${parts.join('[-\\s]?')}'?s?\\b`);
}

// The same pattern without the optional trailing s/'s, to tell whether a match only
// succeeded because of that suffix (the hyphen/space join stays optional — it is part
// of the form itself, not a cross-name risk).
function strictNamePattern(form) {
  const parts = form.split(/[-\s]+/).filter(Boolean).map(escapeRegExp);
  return new RegExp(`\\b${parts.join('[-\\s]?')}\\b`);
}

// Every literal name form in the catalog, mapped to the person id(s) that carry it.
// Used to refuse a match that only works through the optional trailing s — "Juda" must
// not meet "Judas" in a verse just because Judas is itself a different person's own
// name form (CYB-451's finding on PR #144).
function buildFormOwners(peopleDoc) {
  const owners = new Map();
  for (const p of peopleDoc.people ?? []) {
    for (const form of p.names ?? []) {
      if (typeof form !== 'string' || !form.trim()) continue;
      const key = form.trim();
      if (!owners.has(key)) owners.set(key, new Set());
      owners.get(key).add(p.id);
    }
  }
  return owners;
}

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
 * a reason. `exceptions` maps "personId|book/chapter/verse" to the written reason.
 * `beforeDoc`, when given, is the catalog before the batch: a changed person's verses
 * that already cited the same reference before the batch are not re-proven — only
 * `person.verses - before.verses` (all verses, for a person new to `beforeDoc`) needs
 * evidence, matching docs/proposals/apocrypha/check.py in cyberjudah-telegram. */
export function validatePeopleEvidence(peopleDoc, ids, { bibleDir, exceptions = {}, beforeDoc = null } = {}) {
  const problems = [];
  const byId = new Map((peopleDoc.people ?? []).map((p) => [p.id, p]));
  const beforeById = new Map((beforeDoc?.people ?? []).map((p) => [p.id, p]));
  const formOwners = buildFormOwners(peopleDoc);
  const cache = new Map();
  for (const id of ids ?? []) {
    const person = byId.get(id);
    if (!person) continue;
    // A future batch may carry the proposal's source field; when it does, only the KJV
    // with Apocrypha is in scope. Batches without it are checked as-is (see note above).
    if (person.source?.name && person.source.name !== KJV_SOURCE) continue;
    const forms = (person.names ?? []).filter((f) => typeof f === 'string' && f.trim());
    const beforeVerses = new Set(beforeById.get(id)?.verses ?? []);
    for (const ref of person.verses ?? []) {
      if (beforeVerses.has(ref)) continue; // already cited before this batch; not this batch's claim to prove
      const key = `${id}|${ref}`;
      const text = evidenceVerseText(ref, bibleDir, cache);
      if (text === null) {
        problems.push(`${id}: verse ${ref} does not resolve to a verse in data/bible`);
        continue;
      }
      const named = forms.some((form) => {
        const match = namePattern(form).exec(text);
        if (!match) return false;
        if (strictNamePattern(form).test(text)) return true; // matches without the trailing s/'s; no cross-name risk
        // Only matched through the optional suffix: refuse it if the matched word is
        // itself another person's own name form (e.g. "Juda" must not meet "Judas").
        const owners = formOwners.get(match[0]);
        return !owners || [...owners].every((ownerId) => ownerId === id);
      });
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
