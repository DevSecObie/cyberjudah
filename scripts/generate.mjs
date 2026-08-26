// Generate docs/ and static/api/ from vault/ and data/.
//
//   node scripts/generate.mjs
//
// Reads   vault/Bible, vault/Study Bible, vault/Class Notes, vault/Encyclopedia (markdown, Obsidian style)
//         data/handbook.json, data/precepts.json, data/cases.json, data/bible/*.json (from the Python pipeline)
// Writes  docs/{bible,study,classes,encyclopedia,law,precepts,cases,concordance}/**  (CommonMark; scripture embedded)
//         static/api/**/*.json  (the same library as data: kjv chapters, laws, precepts, cases, concordance, notes)
//         static/search/*.json  (indexes for the search page)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VAULT = path.join(ROOT, "vault");
const DATA = path.join(ROOT, "data");
const DOCS = path.join(ROOT, "docs");
const API = path.join(ROOT, "static", "api");
const SEARCH = path.join(ROOT, "static", "search");
const BLOG = path.join(ROOT, "blog");

const read = (p) => fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "");
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

for (const d of [DOCS, API, SEARCH, BLOG]) fs.rmSync(d, { recursive: true, force: true });

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

/* ---------------- notes from the vault ---------------- */
function parseFrontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) return [{}, text];
  const o = {};
  for (const line of m[1].split("\n")) { const i = line.indexOf(":"); if (i > 0) o[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, ""); }
  return [o, text.slice(m[0].length)];
}
const notes = []; // {kind, slug, title, url, book, chapters, range, date, series, body, refs, sidebarPos}
function chapterRefFromTarget(target, v) {
  const m = /^(.*?) (\d+)$/.exec(target.trim()); if (!m) return null;
  let book = resolveBook(m[1]); let ch = +m[2]; if (!book) return null;
  if (book === "Baruch" && ch === 6) { book = "Epistle of Jeremiah"; ch = 1; }
  if (!bible[book]?.[String(ch)]) return null;
  return { book, chapter: ch, verses: v ? String(v) : "" };
}
const LINK = /(?<!!)\[\[([^\]|#]+)(?:#\^v(\d+))?(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g;
const EMBED_LINE = /^([ \t]*)!\[\[([^\]|#]+)#\^v(\d+)\]\][ \t]*$/;
const EMBED_INLINE = /!\[\[([^\]|#]+)#\^v(\d+)\]\]/g;
const EMBED_OTHER = /!\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g;
// The vault folders carry the site's own names now ("4 Chapters A Day", "Sabbath Class
// Notes"); fall back to the older names so an un-renamed vault still builds.
const vaultDir = (...names) => names.map((n) => path.join(VAULT, n)).find((d) => fs.existsSync(d)) ?? path.join(VAULT, names[0]);
const STUDY_DIR = vaultDir("4 Chapters A Day", "Study Bible");
const CLASS_DIR = vaultDir("Sabbath Class Notes", "Class Notes");
for (const p of fs.readdirSync(STUDY_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()))
  for (const q of fs.readdirSync(path.join(STUDY_DIR, p.name), { withFileTypes: true }).filter((d) => d.isDirectory()))
    for (const f of fs.readdirSync(path.join(STUDY_DIR, p.name, q.name)).filter((f) => f.endsWith(" Study Notes.md"))) {
      const stem = f.replace(/\.md$/, ""); const m = /^(.*?) (\d+)(?:-(\d+))? Study Notes$/.exec(stem); if (!m) continue;
      const book = resolveBook(m[1]) ?? m[1]; const a = +m[2], b = +(m[3] ?? m[2]);
      const [meta, body] = parseFrontmatter(read(path.join(STUDY_DIR, p.name, q.name, f)));
      const range = `${book} ${a}${b > a ? "-" + b : ""}`;
      notes.push({ kind: "study", stem, slug: `${a}${b > a ? "-" + b : ""}`, url: `/study/${bookSlug[book] ?? slug(book)}/${a}${b > a ? "-" + b : ""}`, title: meta.title || (/^# (.+)$/m.exec(body)?.[1] ?? range), book, chapters: [a, b], range, body, sidebarPos: a });
    }
for (const y of fs.readdirSync(CLASS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()))
  for (const f of fs.readdirSync(path.join(CLASS_DIR, y.name)).filter((f) => f.endsWith(".md"))) {
    const stem = f.replace(/\.md$/, ""); const m = /^(\d{4}-\d{2}-\d{2}) - (.*)$/.exec(stem);
    const [meta, body] = parseFrontmatter(read(path.join(CLASS_DIR, y.name, f)));
    const date = meta.date || m?.[1] || "";
    notes.push({ kind: "class", stem, slug: slug(stem), url: `/classes/${y.name}/${slug(stem)}`, title: meta.title || m?.[2] || stem, date, dateEstimated: meta["date-estimated"] === "true", series: meta.class || "", year: y.name, body, sidebarPos: -parseInt(date.replace(/-/g, ""), 10) || 0 });
  }
for (const f of fs.readdirSync(path.join(VAULT, "Encyclopedia")).filter((f) => f.endsWith(".md") && !f.startsWith("_"))) {
  const stem = f.replace(/\.md$/, ""); const [meta, body] = parseFrontmatter(read(path.join(VAULT, "Encyclopedia", f)));
  const summary = body.split("\n").find((l) => l.trim() && !l.startsWith("#"))?.trim() ?? "";
  notes.push({ kind: "encyclopedia", stem, slug: slug(stem), url: `/encyclopedia/${slug(stem)}`, title: meta.title || stem, summary, body, sidebarPos: 0 });
}
const noteByStem = new Map(notes.map((n) => [n.stem, n]));
const noteByTitle = new Map(notes.map((n) => [n.title.toLowerCase(), n]));
const studyFor = (book, ch) => notes.find((n) => n.kind === "study" && n.book === book && ch >= n.chapters[0] && ch <= n.chapters[1]) ?? null;

/** wikilink target -> url */
function linkUrl(target, v) {
  const t = target.trim();
  const ch = chapterRefFromTarget(t, v); if (ch) return chapterUrl(ch.book, ch.chapter, v);
  let m = /^Book of (.+)$/.exec(t); if (m) { const b = resolveBook(m[1]); if (b) return bookUrl(b); }
  if (t === "The Holy Bible" || t === "Scripture index") return "/bible";
  if (noteByStem.has(t)) return noteByStem.get(t).url;
  m = /^(.+?) Index$/.exec(t); if (m) { const b = resolveBook(m[1]); if (b) return `/study/${bookSlug[b]}`; }
  if (t === "Class Notes Index") return "/classes";
  if (t === "_Index" || t === "Encyclopedia") return "/encyclopedia";
  if (t === "Law Index") return "/law"; if (t === "Home") return "/";
  if (t === "Cases index") return "/cases"; if (t === "Precepts index") return "/precepts"; if (t === "Concordance") return "/concordance";
  m = /^(\d{1,2}[A-Z])\b/.exec(t); if (m && sectionById[m[1]]) return sectionUrl(sectionById[m[1]]);
  m = /^Part (\d{2}) /.exec(t); if (m) { const p = handbook.parts.find((x) => x.n === +m[1]); if (p) return partUrl(p); }
  const nt = noteByTitle.get(t.toLowerCase()); if (nt) return nt.url;
  const c = cases.cases.find((x) => x.name === t || x.name === t.replace(/ \(case\)$/, "")); if (c) return caseUrl(c);
  const tp = precepts.find((x) => x.title === t || x.title === t.replace(/ \(precept\)$/, "")); if (tp) return preceptUrl(tp);
  return null;
}
/** Obsidian markdown -> CommonMark with scripture embedded and links resolved. */
function transform(body, self) {
  let s = body.replace(/%%[\s\S]*?%%/g, "");
  s = s.replace(/^# .+\n/m, "");                                   // the page has its own title
  s = s.replace(/^(?:\uFEFF)?← \[\[.*?→\s*$/m, "");                // prev/next lines: Docusaurus paginates itself
  // line embeds: consecutive ones become one blockquote
  const lines = s.split("\n"); const out = []; let quoting = false; let qind = "";
  for (const line of lines) {
    const m = EMBED_LINE.exec(line);
    if (m) {
      const ind = m[1].replace(/\t/g, "    ");   // the embed sits in a list item; drop its indent and the prose under it becomes a code block
      const r = chapterRefFromTarget(m[2], +m[3]);
      const t = r && verseText(r.book, r.chapter, +m[3]);
      if (t) { out.push(`${quoting ? `${qind}>\n` : ""}${ind}> <sup>[${m[3]}](${chapterUrl(r.book, r.chapter, +m[3])})</sup> ${esc(t)}`); quoting = true; qind = ind; if (self) cite({ book: r.book, chapter: r.chapter, verses: "" }, self.kind, self.label, self.url); }
      continue;
    }
    if (quoting && line.trim() !== "") { out.push(""); }
    quoting = false;
    out.push(line);
  }
  s = out.join("\n");
  s = s.replace(EMBED_INLINE, (_m, target, v) => { const r = chapterRefFromTarget(target, +v); const t = r && verseText(r.book, r.chapter, +v); return t ? `<sup>${v}</sup> ${esc(t)}` : `${target}:${v}`; });
  s = s.replace(EMBED_OTHER, (_m, target) => `*${target}*`);
  s = s.replace(LINK, (_m, target, v, label) => {
    const text = (label ?? target).trim();
    const url = linkUrl(target, v ? +v : undefined);
    if (self) { const r = chapterRefFromTarget(target, v ? +v : undefined); if (r) { const lm = /:([\d,\-]+)$/.exec(text); cite({ book: r.book, chapter: r.chapter, verses: lm ? lm[1] : r.verses }, self.kind, self.label, self.url); } }
    return url ? `[${text}](${url})` : text;
  });
  // callouts -> admonitions
  s = s.replace(/^> \[!(\w+)\][+-]?\s*(.*)\n((?:>.*\n?)*)/gm, (_m, type, title, rest) => {
    const t = { info: "info", note: "note", tip: "tip", warning: "warning", danger: "danger", caution: "warning" }[type.toLowerCase()] ?? "note";
    return `:::${t}${title ? " " + title : ""}\n${rest.replace(/^> ?/gm, "")}\n:::\n`;
  });
  s = s.replace(/<style>[\s\S]*?<\/style>/g, "");
  return s.trim() + "\n";
}

/* ---------------- write: notes (first, so their citations feed the chapter pages) ---------------- */
const noteLabel = (n) => n.kind === "study" ? (n.title.startsWith(n.book) ? `${n.range} · ${n.title.replace(/^[^:]+:\s*/, "")}` : `${n.range} · ${n.title}`) : n.title;
const noteSelf = (n) => ({ kind: n.kind === "encyclopedia" ? "encyclopedia" : "note", label: noteLabel(n), url: n.url });
function classBody(n) {
  const videoId = /i\.ytimg\.com\/vi\/([\w-]{11})\//.exec(n.body)?.[1];
  let body = transform(n.body, noteSelf(n));
  if (!videoId) return body;
  const player = `<div class="class-video-mount" data-video-id="${videoId}"></div>`;
  return body.replace(/<figure class="class-hero">[\s\S]*?<\/figure>/, player);
}
write(path.join(DOCS, "study", "_category_.json"), JSON.stringify({ label: "4 Chapters a Day", position: 2, link: { type: "doc", id: "study/index" } }));
const studyBooks = [...new Set(notes.filter((n) => n.kind === "study").map((n) => n.book))].sort((a, b) => bookNum[a] - bookNum[b]);
write(path.join(DOCS, "study", "index.md"), fm({ title: "4 Chapters a Day", slug: "/study", sidebar_position: 0, pagination_next: null, pagination_prev: null }) +
  studyBooks.map((b) => `## [${b}](/study/${bookSlug[b]})\n\n` + notes.filter((n) => n.kind === "study" && n.book === b).sort((x, y) => x.chapters[0] - y.chapters[0]).map((n) => `- [${n.range}](${n.url}): ${n.title}`).join("\n")).join("\n\n") + "\n");
for (const b of studyBooks) {
  const dir = path.join(DOCS, "study", bookSlug[b]);
  write(path.join(dir, "_category_.json"), JSON.stringify({ label: b, position: bookNum[b], link: { type: "doc", id: `study/${bookSlug[b]}/index` } }));
  const list = notes.filter((n) => n.kind === "study" && n.book === b).sort((x, y) => x.chapters[0] - y.chapters[0]);
  write(path.join(dir, "index.md"), fm({ title: `${b}: 4 Chapters a Day`, slug: `/study/${bookSlug[b]}`, sidebar_position: 0, sidebar_label: `${b}: all sessions` }) + `Read the scripture itself: [${b}](${bookUrl(b)})\n\n` + list.map((n) => `- [${n.range}](${n.url}): ${n.title}`).join("\n") + "\n");
  for (const n of list) {
    const chs = Array.from({ length: n.chapters[1] - n.chapters[0] + 1 }, (_, i) => n.chapters[0] + i);
    const readLine = /Read the chapter/.test(n.body) ? "" : `<p class="taught">Read the chapters: ${chs.map((c) => `<a href="${href(chapterUrl(b, c))}">${abbr(b)} ${c}</a>`).join(" · ")}</p>\n\n`;
    write(path.join(dir, `${n.slug}.md`), fm({ title: n.title, slug: n.url, sidebar_label: n.range, sidebar_position: n.sidebarPos, description: `Study notes on ${n.range}` }) +
      readLine + transform(n.body, noteSelf(n)));
  }
}
// Class notes are dated entries, so they are blog posts, not docs: the blog plugin
// gives reverse-chronological order, an RSS/Atom feed and an archive for free, and
// removes the negated-date sidebar_position hack this used to need.
const classNotes = notes.filter((n) => n.kind === "class").sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
const years = [...new Set(classNotes.map((n) => n.year))].sort().reverse();
for (const n of classNotes) {
  const slugPath = n.url.replace(/^\/classes\//, "");
  write(path.join(BLOG, n.year, `${n.date || n.slug}-${n.slug}.md`),
    fm({ title: n.title, slug: slugPath, date: n.date || undefined,
         description: `${n.series}${n.date ? " · " + n.date : ""}`,
         tags: n.series ? [n.series] : undefined }) +
    `<p class="taught">${n.series}${n.date ? " · " + n.date + (n.dateEstimated ? " (date estimated)" : "") : ""}</p>\n\n` +
    "<!-- truncate -->\n\n" + classBody(n));
}
write(path.join(DOCS, "encyclopedia", "_category_.json"), JSON.stringify({ label: "Encyclopedia", position: 4, link: { type: "doc", id: "encyclopedia/index" } }));
const enc = notes.filter((n) => n.kind === "encyclopedia").sort((a, b) => a.title.localeCompare(b.title));
write(path.join(DOCS, "encyclopedia", "index.md"), fm({ title: "Encyclopedia", slug: "/encyclopedia", sidebar_position: 0, pagination_next: null, pagination_prev: null }) + enc.map((n) => `- [${n.title}](${n.url}): ${n.summary}`).join("\n") + "\n");
for (const n of enc) write(path.join(DOCS, "encyclopedia", `${n.slug}.md`), fm({ title: n.title, slug: n.url, description: n.summary }) + transform(n.body, noteSelf(n)));

/* ---------------- write: cases ---------------- */
write(path.join(DOCS, "cases", "_category_.json"), JSON.stringify({ label: "Case Studies", position: 7, link: { type: "doc", id: "cases/index" } }));
write(path.join(DOCS, "cases", "index.md"), fm({ title: "Case Studies", slug: "/cases", sidebar_position: 0, pagination_next: null, pagination_prev: null }) +
  `<p class="legend">${Object.keys(VERDICT).map(badge).join(" ")}</p>\n\n` +
  ERAS.map((e) => { const list = cases.cases.filter((c) => c.era === e); return list.length ? `## ${e}\n\n` + list.map((c) => `- [${c.name}](${caseUrl(c)}) ${badge(c.verdict)}<br/><span class="charge">${c.charge}</span>`).join("\n") : ""; }).filter(Boolean).join("\n\n") + "\n");
const lexicon = fs.existsSync(path.join(VAULT, "_tools", "lexicon.tsv")) ? read(path.join(VAULT, "_tools", "lexicon.tsv")).split("\n").slice(1).filter(Boolean).map((l) => { const [topic, , terms] = l.split("\t"); return { topic, terms: (terms || "").split(";").map((t) => t.trim().toLowerCase()).filter(Boolean) }; }) : [];
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
writeJson(path.join(SEARCH, "notes.json"), notes.map((n) => ({ kind: n.kind, title: n.title, url: n.url, text: plain(n.body) })));
// class browse index. Thumbnails are pulled to our own origin at build time: a
// cross-origin image is at the mercy of the viewer's blockers, data saver and
// network, which is why they were missing on some devices. mqdefault is a true
// 16:9 320x180 (hqdefault is 4:3 with letterbox bars) and about half the bytes.
// If a fetch fails the remote URL stays as the fallback, so this can only improve
// on the previous behaviour and can never fail the build.
{
  const weights = new Map();
  for (const [key, rows] of cited) {
    const book = key.split("|")[0];
    for (const r of rows) {
      if (!r.url.startsWith("/classes/")) continue;
      if (!weights.has(r.url)) weights.set(r.url, new Map());
      const w = weights.get(r.url); w.set(book, (w.get(book) ?? 0) + 1);
    }
  }

  const THUMBS = path.join(ROOT, "static", "img", "classes");
  fs.mkdirSync(THUMBS, { recursive: true });
  const ids = [...new Set(classNotes.map((n) => /i\.ytimg\.com\/vi\/([\w-]{11})\//.exec(n.body)?.[1]).filter(Boolean))];
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
  console.error(`class thumbnails: ${got} local, ${missed} falling back to i.ytimg.com`);

  writeJson(path.join(SEARCH, "classes.json"), classNotes.map((n) => {
    const w = [...(weights.get(n.url) ?? new Map())].sort((a, b) => b[1] - a[1] || BOOKS.indexOf(a[0]) - BOOKS.indexOf(b[0]));
    const cut = Math.max(3, (w[0]?.[1] ?? 0) * 0.4);
    const id = /i\.ytimg\.com\/vi\/([\w-]{11})\//.exec(n.body)?.[1] || "";
    return {
      title: n.title, url: n.url, date: n.date, year: n.year,
      thumb: !id ? "" : localThumb.get(id) ? `/img/classes/${id}.jpg` : `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      books: w.filter(([, c]) => c >= cut).slice(0, 4).map(([b]) => b),
    };
  }));
}
writeJson(path.join(SEARCH, "verses.json"), BOOKS.flatMap((b) => Object.entries(bible[b]).flatMap(([c, vs]) => vs.map((t, i) => (t ? [bookNum[b], +c, i + 1, t] : null)).filter(Boolean))));
writeJson(path.join(SEARCH, "books.json"), BOOKS.map((b) => ({ book: b, slug: bookSlug[b] })));
writeJson(path.join(SEARCH, "laws.json"), handbook.parts.flatMap((p) => p.sections.flatMap((s) => s.entries.map((e) => ({ id: `${s.id}.${e.n}`, text: e.text, url: `${sectionUrl(s)}#${s.id}.${e.n}` })))));
writeJson(path.join(SEARCH, "precepts.json"), sortedPrecepts.map((t) => ({ title: t.title, url: preceptUrl(t), n: t.refs.length })));
writeJson(path.join(SEARCH, "cases.json"), cases.cases.map((c) => ({ name: c.name, url: caseUrl(c), text: `${c.charge}. ${c.summary} ${c.offense} ${c.judgment}` })));
writeJson(path.join(API, "index.json"), { kjv: "/api/kjv/books.json", laws: "/api/laws/index.json", precepts: "/api/precepts/index.json", cases: "/api/cases/index.json", notes: "/api/notes/index.json", concordance: "/api/concordance/<book-slug>/<chapter>.json", chapter: "/api/kjv/<book-slug>/<chapter>.json" });

write(path.join(ROOT, "src", "data", "stats.json"), JSON.stringify({
  chapters: Object.values(CHAPTERS).reduce((a, b) => a + b, 0), books: BOOKS.length, verses: BOOKS.reduce((a, b) => a + Object.values(bible[b]).flat().filter(Boolean).length, 0),
  studies: notes.filter((n) => n.kind === "study").length, classes: notes.filter((n) => n.kind === "class").length, encyclopedia: notes.filter((n) => n.kind === "encyclopedia").length,
  laws: handbook.parts.reduce((a, p) => a + p.sections.reduce((x, s) => x + s.entries.length, 0), 0), sections: Object.keys(sectionById).length, parts: handbook.parts.length,
  precepts: precepts.length, cases: cases.cases.length, citedChapters: cited.size,
}));
const count = (d) => fs.readdirSync(d, { recursive: true }).filter((f) => f.endsWith(".md")).length;
console.error(`docs: ${count(DOCS)} pages · api: ${fs.readdirSync(API, { recursive: true }).filter((f) => f.endsWith(".json")).length} json · cited chapters: ${cited.size}`);
