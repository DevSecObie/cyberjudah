// Build the derived pages of the site from the committed notes and data.
//
//   node scripts/generate.mjs        (npm run sync, and part of npm run build)
//
// Source, committed and hand-edited:
//   docs/study/<book>/<range>.md, docs/encyclopedia/<slug>.md, blog/**   the notes
//   data/bible/*.json                                                   the KJV text
//   data/handbook.json, data/precepts.json, data/cases.json             the reference works
//   data/lexicon.tsv                                                    topic terms
//
// Generated, gitignored, rebuilt on every build:
//   docs/{bible,law,precepts,cases,concordance}/**   pages derived from data
//   docs/study/**/index.md, docs/encyclopedia/index.md, _category_.json  listings
//   static/api/**/*.json      the same library as data, addressable
//   static/search/*.json      indexes for the search and browse pages
//
// The notes are read here, never written: what they contribute is the citation graph that
// puts a "cited by" block on each chapter page, plus the listings and the search text.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const DOCS = path.join(ROOT, "docs");
const API = path.join(ROOT, "static", "api");
const SEARCH = path.join(ROOT, "static", "search");
const BLOG = path.join(ROOT, "blog");
const CAPTAINS = path.join(ROOT, "captains");

const read =(p) => fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "");
const json = (p) => JSON.parse(read(p));
const write = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
const writeJson = (p, o) => write(p, JSON.stringify(o));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const yamlStr = (s) => JSON.stringify(String(s));
const fm = (o) => "---\n" + Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${typeof v === "string" ? yamlStr(v) : JSON.stringify(v)}`).join("\n") + "\n---\n\n";
const esc = (s) => s.replace(/</g, "&lt;");
// raw <a href> inside HTML blocks bypasses Docusaurus link processing, so they need the baseUrl by hand
const BASE = (/baseUrl:\s*"([^"]+)"/.exec(read(path.join(ROOT, "docusaurus.config.ts")))?.[1] ?? "/").replace(/\/$/, "");
const href = (u) => BASE + u;   // verse text is plain; keep the odd '<' from breaking CommonMark html

// Clear only what this script produces. docs/study/<book>/<range>.md, docs/encyclopedia/<slug>.md
// and everything under blog/ are committed source: wiping docs/ wholesale, as this used to,
// would delete the notes themselves. The listing pages inside those two folders ARE generated,
// so they are removed by name and rewritten below.
for (const d of [API, SEARCH, path.join(DOCS, "bible"), path.join(DOCS, "law"), path.join(DOCS, "precepts"), path.join(DOCS, "cases"), path.join(DOCS, "concordance")])
  fs.rmSync(d, { recursive: true, force: true });
for (const p of [path.join(DOCS, "study", "index.md"), path.join(DOCS, "study", "_category_.json"),
                 path.join(DOCS, "encyclopedia", "index.md"), path.join(DOCS, "encyclopedia", "_category_.json"),
                 ...(fs.existsSync(path.join(DOCS, "study"))
                     ? fs.readdirSync(path.join(DOCS, "study"), { withFileTypes: true }).filter((d) => d.isDirectory())
                         .flatMap((d) => [path.join(DOCS, "study", d.name, "index.md"), path.join(DOCS, "study", d.name, "_category_.json")])
                     : [])])
  fs.rmSync(p, { force: true });

/* ---------------- scripture ---------------- */
const bibleIndex = json(path.join(DATA, "bible", "index.json"));
const BOOKS = bibleIndex.map((e) => e.book);
const CANON = BOOKS.slice(0, 66), APOC = BOOKS.slice(66);
const bookSlug = Object.fromEntries(bibleIndex.map((e) => [e.book, e.slug]));
const bookNum = Object.fromEntries(BOOKS.map((b, i) => [b, i + 1]));
const testament = (b) => (APOC.includes(b) ? "Apocrypha" : CANON.indexOf(b) < 39 ? "Old Testament" : "New Testament");
const bible = {};
for (const e of bibleIndex) bible[e.book] = json(path.join(DATA, "bible", e.slug + ".json")).chapters;
const CHAPTERS = Object.fromEntries(bibleIndex.map((e) => [e.book, e.chapters]));
const ABBR = { Genesis: "Gen", Exodus: "Exod", Leviticus: "Lev", Numbers: "Num", Deuteronomy: "Deut", Joshua: "Josh", Judges: "Judg", "1 Samuel": "1 Sam", "2 Samuel": "2 Sam", "1 Kings": "1 Kgs", "2 Kings": "2 Kgs", "1 Chronicles": "1 Chr", "2 Chronicles": "2 Chr", Nehemiah: "Neh", Psalms: "Ps", Proverbs: "Prov", Ecclesiastes: "Eccl", "Song of Solomon": "Song", Isaiah: "Isa", Jeremiah: "Jer", Lamentations: "Lam", Ezekiel: "Ezek", Daniel: "Dan", Hosea: "Hos", Obadiah: "Obad", Micah: "Mic", Nahum: "Nah", Habakkuk: "Hab", Zephaniah: "Zeph", Haggai: "Hag", Zechariah: "Zech", Malachi: "Mal", Matthew: "Matt", Romans: "Rom", "1 Corinthians": "1 Cor", "2 Corinthians": "2 Cor", Galatians: "Gal", Ephesians: "Eph", Philippians: "Phil", Colossians: "Col", "1 Thessalonians": "1 Thess", "2 Thessalonians": "2 Thess", "1 Timothy": "1 Tim", "2 Timothy": "2 Tim", Philemon: "Phlm", Hebrews: "Heb", "1 Peter": "1 Pet", "2 Peter": "2 Pet", Revelation: "Rev", "Wisdom of Solomon": "Wis", Sirach: "Sir", "1 Maccabees": "1 Macc", "2 Maccabees": "2 Macc", "Esther (Greek)": "Esth (Gk)", "Song of the Three Children": "Song Thr", "Bel and the Dragon": "Bel", "Prayer of Manasseh": "Pr Man", "Epistle of Jeremiah": "Ep Jer" };
const abbr = (b) => ABBR[b] ?? b;
// vault book names -> project names
const VAULT_NAMES = { Ecclesiasticus: "Sirach", "Additions to Esther": "Esther (Greek)", "Prayer of Manasses": "Prayer of Manasseh", "Prayer of Azariah": "Song of the Three Children" };
const bookByLower = new Map(BOOKS.map((b) => [b.toLowerCase(), b]));
function resolveBook(name) {
  const n = name.trim();
  if (VAULT_NAMES[n]) return VAULT_NAMES[n];
  return bookByLower.get(n.toLowerCase()) ?? null;
}
// Greek Esther exists only as the Additions (chapters 10-16). A reference to 1-9 in
// that book means canonical Esther, so resolve it there instead of emitting a dead link.
const resolveChapter = (book, ch) => (bible[book] && bible[book][String(ch)]) ? book : (/^(.+) \(Greek\)$/.exec(book)?.[1] ?? book);
const chapterUrl = (book, ch, v) => { const b = resolveChapter(book, ch); return `/bible/${bookSlug[b]}/${ch}${v ? "#v" + v : ""}`; };
const bookUrl = (book) => `/bible/${bookSlug[book]}`;
const verseText = (book, ch, v) => bible[book]?.[String(ch)]?.[v - 1] ?? null;
const refLabel = (r) => `${r.book} ${r.chapter}${r.verses ? ":" + r.verses : ""}`;
const refLink = (r, short = false) => `[${short ? abbr(r.book) + " " + r.chapter + (r.verses ? ":" + r.verses : "") : refLabel(r)}](${chapterUrl(r.book, r.chapter, firstVerse(r.verses))})`;
function firstVerse(spec) { const m = /^(\d+)/.exec(spec || ""); return m ? +m[1] : undefined; }
function versesOf(spec) {
  const out = [];
  for (const part of (spec || "").split(",").filter(Boolean)) {
    const [a, b] = part.split("-").map((x) => parseInt(x, 10));
    if (isNaN(a)) continue;
    for (let v = a; v <= (isNaN(b) ? a : b); v++) out.push(v);
  }
  return out;
}
/** A verse range as a blockquote of numbered verses, from our own text. */
function quoteRef(r, cap = 12) {
  const vs = r.verses ? versesOf(r.verses) : Array.from({ length: (bible[r.book]?.[String(r.chapter)] ?? []).length }, (_, i) => i + 1);
  const lines = [];
  for (const v of vs.slice(0, cap)) { const t = verseText(r.book, r.chapter, v); if (t) lines.push(`> <sup>[${v}](${chapterUrl(r.book, r.chapter, v)})</sup> ${esc(t)}`); }
  if (vs.length > cap) lines.push(`> [… ${vs.length - cap} more verses](${chapterUrl(r.book, r.chapter, vs[cap])})`);
  return lines.join("\n>\n");
}
/** A citation with the text folded under it. */
const detailsRef = (r) => `<details><summary>${refLabel(r)}</summary>\n\n${quoteRef(r)}\n\n</details>`;

/* ---------------- who cites what ---------------- */
const cited = new Map(); // "Book|ch" -> [{kind, label, url, verses}]
const cite = (r, kind, label, url) => { const k = `${r.book}|${r.chapter}`; if (!cited.has(k)) cited.set(k, []); cited.get(k).push({ kind, label, url, verses: r.verses || "" }); };
function citedBlock(book, ch, heading = "## Cited by") {
  const rows = cited.get(`${book}|${ch}`); if (!rows) return "";
  const groups = [["note", "Study notes and classes"], ["encyclopedia", "Encyclopedia"], ["case", "Cases"], ["precept", "Precepts"], ["law", "Laws"]];
  const out = [heading, ""];
  for (const [kind, label] of groups) {
    const merged = new Map();
    for (const r of rows.filter((x) => x.kind === kind)) { const m = merged.get(r.url) ?? { ...r, vs: [] }; if (r.verses && !m.vs.includes(r.verses)) m.vs.push(r.verses); merged.set(r.url, m); }
    if (!merged.size) continue;
    out.push(`**${label}**`, "");
    for (const m of merged.values()) out.push(`- [${m.label}](${m.url})${m.vs.length ? ` (v. ${m.vs.join(", ")})` : ""}`);
    out.push("");
  }
  return out.join("\n");
}

/* ---------------- the law ---------------- */
const handbook = json(path.join(DATA, "handbook.json"));
const precepts = json(path.join(DATA, "precepts.json")).topics;
const cases = json(path.join(DATA, "cases.json"));
const partSlug = (p) => `${String(p.n).padStart(2, "0")}-${slug(p.title)}`;
const partUrl = (p) => `/law/${partSlug(p)}`;
const sectionUrl = (s) => `/law/${partSlug(partOf(s))}/${s.id.toLowerCase()}`;
const lawUrl = (id) => { const [sid, n] = id.split("."); const s = sectionById[sid.toUpperCase()]; return s ? `${sectionUrl(s)}${n ? "#" + sid.toUpperCase() + "." + n : ""}` : null; };
const sectionById = {}; const partOfSection = new Map();
for (const p of handbook.parts) for (const s of p.sections) { sectionById[s.id] = s; partOfSection.set(s.id, p); }
const partOf = (s) => partOfSection.get(s.id);
const precept = Object.fromEntries(precepts.map((t) => [t.slug, t]));
const preceptUrl = (t) => `/precepts/${t.slug}`;
function findPrecept(name) {
  const k = slug(name);
  return precept[k] ?? precepts.find((t) => t.slug.startsWith(k)) ?? precepts.find((t) => t.slug.includes(k)) ?? precepts.find((t) => t.title.toLowerCase() === name.toLowerCase()) ?? null;
}
const ERAS = cases.eras;
const eraSlug = (e) => `${String(ERAS.indexOf(e) + 1).padStart(2, "0")}-${slug(e)}`;
const caseUrl = (c) => `/cases/${eraSlug(c.era)}/${c.slug}`;
const VERDICT_CLASS = { death: "danger", plague: "danger", exile: "warning", captivity: "warning", curse: "warning", restitution: "info", spared: "success", reprieve: "success", temporal: "secondary", unrecorded: "secondary" };
const badge = (v) => `<span class="badge badge--${VERDICT_CLASS[v] ?? "secondary"} verdict">${VERDICT[v] ?? v}</span>`;
const VERDICT = { death: "Put to death", plague: "Plague", exile: "Exile", captivity: "Captivity", curse: "Cursed", restitution: "Restitution", spared: "Spared", reprieve: "Reprieve", temporal: "Temporal judgment", unrecorded: "Sentence not recorded" };

/* ---------------- notes: the committed source under docs/ and blog/ ---------------- */
// Study notes, class notes and encyclopedia entries are hand-written Docusaurus markdown
// and are the source of record for this site. This step reads them for their citations,
// their listings and the search index. It never writes them back: only the derived pages
// (scripture, law, precepts, cases, indexes, API, search) are generated.
function parseFrontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) return [{}, text];
  const o = {};
  for (const line of m[1].split("\n")) { const i = line.indexOf(":"); if (i > 0) o[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, ""); }
  return [o, text.slice(m[0].length)];
}
const notes = []; // {kind, slug, title, url, book, chapters, range, date, series, body, sidebarPos}
const bookBySlug = Object.fromEntries(Object.entries(bookSlug).map(([b, s]) => [s, b]));

const STUDY_DOCS = path.join(DOCS, "study");
if (fs.existsSync(STUDY_DOCS)) for (const d of fs.readdirSync(STUDY_DOCS, { withFileTypes: true }).filter((x) => x.isDirectory())) {
  const book = bookBySlug[d.name]; if (!book) continue;
  for (const f of fs.readdirSync(path.join(STUDY_DOCS, d.name)).filter((f) => f.endsWith(".md") && f !== "index.md")) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(f.replace(/\.md$/, "")); if (!m) continue;
    const [meta, body] = parseFrontmatter(read(path.join(STUDY_DOCS, d.name, f)));
    const a = +m[1], b = +(m[2] ?? m[1]);
    notes.push({ kind: "study", slug: `${a}${b > a ? "-" + b : ""}`,
      url: meta.slug || `/study/${d.name}/${a}${b > a ? "-" + b : ""}`,
      title: meta.title || `${book} ${a}`, book, chapters: [a, b],
      range: meta.sidebar_label || `${book} ${a}${b > a ? "-" + b : ""}`, body, sidebarPos: a });
  }
}
if (fs.existsSync(BLOG)) for (const y of fs.readdirSync(BLOG, { withFileTypes: true }).filter((x) => x.isDirectory()))
  for (const f of fs.readdirSync(path.join(BLOG, y.name)).filter((f) => f.endsWith(".md"))) {
    const [meta, body] = parseFrontmatter(read(path.join(BLOG, y.name, f)));
    if (!meta.slug) continue;
    notes.push({ kind: "class", slug: String(meta.slug).split("/").pop(), url: `/classes/${meta.slug}`,
      title: meta.title || f, date: meta.date || "",
      dateEstimated: /\(date estimated\)/.test(body),
      series: String(meta.tags || "").replace(/^\[|\]$/g, "").replace(/"/g, "").trim(),
      year: y.name, body, sidebarPos: 0 });
  }
// 15 Minutes w/ The Captains lives in its own blog instance so it keeps its own feed and
// browse page: the episodes are short weekday teachings, not Sabbath classes, and mixing
// the two into one reverse-chronological feed buries the classes.
if (fs.existsSync(CAPTAINS)) for (const y of fs.readdirSync(CAPTAINS, { withFileTypes: true }).filter((x) => x.isDirectory()))
  for (const f of fs.readdirSync(path.join(CAPTAINS, y.name)).filter((f) => f.endsWith(".md"))) {
    const [meta, body] = parseFrontmatter(read(path.join(CAPTAINS, y.name, f)));
    if (!meta.slug) continue;
    notes.push({ kind: "captains", slug: String(meta.slug).split("/").pop(), url: `/captains/${meta.slug}`,
      title: meta.title || f, date: meta.date || "",
      dateEstimated: /\(date estimated\)/.test(body),
      series: String(meta.tags || "").replace(/^\[|\]$/g, "").replace(/"/g, "").trim(),
      year: y.name, body, sidebarPos: 0 });
  }
const ENC_DOCS = path.join(DOCS, "encyclopedia");
if (fs.existsSync(ENC_DOCS)) for (const f of fs.readdirSync(ENC_DOCS).filter((f) => f.endsWith(".md") && f !== "index.md")) {
  const [meta, body] = parseFrontmatter(read(path.join(ENC_DOCS, f)));
  const stem = f.replace(/\.md$/, "");
  notes.push({ kind: "encyclopedia", slug: stem, url: meta.slug || `/encyclopedia/${stem}`,
    title: meta.title || stem, summary: meta.description || "", body, sidebarPos: 0 });
}
const noteByTitle = new Map(notes.map((n) => [n.title.toLowerCase(), n]));
const studyFor = (book, ch) => notes.find((n) => n.kind === "study" && n.book === book && ch >= n.chapters[0] && ch <= n.chapters[1]) ?? null;

/** Record the scripture a note cites. The notes are already CommonMark, so this only reads.
 *  A link into /bible/<book>/<chapter> is a citation; a label ending ":1-2" or ":5" carries
 *  the verse span, and a bare label (the verse-number superscript inside a quotation, or a
 *  plain chapter reference) carries none. That split is deliberate: it is what stops a
 *  quoted chapter from listing every one of its own verses back at itself. */
const BIBLE_LINK = /\[([^\]]*)\]\(\/bible\/([a-z0-9-]+)\/(\d+)(?:#v(\d+))?\)/g;
function scanCitations(body, self) {
  if (!self) return;
  for (const [, label, bslug, ch, anchor] of body.matchAll(BIBLE_LINK)) {
    const book = bookBySlug[bslug]; if (!book || !bible[book]?.[ch]) continue;
    const text = label.trim();
    const lm = /:([\d,\-]+)$/.exec(text);
    // "Genesis 1:1-2" gives its own span. A bare number is the verse superscript inside a
    // quotation and contributes nothing, which is what stops a quoted chapter from listing
    // all of its own verses. Anything else ("Obadiah 1:1-4, 7", whose span the pattern above
    // will not take) falls back to the verse the link actually points at.
    const verses = lm ? lm[1] : /^\d+$/.test(text) ? "" : (anchor || "");
    cite({ book, chapter: +ch, verses }, self.kind, self.label, self.url);
  }
}

/* ---------------- notes: collect citations, write only the listings ---------------- */
// The note pages themselves are committed source and are left alone. What is generated here
// is the material derived from them: the citation graph the chapter pages read, and the
// index pages and sidebar categories that list what exists.
const noteLabel = (n) => n.kind === "study" ? (n.title.startsWith(n.book) ? `${n.range} \u00b7 ${n.title.replace(/^[^:]+:\s*/, "")}` : `${n.range} \u00b7 ${n.title}`) : n.title;
const noteSelf = (n) => ({ kind: n.kind === "encyclopedia" ? "encyclopedia" : "note", label: noteLabel(n), url: n.url });

write(path.join(DOCS, "study", "_category_.json"), JSON.stringify({ label: "4 Chapters a Day", position: 2, link: { type: "doc", id: "study/index" } }));
const studyBooks = [...new Set(notes.filter((n) => n.kind === "study").map((n) => n.book))].sort((a, b) => bookNum[a] - bookNum[b]);
write(path.join(DOCS, "study", "index.md"), fm({ title: "4 Chapters a Day", slug: "/study", sidebar_position: 0, pagination_next: null, pagination_prev: null }) +
  studyBooks.map((b) => `## [${b}](/study/${bookSlug[b]})\n\n` + notes.filter((n) => n.kind === "study" && n.book === b).sort((x, y) => x.chapters[0] - y.chapters[0]).map((n) => `- [${n.range}](${n.url}): ${n.title}`).join("\n")).join("\n\n") + "\n");
