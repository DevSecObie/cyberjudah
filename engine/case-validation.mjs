import { validVerseRange } from "./validation.mjs";

export function validateCases(library) {
  const errors = [];
  const slugs = new Set();
  const laws = new Set(library.handbook.parts.flatMap((p) => p.sections.flatMap((s) => [s.id, ...s.entries.map((e) => `${s.id}.${e.n}`)])));
  for (const c of library.cases.cases) {
    const report = (message) => errors.push(`${c.slug}: ${message}`);
    if (slugs.has(c.slug)) report("duplicate slug (case API keys must be globally unique)");
    slugs.add(c.slug);
    if (!library.cases.eras.includes(c.era)) report("unknown era");
    if (!Object.hasOwn(library.cases.verdicts, c.verdict)) report("unknown verdict");
    for (const field of ["slug", "name", "charge", "summary", "offense", "judgment"]) {
      if (typeof c[field] !== "string" || !c[field].trim()) report(`missing ${field}`);
    }
    if (!Array.isArray(c.refs) || !c.refs.length) { report("missing scripture references"); continue; }
    for (const ref of c.refs) {
      const chapter = library.bible[ref.book]?.[ref.chapter];
      if (!chapter) { report(`unknown chapter: ${ref.book} ${ref.chapter}`); continue; }
      if (ref.verses === undefined || ref.verses === "") continue;
      const spec = String(ref.verses);
      if (!/^\d+(?:-\d+)?(?:\s*,\s*\d+(?:-\d+)?)*$/.test(spec)) { report(`malformed verses: ${spec}`); continue; }
      for (const part of spec.split(",")) {
        const [first, end] = part.trim().split("-").map(Number);
        if (!validVerseRange(first, end ?? first, chapter)) report(`invalid range: ${ref.book} ${ref.chapter}:${part}`);
      }
    }
    for (const law of c.laws ?? []) if (!laws.has(law)) report(`unknown law: ${law}`);
  }
  return errors;
}
