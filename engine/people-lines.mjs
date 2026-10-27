import { evidenceVerseText } from './people-evidence.mjs';

// A person's line: forefathers the KJV names without the generations between, as in
// "Mattathias the son of John, the son of Simeon, a priest of the sons of Joarib" (1 Maccabees
// 2:1). Each entry is { id, verses }: the forefather, and the verses that say it. A line is not a
// father, so nothing unnamed is put between them; the app shows it as a forefather, and the
// forefather shows the person among their descendants.

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const names = (person, text) => (person.names ?? []).some((form) => new RegExp(`\\b${form.split(/[-\s]+/).map(escapeRegExp).join('[-–\\s]?')}\\b`).test(text));

/** Every line must name another catalog person, cite verses that name that forefather, and never
 * lead back to the person through lines and fathers. */
export function validateLines(peopleDoc, { bibleDir }) {
  const problems = [], byId = new Map(peopleDoc.people.map((p) => [p.id, p])), cache = new Map();
  for (const p of peopleDoc.people) {
    if (p.line === undefined) continue;
    if (!Array.isArray(p.line)) { problems.push(`${p.id}: line must be a list`); continue; }
    const seen = new Set();
    for (const entry of p.line) {
      const forefather = byId.get(entry?.id);
      if (!forefather || entry.id === p.id) { problems.push(`${p.id}: line must name another catalog person`); continue; }
      if (seen.has(entry.id)) problems.push(`${p.id}: repeated line ${entry.id}`);
      seen.add(entry.id);
      if (!Array.isArray(entry.verses) || !entry.verses.length) { problems.push(`${p.id}: line ${entry.id} needs the verses that say it`); continue; }
      for (const ref of entry.verses) {
        const text = evidenceVerseText(ref, bibleDir, cache);
        if (text === null) problems.push(`${p.id}: line ${entry.id} verse ${ref} does not resolve to a verse in data/bible`);
        else if (!names(forefather, text)) problems.push(`${p.id}: line ${entry.id} verse ${ref} does not name ${forefather.names.join(', ')}`);
      }
    }
  }
  const lineIds = (p) => (Array.isArray(p.line) ? p.line : []).filter((e) => e?.id !== undefined).map((e) => e.id);
  const up = (p) => [...p.father, ...p.mother, ...lineIds(p)];
  for (const p of peopleDoc.people) {
    const stack = lineIds(p), seen = new Set();
    while (stack.length) {
      const id = stack.pop();
      if (id === p.id) { problems.push(`${p.id}: line leads back to the person`); break; }
      if (seen.has(id)) continue;
      seen.add(id);
      const q = byId.get(id); if (q) stack.push(...up(q));
    }
  }
  return problems;
}

/** Who names each person as a forefather, by the forefather's id. */
export function descendantsOf(peopleDoc) {
  const out = new Map();
  for (const p of peopleDoc.people) for (const e of p.line ?? []) {
    if (!out.has(e.id)) out.set(e.id, []);
    out.get(e.id).push({ ...e, id: p.id });
  }
  return out;
}

// How sure an identification or relationship is (Obie, 2026-10-27): what the KJV with Apocrypha says
// comes first, then a clear parallel passage, then history; a different manuscript reading is a
// variant. Nothing is marked uncertain (Obie, 16:15Z): a link the text does not make is left out. The app shows the label beside the link.
export const EVIDENCE = { scripture: 'Scripturally confirmed', parallel: 'Parallel identification', history: 'Historically identified', variant: 'Textual variant' };
const says = (text, form) => new RegExp(`\\b${form.split(/[-\s]+/).map(escapeRegExp).join('[-–\\s]?')}\\b`).test(text);

/** A person's other links: `same` (another record the text may mean), `priestly` (the priests'
 * course they served in), `titles` (an office the text calls them by) and `variants` (another
 * manuscript reading of their name). Each carries its evidence and the verses that show it. */