for (const b of studyBooks) {
  const dir = path.join(DOCS, "study", bookSlug[b]);
  write(path.join(dir, "_category_.json"), JSON.stringify({ label: b, position: bookNum[b], link: { type: "doc", id: `study/${bookSlug[b]}/index` } }));
  const list = notes.filter((n) => n.kind === "study" && n.book === b).sort((x, y) => x.chapters[0] - y.chapters[0]);
  write(path.join(dir, "index.md"), fm({ title: `${b}: 4 Chapters a Day`, slug: `/study/${bookSlug[b]}`, sidebar_position: 0, sidebar_label: `${b}: all sessions` }) + `Read the scripture itself: [${b}](${bookUrl(b)})\n\n` + list.map((n) => `- [${n.range}](${n.url}): ${n.title}`).join("\n") + "\n");
}
// Class notes are dated entries, so they live in blog/ and the blog plugin gives them
// reverse-chronological order, an RSS/Atom feed and an archive for free.
// Two parts of one class share a date and a title, so the url is the final tiebreak:
// without it the order depends on the order the filesystem hands the files over.
const classNotes = notes.filter((n) => n.kind === "class").sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title) || a.url.localeCompare(b.url));
const years = [...new Set(classNotes.map((n) => n.year))].sort().reverse();
const captainNotes = notes.filter((n) => n.kind === "captains").sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title) || a.url.localeCompare(b.url));
write(path.join(DOCS, "encyclopedia", "_category_.json"), JSON.stringify({ label: "Encyclopedia", position: 4, link: { type: "doc", id: "encyclopedia/index" } }));
const enc = notes.filter((n) => n.kind === "encyclopedia").sort((a, b) => a.title.localeCompare(b.title));
write(path.join(DOCS, "encyclopedia", "index.md"), fm({ title: "Encyclopedia", slug: "/encyclopedia", sidebar_position: 0, pagination_next: null, pagination_prev: null }) + enc.map((n) => `- [${n.title}](${n.url}): ${n.summary}`).join("\n") + "\n");

