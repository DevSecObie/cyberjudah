import { evidenceVerseText } from './people-evidence.mjs';

// A person's line: forefathers the KJV names without the generations between, as in
// "Mattathias the son of John, the son of Simeon, a priest of the sons of Joarib" (1 Maccabees
// 2:1). Each entry is { id, verses }: the forefather, and the verses that say it. A line is not a
// father, so nothing unnamed is put between them; the app shows it as a forefather, and the
// forefather shows the person among their descendants.

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const names = (person, text) => (person.names ?? []).some((form) => new RegExp(`\\b${form.split(/[-\s]+/).map(escapeRegExp).join('[-\\s]?')}\\b`).test(text));

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
  const up = (p) => [...p.father, ...p.mother, ...(p.line ?? []).map((e) => e.id)];
  for (const p of peopleDoc.people) {
    if (!p.line?.length) continue;
    const stack = (p.line ?? []).map((e) => e.id), seen = new Set();
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
    out.get(e.id).push({ id: p.id, verses: e.verses });
  }
  return out;
}
