// The library, loaded from the vault and cross-referenced. No output here: this module reads
// the committed source (notes, Bible text, handbook, precepts, cases) and returns plain data
// plus the citation graph. build.mjs turns it into files; any other consumer (a test, a
// migration into a database, a future front end) can import it the same way.
//
// Source, committed and hand-edited, relative to the repository root:
//   docs/study/<book>/<chapter>.md, docs/encyclopedia/<slug>.md    study notes, encyclopedia
//   blog/<year>/*.md, captains/<year>/*.md                          class notes, episodes
//   data/bible/*.json                                               the KJV text with Apocrypha
//   data/handbook.json, data/precepts.json, data/cases.json         the reference works
//   data/lexicon.tsv, data/topics.tsv                               encyclopedia terms, topic labels
//   data/crossrefs.json, data/web-translation.json                  cross references, WEB parallel
import fs from "node:fs";
import path from "node:path";

export const read = (p) => fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "");
export const json = (p) => JSON.parse(read(p));
export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const ABBR = { Genesis: "Gen", Exodus: "Exod", Leviticus: "Lev", Numbers: "Num", Deuteronomy: "Deut", Joshua: "Josh", Judges: "Judg", "1 Samuel": "1 Sam", "2 Samuel": "2 Sam", "1 Kings": "1 Kgs", "2 Kings": "2 Kgs", "1 Chronicles": "1 Chr", "2 Chronicles": "2 Chr", Nehemiah: "Neh", Psalms: "Ps", Proverbs: "Prov", Ecclesiastes: "Eccl", "Song of Solomon": "Song", Isaiah: "Isa", Jeremiah: "Jer", Lamentations: "Lam", Ezekiel: "Ezek", Daniel: "Dan", Hosea: "Hos", Obadiah: "Obad", Micah: "Mic", Nahum: "Nah", Habakkuk: "Hab", Zephaniah: "Zeph", Haggai: "Hag", Zechariah: "Zech", Malachi: "Mal", Matthew: "Matt", Romans: "Rom", "1 Corinthians": "1 Cor", "2 Corinthians": "2 Cor", Galatians: "Gal", Ephesians: "Eph", Philippians: "Phil", Colossians: "Col", "1 Thessalonians": "1 Thess", "2 Thessalonians": "2 Thess", "1 Timothy": "1 Tim", "2 Timothy": "2 Tim", Philemon: "Phlm", Hebrews: "Heb", "1 Peter": "1 Pet", "2 Peter": "2 Pet", Revelation: "Rev", "Wisdom of Solomon": "Wis", Sirach: "Sir", "1 Maccabees": "1 Macc", "2 Maccabees": "2 Macc", "Esther (Greek)": "Esth (Gk)", "Song of the Three Children": "Song Thr", "Bel and the Dragon": "Bel", "Prayer of Manasseh": "Pr Man", "Epistle of Jeremiah": "Ep Jer" };

export const VERDICT = { death: "Put to death", plague: "Plague", exile: "Exile", captivity: "Captivity", curse: "Cursed", restitution: "Restitution", spared: "Spared", reprieve: "Reprieve", temporal: "Temporal judgment", unrecorded: "Sentence not recorded", blessed: "Kept the law" };

/** "1-3, 7" -> [1,2,3,7]; "" -> []. */
export function versesOf(spec) {
  const out = [];
  for (const part of (spec || "").split(",").filter(Boolean)) {
    const [a, b] = part.split("-").map((x) => parseInt(x, 10));
    if (isNaN(a)) continue;
    for (let v = a; v <= (isNaN(b) ? a : b); v++) out.push(v);
  }
  return out;
}
export function firstVerse(spec) { const m = /^(\d+)/.exec(spec || ""); return m ? +m[1] : undefined; }