for (const n of [...studyBooks.flatMap((b) => notes.filter((x) => x.kind === "study" && x.book === b).sort((x, y) => x.chapters[0] - y.chapters[0])), ...classNotes, ...captainNotes, ...enc])
  scanCitations(n.body, noteSelf(n));

/* ---------------- write: cases ---------------- */
write(path.join(DOCS, "cases", "_category_.json"), JSON.stringify({ label: "Case Studies", position: 7, link: { type: "doc", id: "cases/index" } }));
write(path.join(DOCS, "cases", "index.md"), fm({ title: "Case Studies", slug: "/cases", sidebar_position: 0, pagination_next: null, pagination_prev: null }) +
  `<p class="legend">${Object.keys(VERDICT).map(badge).join(" ")}</p>\n\n` +
  ERAS.map((e) => { const list = cases.cases.filter((c) => c.era === e); return list.length ? `## ${e}\n\n` + list.map((c) => `- [${c.name}](${caseUrl(c)}) ${badge(c.verdict)}<br/><span class="charge">${c.charge}</span>`).join("\n") : ""; }).filter(Boolean).join("\n\n") + "\n");
const lexicon = fs.existsSync(path.join(DATA, "lexicon.tsv")) ? read(path.join(DATA, "lexicon.tsv")).split("\n").slice(1).filter(Boolean).map((l) => { const [topic, , terms] = l.split("\t"); return { topic, terms: (terms || "").split(";").map((t) => t.trim().toLowerCase()).filter(Boolean) }; }) : [];
for (const e of ERAS) {
  const list = cases.cases.filter((c) => c.era === e); if (!list.length) continue;
  write(path.join(DOCS, "cases", eraSlug(e), "_category_.json"), JSON.stringify({ label: e, position: ERAS.indexOf(e) + 1, collapsed: true }));
  list.forEach((c, i) => {
    for (const r of c.refs) cite(r, "case", c.name, caseUrl(c));
    const hay = `${c.charge} ${c.summary} ${c.themes.join(" ")} ${c.topics.join(" ")}`.toLowerCase();
    const see = lexicon.filter((l) => l.terms.some((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(hay))).map((l) => noteByTitle.get(l.topic.toLowerCase())).filter(Boolean);
    const taught = [...new Set(c.refs.map((r) => studyFor(r.book, r.chapter)).filter(Boolean))];
    const related = cases.cases.filter((o) => o !== c && o.themes.some((t) => c.themes.includes(t))).slice(0, 6);
    const body = [
      `<p class="casehead">${badge(c.verdict)} <span class="charge">${c.charge}</span><br/><span class="era">${c.era}</span></p>`, "",
      c.summary, "", "## The offense", "", c.offense, "", "## The judgment", "", c.judgment, "",
      "## Scripture", "", ...c.refs.map((r) => `**${refLink(r)}**${studyFor(r.book, r.chapter) ? ` · taught in [${studyFor(r.book, r.chapter).range}](${studyFor(r.book, r.chapter).url})` : ""}\n\n${quoteRef(r)}\n`),
      "## Laws broken", "", ...c.laws.map((l) => { const [sid, n] = l.split("."); const s = sectionById[sid]; if (!s) return `- ${l}`; const en = n ? s.entries[+n - 1] : null; return `- [${l}](${lawUrl(l)})${en ? " " + en.text : " " + s.title + " (section)"}`; }), "",
      "## Precepts", "", ...c.topics.map((t) => { const p = findPrecept(t); return p ? `- [${p.title}](${preceptUrl(p)})` : `- ${t}`; }), "",
      ...(related.length ? ["## Related cases", "", ...related.map((o) => `- [${o.name}](${caseUrl(o)}): ${o.charge}`), ""] : []),
      ...(taught.length ? ["## Taught in", "", ...taught.map((n) => `- [${noteLabel(n)}](${n.url})`), ""] : []),
      ...(see.length ? ["## See also", "", ...see.map((n) => `- [${n.title}](${n.url}) (Encyclopedia)`), ""] : []),
    ].join("\n");
    write(path.join(DOCS, "cases", eraSlug(e), `${c.slug}.md`), fm({ title: c.name, slug: caseUrl(c), sidebar_position: i + 1, description: c.charge, tags: [`verdict:${c.verdict}`, ...c.themes] }) + body);
    writeJson(path.join(API, "cases", `${c.slug}.json`), c);
  });
}
writeJson(path.join(API, "cases", "index.json"), { eras: ERAS, verdicts: cases.verdicts, cases: cases.cases.map((c) => ({ slug: c.slug, name: c.name, era: c.era, charge: c.charge, verdict: c.verdict, url: caseUrl(c) })) });

/* ---------------- write: law ---------------- */
write(path.join(DOCS, "law", "_category_.json"), JSON.stringify({ label: "The Law", position: 5, link: { type: "doc", id: "law/index" } }));
write(path.join(DOCS, "law", "index.md"), fm({ title: "A Handbook of Bible Law", slug: "/law", sidebar_position: 0, pagination_next: null, pagination_prev: null }) +
  handbook.parts.map((p) => `## [Part ${p.n}: ${p.title}](${partUrl(p)})\n\n` + p.sections.map((s) => `- [${s.id}](${sectionUrl(s)}) ${s.title} (${s.entries.length})`).join("\n")).join("\n\n") + "\n");
for (const p of handbook.parts) {
  const dir = path.join(DOCS, "law", partSlug(p));
  write(path.join(dir, "_category_.json"), JSON.stringify({ label: `${p.n}. ${p.title}`, position: p.n, link: { type: "doc", id: `law/${partSlug(p)}/index` }, collapsed: true }));
  write(path.join(dir, "index.md"), fm({ title: `Part ${p.n}: ${p.title}`, slug: partUrl(p), sidebar_position: 0, sidebar_label: `Part ${p.n}: all sections` }) + p.sections.map((s) => `- [${s.id}](${sectionUrl(s)}) ${s.title} (${s.entries.length} laws)`).join("\n") + "\n");
  p.sections.forEach((s, i) => {
    const body = [];
    if (s.seeAlso?.length) body.push("See also: " + s.seeAlso.map((x) => (sectionById[x] ? `[${x} ${sectionById[x].title}](${sectionUrl(sectionById[x])})` : x)).join(", "), "");
    for (const e of s.entries) {
      const id = `${s.id}.${e.n}`;
      body.push(`<div class="law">`, "", `### ${id} {#${id}}`, "", e.text, "");
      if (e.refs?.length) { body.push(`<p class="cites">` + e.refs.map((r) => `<a href="${href(chapterUrl(r.book, r.chapter, firstVerse(r.verses)))}">${abbr(r.book)} ${r.chapter}${r.verses ? ":" + r.verses : ""}</a>`).join(" · ") + `</p>`, "", ...e.refs.map(detailsRef), ""); for (const r of e.refs) cite(r, "law", `${id} ${e.text.slice(0, 90)}`, `${sectionUrl(s)}#${id}`); }
      body.push(`</div>`, "");
    }
    write(path.join(dir, `${s.id.toLowerCase()}.md`), fm({ title: `${s.id} ${s.title}`, slug: sectionUrl(s), sidebar_label: `${s.id} ${s.title}`, sidebar_position: i + 1, description: `Part ${p.n}: ${p.title}` }) + body.join("\n"));
    writeJson(path.join(API, "laws", `${s.id}.json`), { id: s.id, title: s.title, part: { n: p.n, title: p.title }, url: sectionUrl(s), entries: s.entries.map((e) => ({ id: `${s.id}.${e.n}`, text: e.text, refs: e.refs, citation: e.citation })) });
  });
}
writeJson(path.join(API, "laws", "index.json"), handbook.parts.map((p) => ({ n: p.n, title: p.title, url: partUrl(p), sections: p.sections.map((s) => ({ id: s.id, title: s.title, laws: s.entries.length, url: sectionUrl(s) })) })));

/* ---------------- write: precepts ---------------- */
write(path.join(DOCS, "precepts", "_category_.json"), JSON.stringify({ label: "Precepts", position: 6, link: { type: "doc", id: "precepts/index" }, collapsed: true }));
const sortedPrecepts = [...precepts].sort((a, b) => a.title.localeCompare(b.title));
let letter = ""; const pi = [];
for (const t of sortedPrecepts) { const L = t.title[0].toUpperCase(); if (L !== letter) { pi.push(`\n## ${L}\n`); letter = L; } pi.push(`- [${t.title}](${preceptUrl(t)}) (${t.refs.length})`); }
write(path.join(DOCS, "precepts", "index.md"), fm({ title: "Precept Index", slug: "/precepts", sidebar_position: 0, pagination_next: null, pagination_prev: null }) + pi.join("\n") + "\n");
sortedPrecepts.forEach((t, i) => {
  for (const r of t.refs) cite(r, "precept", t.title, preceptUrl(t));
  const body = t.refs.map((r) => `**${refLink(r)}**${r.key ? ' <span class="badge badge--primary">key</span>' : ""}${studyFor(r.book, r.chapter) ? ` · taught in [${studyFor(r.book, r.chapter).range}](${studyFor(r.book, r.chapter).url})` : ""}\n\n${quoteRef(r, 8)}\n`).join("\n");
  write(path.join(DOCS, "precepts", `${t.slug}.md`), fm({ title: t.title, slug: preceptUrl(t), sidebar_position: i + 1, description: `${t.refs.length} scripture references` }) + body);
  writeJson(path.join(API, "precepts", `${t.slug}.json`), { ...t, url: preceptUrl(t) });
});
writeJson(path.join(API, "precepts", "index.json"), sortedPrecepts.map((t) => ({ slug: t.slug, title: t.title, refs: t.refs.length, url: preceptUrl(t) })));

/* ---------------- write: bible (last: every citation is known now) ---------------- */
write(path.join(DOCS, "bible", "_category_.json"), JSON.stringify({ label: "Bible", position: 1, link: { type: "doc", id: "bible/index" } }));
write(path.join(DOCS, "bible", "index.md"), fm({ title: "The Holy Bible", slug: "/bible", sidebar_position: 0, pagination_next: null, pagination_prev: null, description: "King James Version with the Apocrypha" }) +
  ["Old Testament", "New Testament", "Apocrypha"].map((t) => `## ${t}\n\n` + BOOKS.filter((b) => testament(b) === t).map((b) => `- [${b}](${bookUrl(b)}) (${CHAPTERS[b]})`).join("\n")).join("\n\n") + "\n");
const notesByBook = {};
for (const b of BOOKS) {
  const dir = path.join(DOCS, "bible", bookSlug[b]);
  write(path.join(dir, "_category_.json"), JSON.stringify({ label: b, position: bookNum[b], link: { type: "doc", id: `bible/${bookSlug[b]}/index` }, collapsed: true }));
  const chs = Object.keys(bible[b]).map(Number).sort((x, y) => x - y);
  const study = notes.filter((n) => n.kind === "study" && n.book === b).sort((x, y) => x.chapters[0] - y.chapters[0]);
  write(path.join(dir, "index.md"), fm({ title: b, slug: bookUrl(b), sidebar_position: 0, sidebar_label: `${b}: chapters`, description: `${testament(b)} · ${CHAPTERS[b]} chapters` }) +
    chs.map((c) => `[${c}](${chapterUrl(b, c)})`).join(" · ") + "\n" + (study.length ? `\n## Study notes\n\n` + study.map((n) => `- [${n.range}](${n.url}): ${n.title}`).join("\n") + "\n" : "") + (cited.size ? `\n[Concordance for ${b}](/concordance/${bookSlug[b]})\n` : ""));
  for (const c of chs) {
    const verses = bible[b][String(c)] ?? [];
    const st = studyFor(b, c);
    const body = [];
    body.push(`<nav class="chapnav" aria-label="chapters">` + chs.map((x) => `<a href="${href(chapterUrl(b, x))}"${x === c ? ' class="on"' : ""}>${x}</a>`).join("") + `</nav>`, "");
    if (st) body.push(`<p class="taught">Taught in <a href="${href(st.url)}">${noteLabel(st)}</a></p>`, "");
    body.push(`<div class="scripture">`, "");
    for (let i = 0; i < verses.length; i++) if (verses[i]) body.push(`<p class="verse" id="v${i + 1}"><a class="vn" href="#v${i + 1}">${i + 1}</a>${esc(verses[i])}</p>`);
    body.push("", `</div>`, "");
    const cb = citedBlock(b, c);
    if (cb) body.push(`<div class="citedby">`, "", cb, "", `</div>`);
    write(path.join(dir, `${c}.md`), fm({ title: `${b} ${c}`, slug: chapterUrl(b, c), sidebar_label: String(c), sidebar_position: c, description: `${b} chapter ${c}, King James Version` }) + body.join("\n"));
    writeJson(path.join(API, "kjv", bookSlug[b], `${c}.json`), { book: b, chapter: c, translation: "KJV", url: chapterUrl(b, c), verses: verses.map((t, i) => ({ verse: i + 1, text: t })).filter((v) => v.text) });
    const cbj = cited.get(`${b}|${c}`);
    if (cbj) writeJson(path.join(API, "concordance", bookSlug[b], `${c}.json`), { book: b, chapter: c, cited_by: cbj });
  }
  writeJson(path.join(API, "kjv", bookSlug[b], "index.json"), { book: b, slug: bookSlug[b], testament: testament(b), chapters: CHAPTERS[b], verses: chs.reduce((a, c) => a + (bible[b][String(c)] ?? []).filter(Boolean).length, 0) });
}
writeJson(path.join(API, "kjv", "books.json"), bibleIndex.map((e) => ({
  ...e,
  testament: testament(e.book),
  url: bookUrl(e.book),
  chapterIds: Object.keys(bible[e.book]).map(Number).sort((a, b) => a - b),
})));

/* ---------------- write: concordance ---------------- */
write(path.join(DOCS, "concordance", "_category_.json"), JSON.stringify({ label: "Concordance", position: 8, link: { type: "doc", id: "concordance/index" }, collapsed: true }));
const citedBooks = BOOKS.filter((b) => [...cited.keys()].some((k) => k.startsWith(b + "|")));
write(path.join(DOCS, "concordance", "index.md"), fm({ title: "Concordance", slug: "/concordance", sidebar_position: 0, pagination_next: null, pagination_prev: null, description: "Every chapter that a law, precept, case, or note cites" }) +
  ["Old Testament", "New Testament", "Apocrypha"].map((t) => `## ${t}\n\n` + citedBooks.filter((b) => testament(b) === t).map((b) => { const n = [...cited.keys()].filter((k) => k.startsWith(b + "|")).length; return `- [${b}](/concordance/${bookSlug[b]}) (${n} chapters)`; }).join("\n")).join("\n\n") + "\n");
citedBooks.forEach((b, i) => {
  const chs = [...cited.keys()].filter((k) => k.startsWith(b + "|")).map((k) => +k.split("|")[1]).sort((x, y) => x - y);
  write(path.join(DOCS, "concordance", `${bookSlug[b]}.md`), fm({ title: `${b} concordance`, slug: `/concordance/${bookSlug[b]}`, sidebar_label: b, sidebar_position: i + 1 }) +
    `[Read ${b}](${bookUrl(b)})\n\n` + chs.map((c) => citedBlock(b, c, `## [${b} ${c}](${chapterUrl(b, c)})`)).join("\n"));
});

/* ---------------- API: notes; search indexes ---------------- */
const plain = (md) => md.replace(/%%[\s\S]*?%%/g, " ").replace(/!\[\[[^\]]*\]\]/g, " ").replace(/\[\[(?:[^\]|]+\|)?([^\]|]+)\]\]/g, "$1").replace(/<[^>]+>/g, " ").replace(/[#>*_`\[\]|]+/g, " ").replace(/\s+/g, " ").trim();
writeJson(path.join(API, "notes", "index.json"), notes.map((n) => ({ kind: n.kind, title: n.title, url: n.url, book: n.book, chapters: n.chapters, range: n.range, date: n.date, series: n.series, summary: n.summary })));
// Search records for the sharded Pagefind index (built by scripts/build-search-index.mjs).
// Written outside static/ on purpose: the flat notes+verses JSON reached 20 MB, and the old
// search page downloaded all of it into the browser on the first query. Only the sharded
// index under static/pagefind ships now.
const records = [];
for (const n of notes) records.push({ kind: n.kind, title: n.title, url: n.url, content: plain(n.body) });
// class browse index. Thumbnails are pulled to our own origin at build time: a
// cross-origin image is at the mercy of the viewer's blockers, data saver and
// network, which is why they were missing on some devices. mqdefault is a true
// 16:9 320x180 (hqdefault is 4:3 with letterbox bars) and about half the bytes.
// If a fetch fails the remote URL stays as the fallback, so this can only improve
// on the previous behaviour and can never fail the build.
// Both blog instances get the same treatment; only the route prefix, the thumbnail
// directory and the output file differ.
for (const feed of [{ list: classNotes, prefix: "/classes/", dir: "classes", out: "classes.json", label: "class" },
                    { list: captainNotes, prefix: "/captains/", dir: "captains", out: "captains.json", label: "captains" }]) {
  const weights = new Map();
  for (const [key, rows] of cited) {
    const book = key.split("|")[0];
    for (const r of rows) {
      if (!r.url.startsWith(feed.prefix)) continue;
      if (!weights.has(r.url)) weights.set(r.url, new Map());
      const w = weights.get(r.url); w.set(book, (w.get(book) ?? 0) + 1);
    }
  }

  const THUMBS = path.join(ROOT, "static", "img", feed.dir);
  fs.mkdirSync(THUMBS, { recursive: true });
  const ids = [...new Set(feed.list.map((n) => /data-video-id="([\w-]{11})"/.exec(n.body)?.[1]).filter(Boolean))];
  const localThumb = new Map();
  let got = 0, missed = 0;
  const pull = async (id) => {
    const dest = path.join(THUMBS, `${id}.jpg`);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) { localThumb.set(id, true); got++; return; }
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 10000);
      const res = await fetch(`https://i.ytimg.com/vi/${id}/mqdefault.jpg`, { signal: ac.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(String(res.status));
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000) throw new Error("too small");
      fs.writeFileSync(dest, buf);
      localThumb.set(id, true); got++;
    } catch { missed++; }
  };
  for (let i = 0; i < ids.length; i += 8) await Promise.all(ids.slice(i, i + 8).map(pull));
  if (ids.length) console.error(`${feed.label} thumbnails: ${got} local, ${missed} falling back to i.ytimg.com`);

  writeJson(path.join(SEARCH, feed.out), feed.list.map((n) => {
    const w = [...(weights.get(n.url) ?? new Map())].sort((a, b) => b[1] - a[1] || BOOKS.indexOf(a[0]) - BOOKS.indexOf(b[0]));
    const cut = Math.max(3, (w[0]?.[1] ?? 0) * 0.4);
    const id = /data-video-id="([\w-]{11})"/.exec(n.body)?.[1] || "";
    return {
      title: n.title, url: n.url, date: n.date, year: n.year,
      thumb: !id ? "" : localThumb.get(id) ? `/img/${feed.dir}/${id}.jpg` : `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      books: w.filter(([, c]) => c >= cut).slice(0, 4).map(([b]) => b),
    };
  }));
}
// Scripture is grouped one record per chapter, with each verse as an anchored heading, so
// Pagefind serves verse-level sub-results without emitting one fragment file per verse
// (one per verse meant 39k files in the deploy; one per chapter is ~1.3k).
for (const b of BOOKS) for (const [c, vs] of Object.entries(bible[b]))
  records.push({ kind: "verse", title: `${b} ${c}`, url: `/bible/${bookSlug[b]}/${c}`,
    anchored: vs.map((t, i) => (t ? [`v${i + 1}`, `${b} ${c}:${i + 1}`, t] : null)).filter(Boolean) });
writeJson(path.join(SEARCH, "books.json"), BOOKS.map((b) => ({ book: b, slug: bookSlug[b] })));
writeJson(path.join(SEARCH, "laws.json"), handbook.parts.flatMap((p) => p.sections.flatMap((s) => s.entries.map((e) => ({ id: `${s.id}.${e.n}`, text: e.text, url: `${sectionUrl(s)}#${s.id}.${e.n}` })))));
writeJson(path.join(SEARCH, "precepts.json"), sortedPrecepts.map((t) => ({ title: t.title, url: preceptUrl(t), n: t.refs.length })));
writeJson(path.join(SEARCH, "cases.json"), cases.cases.map((c) => ({ name: c.name, url: caseUrl(c), text: `${c.charge}. ${c.summary} ${c.offense} ${c.judgment}` })));
for (const p of handbook.parts) for (const sec of p.sections)
  records.push({ kind: "law", title: `${sec.id} ${sec.title}`, url: sectionUrl(sec),
    anchored: sec.entries.map((e) => [`${sec.id}.${e.n}`, `${sec.id}.${e.n}`, e.text]) });
for (const t of sortedPrecepts) records.push({ kind: "precept", title: t.title, url: preceptUrl(t), sub: `${t.refs.length} verses`, content: t.title });
for (const c of cases.cases) records.push({ kind: "case", title: c.name, url: caseUrl(c), content: `${c.charge}. ${c.summary} ${c.offense} ${c.judgment}` });
writeJson(path.join(ROOT, ".search-records.json"), records);
/* ---------------- API: cross references; WEB parallel translation ----------------
   data/crossrefs.json: public-domain Treasury of Scripture Knowledge lineage, converted from
   github.com/josephilipraja/bible-cross-reference-json (66 books, capped at 12 refs per verse).
   data/web-translation.json: World English Bible (public domain), from the world-english-bible
   npm package, for the per-verse compare view. Both are emitted per chapter so the reader
   fetches only the open chapter. */
{
  const crossrefs = json(path.join(DATA, "crossrefs.json"));
  for (const [slug, chapters] of Object.entries(crossrefs))
    for (const [c, verses] of Object.entries(chapters)) writeJson(path.join(API, "xref", slug, `${c}.json`), verses);
  const web = json(path.join(DATA, "web-translation.json"));
  for (const [slug, chapters] of Object.entries(web))
    for (const [c, verses] of Object.entries(chapters)) writeJson(path.join(API, "web", slug, `${c}.json`), verses);
}
writeJson(path.join(API, "index.json"), { kjv: "/api/kjv/books.json", laws: "/api/laws/index.json", precepts: "/api/precepts/index.json", cases: "/api/cases/index.json", notes: "/api/notes/index.json", concordance: "/api/concordance/<book-slug>/<chapter>.json", xref: "/api/xref/<book-slug>/<chapter>.json", web: "/api/web/<book-slug>/<chapter>.json", chapter: "/api/kjv/<book-slug>/<chapter>.json" });

write(path.join(ROOT, "src", "data", "stats.json"), JSON.stringify({
  chapters: Object.values(CHAPTERS).reduce((a, b) => a + b, 0), books: BOOKS.length, verses: BOOKS.reduce((a, b) => a + Object.values(bible[b]).flat().filter(Boolean).length, 0),
  studies: notes.filter((n) => n.kind === "study").length, classes: notes.filter((n) => n.kind === "class").length, captains: notes.filter((n) => n.kind === "captains").length, encyclopedia: notes.filter((n) => n.kind === "encyclopedia").length,
  laws: handbook.parts.reduce((a, p) => a + p.sections.reduce((x, s) => x + s.entries.length, 0), 0), sections: Object.keys(sectionById).length, parts: handbook.parts.length,
  precepts: precepts.length, cases: cases.cases.length, citedChapters: cited.size,
}));
const count = (d) => fs.readdirSync(d, { recursive: true }).filter((f) => f.endsWith(".md")).length;
console.error(`docs: ${count(DOCS)} pages · api: ${fs.readdirSync(API, { recursive: true }).filter((f) => f.endsWith(".json")).length} json · cited chapters: ${cited.size}`);
