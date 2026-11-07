import fs from "node:fs";
import path from "node:path";

/**
 * Who and where each chapter names: api/people/by-chapter/<book-slug>/<chapter>.json and
 * api/places/by-chapter/<book-slug>/<chapter>.json, so a reader fetches one small file per
 * chapter instead of every person or place. Each row copies fields from the person's or place's
 * own record (id, name, names, and image where the record has one) plus the verses of that
 * chapter it is named in, taken from the record's own verse list. Nothing is written in new words.
 */

/** Size limits a chapter file and a whole index must stay under (bytes). */
export const BY_CHAPTER_BUDGET = { file: 32 * 1024, total: 3 * 1024 * 1024 };

const REF = /^([a-z0-9-]+)\/(\d+)\/(\d+)$/;

/**
 * records: people or places, each { id, name, names, verses: ["<book-slug>/<ch>/<v>"], image? }.
 * Returns Map "<book-slug>|<ch>" -> rows, ordered by the first verse the row is named in, then
 * by the records' own order (stable for equal verses). A record appears once per chapter.
 * The build has already checked every reference is a real verse (validateKjvPeople/Places).
 */
export function chapterIndex(records) {
  const chapters = new Map(), ids = new Set();
  records.forEach((r, order) => {
    if (ids.has(r.id)) throw new Error(`by-chapter: ${r.id} appears twice`);
    ids.add(r.id);
    for (const ref of r.verses ?? []) {
      const m = REF.exec(ref);
      if (!m) throw new Error(`by-chapter: ${r.id} has a malformed verse ${ref}`);
      const key = `${m[1]}|${Number(m[2])}`;
      if (!chapters.has(key)) chapters.set(key, new Map());
      const rows = chapters.get(key);
      if (!rows.has(r.id)) rows.set(r.id, { order, seen: new Set(), row: { id: r.id, name: r.name, names: r.names, ...(r.image ? { image: r.image } : {}), verses: [] } });
      const entry = rows.get(r.id), v = Number(m[3]);
      if (!entry.seen.has(v)) { entry.seen.add(v); entry.row.verses.push(v); }
    }
  });
  const out = new Map();
  for (const [key, rows] of chapters) {
    const list = [...rows.values()];
    for (const { row } of list) row.verses.sort((a, b) => a - b);
    list.sort((a, b) => a.row.verses[0] - b.row.verses[0] || a.order - b.order);
    out.set(key, list.map(({ row }) => row));
  }
  return out;
}

/**
 * Write one file per chapter of every book, an empty list where the chapter names no one (so a
 * reader never meets a 404). books: [[bookSlug, [chapter numbers]]]. Throws when a record names
 * a chapter that isn't in the Bible, or when a file or the whole index passes the budget.
 */
export function writeByChapter(dir, books, index, budget = BY_CHAPTER_BUDGET) {
  const known = new Set(books.flatMap(([slug, chs]) => chs.map((c) => `${slug}|${c}`)));
  for (const key of index.keys()) if (!known.has(key)) throw new Error(`by-chapter: ${key.replace("|", " ")} is not a chapter`);
  let files = 0, bytes = 0, largest = { key: "", bytes: 0 };
  for (const [slug, chs] of books) {
    fs.mkdirSync(path.join(dir, slug), { recursive: true });
    for (const c of chs) {
      const body = JSON.stringify(index.get(`${slug}|${c}`) ?? []);
      const size = Buffer.byteLength(body);
      if (size > budget.file) throw new Error(`by-chapter: ${slug} ${c} is ${size} bytes, over the ${budget.file}-byte budget`);
      bytes += size;
      if (bytes > budget.total) throw new Error(`by-chapter: over the ${budget.total}-byte budget in all, at ${slug} ${c}`);
      fs.writeFileSync(path.join(dir, slug, `${c}.json`), body);
      files++;
      if (size > largest.bytes) largest = { key: `${slug}/${c}`, bytes: size };
    }
  }
  return { files, bytes, largest };
}