export function validateLinks(peopleDoc, { bibleDir }) {
  const problems = [], byId = new Map(peopleDoc.people.map((p) => [p.id, p])), cache = new Map();
  const check = (p, what, verses, forms, need) => {
    if (!Array.isArray(verses) || (need && !verses.length)) { problems.push(`${p.id}: ${what} needs the verses that show it`); return; }
    for (const ref of verses) {
      const text = evidenceVerseText(ref, bibleDir, cache);
      if (text === null) problems.push(`${p.id}: ${what} verse ${ref} does not resolve to a verse in data/bible`);
      else if (!forms.some((f) => says(text, f))) problems.push(`${p.id}: ${what} verse ${ref} does not name ${forms.join(', ')}`);
    }
  };
  const evidence = (p, what, e) => {
    if (!(e.evidence in EVIDENCE)) { problems.push(`${p.id}: ${what} evidence must be one of ${Object.keys(EVIDENCE).join(', ')}`); return false; }
    if ((e.evidence === 'history' || e.evidence === 'variant') && !(typeof e.note === 'string' && e.note.trim()) && !(e.verses ?? []).length) problems.push(`${p.id}: ${what} (${e.evidence}) needs a note or verses saying why`);
    if (e.sources !== undefined && (!Array.isArray(e.sources) || e.sources.some((x) => typeof x?.id !== 'string' || typeof x.locator !== 'string' || !x.locator.trim()))) problems.push(`${p.id}: ${what} sources need a catalog id and an exact locator (docs/library/historical-person-sources.md)`);
    return true;
  };
  const targetForms = (q) => [...q.names, ...(q.titles ?? []).map((t) => t.title)];
  for (const p of peopleDoc.people) {
    for (const key of ['same', 'priestly']) {
      if (p[key] === undefined) continue;
      if (!Array.isArray(p[key])) { problems.push(`${p.id}: ${key} must be a list`); continue; }
      const seen = new Set();
      for (const e of p[key]) {
        const q = byId.get(e?.id);
        if (!q || e.id === p.id) { problems.push(`${p.id}: ${key} must name another catalog person`); continue; }
        if (seen.has(e.id)) problems.push(`${p.id}: repeated ${key} ${e.id}`);
        seen.add(e.id);
        if (!evidence(p, `${key} ${e.id}`, e)) continue;
        check(p, `${key} ${e.id}`, e.verses ?? [], targetForms(q), e.evidence === 'scripture' || e.evidence === 'parallel' || key === 'priestly');
      }
    }
    if (p.titles !== undefined) {
      if (!Array.isArray(p.titles)) problems.push(`${p.id}: titles must be a list`);
      else for (const t of p.titles) {
        if (typeof t?.title !== 'string' || !t.title.trim()) { problems.push(`${p.id}: a title needs its wording`); continue; }
        if (evidence(p, `title ${t.title}`, t)) check(p, `title ${t.title}`, t.verses, [t.title], true);
      }
    }
    if (p.variants !== undefined) {
      if (!Array.isArray(p.variants)) problems.push(`${p.id}: variants must be a list`);
      else for (const v of p.variants) if (typeof v?.reading !== 'string' || !v.reading.trim() || typeof v.note !== 'string' || !v.note.trim()) problems.push(`${p.id}: a variant needs its reading and a note`);
    }
    for (const e of Array.isArray(p.line) ? p.line : []) if (e?.evidence !== undefined && !(e.evidence in EVIDENCE)) problems.push(`${p.id}: line ${e.id} evidence must be one of ${Object.keys(EVIDENCE).join(', ')}`);
  }
  return problems;
}

/** Who links to each person through `same` or `priestly`, by the person linked to. */
export function linkedFrom(peopleDoc, key) {
  const out = new Map();
  for (const p of peopleDoc.people) for (const e of p[key] ?? []) {
    if (!out.has(e.id)) out.set(e.id, []);
    out.get(e.id).push({ ...e, id: p.id });
  }
  return out;
}