/** Markdown to plain text, for search bodies: link targets, html and markup dropped. */
export const plain = (md) => md
  .replace(/%%[\s\S]*?%%/g, " ").replace(/!\[\[[^\]]*\]\]/g, " ").replace(/\[\[(?:[^\]|]+\|)?([^\]|]+)\]\]/g, "$1")
  .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/<[^>]+>/g, " ").replace(/[#>*_`\[\]|]+/g, " ").replace(/\s+/g, " ").trim();

function parseFrontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) return [{}, text];
  const o = {};
  const unquote = (v) => /^".*"$/s.test(v) ? v.slice(1, -1).replace(/\\(["\\])/g, "$1")
    : /^'.*'$/s.test(v) ? v.slice(1, -1).replace(/''/g, "'") : v;
  for (const line of m[1].split("\n")) { const i = line.indexOf(":"); if (i > 0) o[line.slice(0, i).trim()] = unquote(line.slice(i + 1).trim()); }
  return [o, text.slice(m[0].length)];
}
const tagList = (v) => [...String(v ?? "").matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\(["\\])/g, "$1"));

export function loadLibrary(ROOT) {
  const DATA = path.join(ROOT, "data");
  const DOCS = path.join(ROOT, "docs");
  const BLOG = path.join(ROOT, "blog");
  const CAPTAINS = path.join(ROOT, "captains");

  /* ---------------- scripture ---------------- */
  const bibleIndex = json(path.join(DATA, "bible", "index.json"));
  const BOOKS = bibleIndex.map((e) => e.book);
  const CANON = BOOKS.slice(0, 66), APOC = BOOKS.slice(66);
  const bookSlug = Object.fromEntries(bibleIndex.map((e) => [e.book, e.slug]));
  const bookBySlug = Object.fromEntries(Object.entries(bookSlug).map(([b, s]) => [s, b]));
  const bookNum = Object.fromEntries(BOOKS.map((b, i) => [b, i + 1]));
  const testament = (b) => (APOC.includes(b) ? "Apocrypha" : CANON.indexOf(b) < 39 ? "Old Testament" : "New Testament");
  const bible = {};
  for (const e of bibleIndex) bible[e.book] = json(path.join(DATA, "bible", e.slug + ".json")).chapters;
  const CHAPTERS = Object.fromEntries(bibleIndex.map((e) => [e.book, e.chapters]));
  const abbr = (b) => ABBR[b] ?? b;
  // Greek Esther exists only as the Additions (chapters 10-16). A reference to 1-9 in that
  // book means canonical Esther, so resolve it there instead of emitting a dead link.
  const resolveChapter = (book, ch) => (bible[book] && bible[book][String(ch)]) ? book : (/^(.+) \(Greek\)$/.exec(book)?.[1] ?? book);
  const chapterUrl = (book, ch, v) => { const b = resolveChapter(book, ch); return `/bible/${bookSlug[b]}/${ch}${v ? "#v" + v : ""}`; };
  const bookUrl = (book) => `/bible/${bookSlug[book]}`;
  const verseText = (book, ch, v) => bible[book]?.[String(ch)]?.[v - 1] ?? null;
  const refLabel = (r) => `${r.book} ${r.chapter}${r.verses ? ":" + r.verses : ""}`;

  /* ---------------- who cites what ---------------- */
  const cited = new Map(); // "Book|ch" -> [{kind, label, url, verses}]
  const cite = (r, kind, label, url) => { const k = `${r.book}|${r.chapter}`; if (!cited.has(k)) cited.set(k, []); cited.get(k).push({ kind, label, url, verses: r.verses || "" }); };
  function uniqueCitations(rows) {
    const seen = new Set();
    return rows.filter((r) => { const k = [r.kind, r.url, r.verses].join("|"); if (seen.has(k)) return false; seen.add(k); return true; });
  }

  /* ---------------- the law ---------------- */
  const handbook = json(path.join(DATA, "handbook.json"));
  const precepts = json(path.join(DATA, "precepts.json")).topics;
  const cases = json(path.join(DATA, "cases.json"));
  const partSlug = (p) => `${String(p.n).padStart(2, "0")}-${slug(p.title)}`;
  const partUrl = (p) => `/law/${partSlug(p)}`;
  const sectionById = {}; const partOfSection = new Map();
  for (const p of handbook.parts) for (const s of p.sections) { sectionById[s.id] = s; partOfSection.set(s.id, p); }
  const sectionUrl = (s) => `/law/${partSlug(partOfSection.get(s.id))}/${s.id.toLowerCase()}`;
  const lawUrl = (id) => { const [sid, n] = id.split("."); const s = sectionById[sid.toUpperCase()]; return s ? `${sectionUrl(s)}${n ? "#" + sid.toUpperCase() + "." + n : ""}` : null; };
  const preceptUrl = (t) => `/precepts/${t.slug}`;
  const preceptBySlug = Object.fromEntries(precepts.map((t) => [t.slug, t]));
  function findPrecept(name) {
    const k = slug(name);
    return preceptBySlug[k] ?? precepts.find((t) => t.slug.startsWith(k)) ?? precepts.find((t) => t.slug.includes(k)) ?? precepts.find((t) => t.title.toLowerCase() === name.toLowerCase()) ?? null;
  }
  const ERAS = cases.eras;
  const eraSlug = (e) => `${String(ERAS.indexOf(e) + 1).padStart(2, "0")}-${slug(e)}`;
  const caseUrl = (c) => `/cases/${eraSlug(c.era)}/${c.slug}`;
  const isBlessing = (c) => c.kind === "blessing";

  /* ---------------- notes ---------------- */
  const notes = [];
  const STUDY_DOCS = path.join(DOCS, "study");
  if (fs.existsSync(STUDY_DOCS)) for (const d of fs.readdirSync(STUDY_DOCS, { withFileTypes: true }).filter((x) => x.isDirectory())) {
    const book = bookBySlug[d.name]; if (!book) continue;
    for (const f of fs.readdirSync(path.join(STUDY_DOCS, d.name)).filter((f) => f.endsWith(".md") && f !== "index.md")) {
      const m = /^(\d+)(?:-(\d+))?$/.exec(f.replace(/\.md$/, "")); if (!m) continue;
      const [meta, body] = parseFrontmatter(read(path.join(STUDY_DOCS, d.name, f)));
      const a = +m[1], b = +(m[2] ?? m[1]);
      notes.push({ kind: "study", slug: `${a}${b > a ? "-" + b : ""}`, file: `docs/study/${d.name}/${f}`,
        url: meta.slug || `/study/${d.name}/${a}${b > a ? "-" + b : ""}`,
        title: meta.title || `${book} ${a}`, book, chapters: [a, b],
        range: meta.sidebar_label || `${book} ${a}${b > a ? "-" + b : ""}`, body,
        added: meta.added ? String(meta.added).replace(/^"|"$/g, "") : null });
    }
  }
  const readFeed = (dir, kind, prefix) => {
    if (!fs.existsSync(dir)) return;
    for (const y of fs.readdirSync(dir, { withFileTypes: true }).filter((x) => x.isDirectory()))
      for (const f of fs.readdirSync(path.join(dir, y.name)).filter((f) => f.endsWith(".md"))) {
        const [meta, body] = parseFrontmatter(read(path.join(dir, y.name, f)));
        if (!meta.slug) continue;
        const tags = tagList(meta.tags);
        notes.push({ kind, slug: String(meta.slug).split("/").pop(), file: path.relative(ROOT, path.join(dir, y.name, f)),
          url: `${prefix}${meta.slug}`, title: meta.title || f, date: meta.date || "",
          dateEstimated: /\(date estimated\)/.test(body), series: tags[0] ?? "", topics: tags.slice(1),
          teacher: meta.teacher || "", description: meta.description || "", year: y.name, body,
          videoId: /data-video-id="([\w-]{11})"/.exec(body)?.[1] ?? null });
      }
  };
  readFeed(BLOG, "class", "/classes/");
  readFeed(CAPTAINS, "captains", "/captains/");
  const ENC_DOCS = path.join(DOCS, "encyclopedia");
  if (fs.existsSync(ENC_DOCS)) for (const f of fs.readdirSync(ENC_DOCS).filter((f) => f.endsWith(".md") && f !== "index.md")) {
    const [meta, body] = parseFrontmatter(read(path.join(ENC_DOCS, f)));
    const stem = f.replace(/\.md$/, "");
    notes.push({ kind: "encyclopedia", slug: stem, file: `docs/encyclopedia/${f}`, url: meta.slug || `/encyclopedia/${stem}`,
      title: meta.title || stem, summary: meta.description || "", body });
  }
  const noteByTitle = new Map(notes.map((n) => [n.title.toLowerCase(), n]));
  const studyFor = (book, ch) => notes.find((n) => n.kind === "study" && n.book === book && ch >= n.chapters[0] && ch <= n.chapters[1]) ?? null;
  const noteLabel = (n) => n.kind === "study" ? (n.title.startsWith(n.book) ? `${n.range} \u00b7 ${n.title.replace(/^[^:]+:\s*/, "")}` : `${n.range} \u00b7 ${n.title}`) : n.title;
  const noteSelf = (n) => ({ kind: n.kind === "encyclopedia" ? "encyclopedia" : "note", label: noteLabel(n), url: n.url });

  // A link into /bible/<book>/<chapter> is a citation; a label ending ":1-2" carries the verse
  // span; a bare number is the verse superscript inside a quotation and contributes no span.
  const BIBLE_LINK = /\[([^\]]*)\]\(\/bible\/([a-z0-9-]+)\/(\d+)(?:#v(\d+))?\)/g;
  function scanCitations(body, self) {
    body = body.replace(/^<span class="opens">[\s\S]*?<\/span>$/m, "");
    for (const [, label, bslug, ch, anchor] of body.matchAll(BIBLE_LINK)) {
      const book = bookBySlug[bslug]; if (!book || !bible[book]?.[ch]) continue;
      const text = label.trim();
      const lm = /:([\d,\-]+)$/.exec(text);
      const verses = lm ? lm[1] : /^\d+$/.test(text) ? "" : (anchor || "");
      cite({ book, chapter: +ch, verses }, self.kind, self.label, self.url);
    }
  }

  const sortDated = (list) => list.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title) || a.url.localeCompare(b.url));
  const studyBooks = [...new Set(notes.filter((n) => n.kind === "study").map((n) => n.book))].sort((a, b) => bookNum[a] - bookNum[b]);
  const studyNotes = studyBooks.flatMap((b) => notes.filter((x) => x.kind === "study" && x.book === b).sort((x, y) => x.chapters[0] - y.chapters[0]));
  const classNotes = sortDated(notes.filter((n) => n.kind === "class"));
  const captainNotes = sortDated(notes.filter((n) => n.kind === "captains"));
  const encNotes = notes.filter((n) => n.kind === "encyclopedia").sort((a, b) => a.title.localeCompare(b.title));

  // Citation order matters for nothing downstream except stable output, so it follows the
  // same order the site has always used: notes, cases, laws, precepts.
  for (const n of [...studyNotes, ...classNotes, ...captainNotes, ...encNotes]) scanCitations(n.body, noteSelf(n));
  for (const c of cases.cases) for (const r of c.refs) cite(r, "case", c.name, caseUrl(c));
  for (const p of handbook.parts) for (const s of p.sections) for (const e of s.entries) {
    const id = `${s.id}.${e.n}`;
    for (const r of e.refs ?? []) cite(r, "law", `${id} ${e.text}`, `${sectionUrl(s)}#${id}`);
  }
  const sortedPrecepts = [...precepts].sort((a, b) => a.title.localeCompare(b.title));
  for (const t of sortedPrecepts) for (const r of t.refs) cite(r, "precept", t.title, preceptUrl(t));

  const lexicon = fs.existsSync(path.join(DATA, "lexicon.tsv"))
    ? read(path.join(DATA, "lexicon.tsv")).split("\n").slice(1).filter(Boolean).map((l) => { const [topic, , terms] = l.split("\t"); return { topic, terms: (terms || "").split(";").map((t) => t.trim().toLowerCase()).filter(Boolean) }; })
    : [];
  const topics = fs.existsSync(path.join(DATA, "topics.tsv"))
    ? read(path.join(DATA, "topics.tsv")).split("\n").slice(1).filter(Boolean).map((l) => { const [slug, label] = l.split("\t"); return { slug, label }; })
    : [];

  return {
    ROOT, DATA,
    bibleIndex, BOOKS, CHAPTERS, bible, bookSlug, bookBySlug, bookNum, testament, abbr, chapterUrl, bookUrl, verseText, refLabel, resolveChapter,
    handbook, sectionById, partSlug, partUrl, sectionUrl, lawUrl,
    precepts, sortedPrecepts, preceptUrl, findPrecept,
    cases, ERAS, eraSlug, caseUrl, isBlessing,
    notes, studyNotes, classNotes, captainNotes, encNotes, studyBooks, noteByTitle, studyFor, noteLabel,
    cited, uniqueCitations, lexicon, topics,
  };
}
