// The link checker. The Docusaurus build used to be the gate (onBrokenLinks: throw); this
// does the same job against the library itself, in a few seconds, with no site build:
// every site-relative link in every note must point at a chapter, verse, note, law,
// precept, case or encyclopedia entry the library knows.
//
//   node engine/check.mjs          exit 1 on any broken link
import { loadLibrary } from "./library.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const L = loadLibrary(ROOT);
const { BOOKS, bible, bookSlug, handbook, sectionUrl, sortedPrecepts, preceptUrl, cases, caseUrl, notes } = L;

const slugToBook = new Map(BOOKS.map((b) => [bookSlug[b], b]));
const known = new Set();
for (const n of notes) known.add(n.url);
for (const p of handbook.parts) for (const s of p.sections) { known.add(sectionUrl(s)); for (const e of s.entries) known.add(`${sectionUrl(s)}#${s.id}.${e.n}`); }
for (const t of sortedPrecepts) known.add(preceptUrl(t));
for (const c of cases.cases) known.add(caseUrl(c));
for (const p of ["/", "/bible", "/study", "/classes", "/captains", "/history", "/cases", "/law", "/precepts", "/concordance", "/encyclopedia", "/topics", "/search", "/api", "/downloads", "/about"]) known.add(p);
for (const b of BOOKS) { known.add(`/bible/${bookSlug[b]}`); known.add(`/study/${bookSlug[b]}`); known.add(`/concordance/${bookSlug[b]}`); }
for (const t of L.topics) known.add(`/topics/${t.slug}`);

const LINK = /\]\(((?:\/|#)[^)\s]*)\)|href="((?:\/|#)[^"]*)"/g;
let broken = 0, links = 0;
const report = (n, href, why) => { broken++; console.error(`${n.file}: ${href}: ${why}`); };

for (const n of notes) {
  for (const m of n.body.matchAll(LINK)) {
    const href = m[1] ?? m[2];
    if (!href || href.startsWith("#")) continue;
    links++;
    const [pathPart, hash] = href.split("#");
    const clean = pathPart.replace(/\/$/, "").split("?")[0] || "/";
    const bm = clean.match(/^\/bible\/([a-z0-9-]+)\/(\d+)$/);
    if (bm) {
      const book = slugToBook.get(bm[1]);
      if (!book) { report(n, href, "no such book"); continue; }
      const chapter = bible[book]?.[bm[2]];
      if (!chapter) { report(n, href, `no chapter ${bm[2]} in ${book}`); continue; }
      const vm = hash?.match(/^v(\d+)(?:-(\d+))?$/);
      if (hash && !vm) { report(n, href, "bad verse anchor"); continue; }
      if (vm) {
        const last = Number(vm[2] ?? vm[1]);
        if (Number(vm[1]) < 1 || last > chapter.length || !chapter[last - 1]) report(n, href, `${book} ${bm[2]} has ${chapter.length} verses`);
      }
      continue;
    }
    if (/^\/(img|assets|downloads|api|search|classes\/rss|captains\/rss|study\/rss)\b/.test(clean)) continue;
    if (!known.has(clean) && !known.has(`${clean}#${hash ?? ""}`)) report(n, href, "nothing at that path");
  }
}
console.error(`check: ${notes.length} notes, ${links} links, ${broken} broken`);
process.exit(broken ? 1 : 0);
