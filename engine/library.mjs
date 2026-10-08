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
import { loadClassMetadata, correctedClass } from "./class-metadata.mjs";
import fs from "node:fs";
import path from "node:path";

export const read = (p) => fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "");
export const json = (p) => JSON.parse(read(p));
export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const ABBR = { Genesis: "Gen", Exodus: "Exod", Leviticus: "Lev", Numbers: "Num", Deuteronomy: "Deut", Joshua: "Josh", Judges: "Judg", "1 Samuel": "1 Sam", "2 Samuel": "2 Sam", "1 Kings": "1 Kgs", "2 Kings": "2 Kgs", "1 Chronicles": "1 Chr", "2 Chronicles": "2 Chr", Nehemiah: "Neh", Psalms: "Ps", Proverbs: "Prov", Ecclesiastes: "Eccl", "Song of Solomon": "Song", Isaiah: "Isa", Jeremiah: "Jer", Lamentations: "Lam", Ezekiel: "Ezek", Daniel: "Dan", Hosea: "Hos", Obadiah: "Obad", Micah: "Mic", Nahum: "Nah", Habakkuk: "Hab", Zephaniah: "Zeph", Haggai: "Hag", Zechariah: "Zech", Malachi: "Mal", Matthew: "Matt", Romans: "Rom", "1 Corinthians": "1 Cor", "2 Corinthians": "2 Cor", Galatians: "Gal", Ephesians: "Eph", Philippians: "Phil", Colossians: "Col", "1 Thessalonians": "1 Thess", "2 Thessalonians": "2 Thess", "1 Timothy": "1 Tim", "2 Timothy": "2 Tim", Philemon: "Phlm", Hebrews: "Heb", "1 Peter": "1 Pet", "2 Peter": "2 Pet", Revelation: "Rev", "Wisdom of Solomon": "Wis", Sirach: "Sir", "1 Maccabees": "1 Macc", "2 Maccabees": "2 Macc", "Esther (Greek)": "Esth (Gk)", "Song of the Three Children": "Song Thr", "Bel and the Dragon": "Bel", "Prayer of Manasseh": "Pr Man", "Epistle of Jeremiah": "Ep Jer" };

export const VERDICT = { death: "Put to death", plague: "Plague", exile: "Exile", captivity: "Captivity", curse: "Cursed", restitution: "Restitution", spared: "Spared", reprieve: "Reprieve", temporal: "Temporal judgment", unrecorded: "Sentence not recorded", deferred: "Sentence deferred", blessed: "Kept the law" };

/** "1-3, 7" -> [1,2,3,7]; "" -> []. */
/**
 * Class and episode titles arrive as typed on YouTube, so some are ALL CAPS. A title that is
 * shouted is set in title case here; titles that already carry mixed case are left alone.
 */
const TITLE_SMALL = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into", "nor", "of", "on", "or", "the", "to", "vs", "with", "w/"]);
const TITLE_KEEP = new Set(["AI", "CIA", "DNA", "FBI", "FDA", "GMO", "I", "II", "III", "IV", "IX", "KJV", "LGBT", "NASA", "NATO", "NWO", "TV", "UK", "UN", "US", "USA", "V", "VI", "VII", "VIII", "WWI", "WWII", "X", "XI", "XII", "XX"]);
export function tidyTitle(t) {
  const s = String(t ?? "").trim();
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (letters.length < 4 || letters !== letters.toUpperCase()) return s;
  return s.split(/(\s+)/).map((w, i, arr) => {
    if (!w.trim()) return w;
    if (TITLE_KEEP.has(w.replace(/[^A-Za-z]/g, ""))) return w;
    const lower = w.toLowerCase();
    const prevWord = arr.slice(0, i).reverse().find((x) => x.trim());
    const afterBreak = i === 0 || /[:\-\u2013\u2014?!.]$/.test(prevWord ?? "");
    if (!afterBreak && TITLE_SMALL.has(lower.replace(/[^a-z/]/g, ""))) return lower;
    return lower.replace(/(^|[\s("\u201c/-])([a-z])/g, (m, pre, c) => pre + c.toUpperCase());
  }).join("");
}

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
  const classMetadata = loadClassMetadata(ROOT);
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
  // A book's prologue (the 1611's two before Ecclesiasticus) is not a verse: it rides with chapter 1.
  const prologues = {};
  for (const e of bibleIndex) { const f = json(path.join(DATA, "bible", e.slug + ".json")); bible[e.book] = f.chapters; if (f.prologue) prologues[e.book] = f.prologue; }
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
          url: `${prefix}${meta.slug}`, title: tidyTitle(meta.title || f), date: meta.date || "",
          dateEstimated: /\(date estimated\)/.test(body), series: tags[0] ?? "", topics: tags.slice(1),
          teacher: meta.teacher || "", description: meta.description || "", collection: meta.collection || "", year: y.name, body,
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
  /* ---------------- Our Hidden History: verbatim transcripts, and notes once written ---------------- */
  // history/transcripts/<videoId>.json is what scripts/history/ingest.py writes; it carries the
  // episode's slug (<year>/<date>-ep-<n>-<title>), the same shape as a class note's. The
  // write-up, when there is one, is a third feed at history/notes/<year>/<date>-<slug>.md with
  // that exact slug, so the page keeps its address; it is matched to its transcript by the
  // data-video-id in the note and cites scripture like any class note.
  const HIST = path.join(ROOT, "history");
  const history = [];
  const TDIR = path.join(HIST, "transcripts");
  readFeed(path.join(HIST, "notes"), "history", "/history/");
  const historyNotes = new Map(notes.filter((n) => n.kind === "history" && n.videoId).map((n) => [n.videoId, n]));
  if (fs.existsSync(TDIR)) {
    for (const f of fs.readdirSync(TDIR).filter((f) => f.endsWith(".json")).sort()) {
      const t = json(path.join(TDIR, f));
      const note = historyNotes.get(t.videoId) ?? null;
      const s = t.slug ?? `${(t.date ?? "0000").slice(0, 4)}/${t.date ?? "undated"}-${slug(t.cleanTitle ?? t.title)}`;
      if (note && note.slug !== s.split("/").pop()) console.error(`history: note ${note.file} has slug ${note.slug}, transcript says ${s}`);
      history.push({ kind: "history", slug: s, file: `history/transcripts/${f}`, url: note ? note.url : `/history/${s}`, title: note?.title || t.cleanTitle || t.title, rawTitle: t.title, episode: t.episode ?? null,
        date: t.date ?? null, year: t.date ? t.date.slice(0, 4) : "", duration: t.duration ?? null, views: t.views ?? null, videoId: t.videoId, start: t.start ?? 0, words: t.words ?? 0,
        segments: t.segments ?? [], body: note?.body ?? "", teacher: note?.teacher ?? "", topics: note?.topics ?? [], description: note?.description ?? "", noted: !!note });
    }
    history.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")) || (b.episode ?? 0) - (a.episode ?? 0));
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

  // Precepts lined up with the scripture they were taught under. A class note opens a
  // scripture as a bold linked heading at the start of a line; the precepts the teacher
  // paired with it are the indented "Precepts:" list beneath, each a bold link, the verse
  // quoted, then his line about it. Both ends are kept: the chapter opened learns the
  // precepts, and the precept's chapter learns where it was opened.
  const linked = new Map(); // "Book|ch" -> [{verses, kind, ref, text, note, ts}]
  const link = (r, row) => { const k = `${r.book}|${r.chapter}`; if (!linked.has(k)) linked.set(k, []); linked.get(k).push({ verses: r.verses || "", ...row }); };
  const HEAD = /^\*\*\[([^\]]+)\]\(\/bible\/([a-z0-9-]+)\/(\d+)(?:#v(\d+))?\)\*\*(?:\s+\*\[\[?([\d:]+)\]?\(([^)]*)\)\]\*)?/;
  // The moments a class read a scripture: the verses, the class, and its recording at that
  // second, so the Bible can link a verse straight to where it was taught.
  const moments = new Map(); // "Book|ch" -> [{verses, label, url, date, video, t, ts}]
  const secondsOf = (ts) => ts.split(":").reduce((a, x) => a * 60 + Number(x || 0), 0);
  // The class's own breakdown of a scripture it opened, the points under it in the note, each
  // placed on the verse of the passage it speaks to (the one it shares the most words with;
  // a point that speaks to none in particular is left off), for the verse's Comments.
  const commentary = new Map(); // "Book|ch" -> [{verses, points[], note, ts, video, t}]
  // The passages each note opened, in order, with the precepts under each: note url -> [{book, chapter, verses, label, ts, video, t, precepts[], points}]. Topic threads are strung from these.
  const openedBy = new Map();
  const STOPW = new Set("the and that unto shall this with them they their thou thee thy for from was were have hath which what when then there his him her not all but his our you your ye are into upon".split(" "));
  const wordsOf = (t) => new Set((t.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter((w) => !STOPW.has(w)));
  const verseList = (spec, n) => { if (!spec) return Array.from({ length: n }, (_, i) => i + 1); const out = []; for (const part of spec.split(",")) { const [a, b] = part.split("-").map(Number); for (let v = a; v <= (b || a); v++) if (v >= 1 && v <= n) out.push(v); } return out; };
  const placePoints = (opened, pts, row) => {
    const texts = bible[opened.book]?.[opened.chapter] ?? [];
    const vs = verseList(opened.verses, texts.length);
    if (!vs.length || !pts.length) return;
    const by = new Map();
    for (const pt of pts) {
      const w = wordsOf(pt); let best = vs[0], score = 0;
      if (vs.length > 1) for (const v of vs) { let s = 0; for (const x of wordsOf(texts[v - 1] ?? "")) if (w.has(x)) s++; if (s > score) { best = v; score = s; } }
      // A point that speaks to no verse of the passage in particular is not a comment on any
      // one of them, so it is left off rather than put on the first.
      if (vs.length > 1 && score < 2) continue;
      const at = best;
      if (!by.has(at)) by.set(at, []); by.get(at).push(pt);
    }
    const k = `${opened.book}|${opened.chapter}`; if (!commentary.has(k)) commentary.set(k, []);
    for (const [v, list] of [...by].sort((a, b) => a[0] - b[0])) commentary.get(k).push({ verses: String(v), passage: opened.label, points: list, ...row });
  };
  const PRECEPT = /^\s+-\s+\*\*\[([^\]]+)\]\(\/bible\/([a-z0-9-]+)\/(\d+)(?:#v(\d+))?\)\*\*/;
  const refOf = (label, bslug, ch, anchor) => {
    const book = bookBySlug[bslug]; if (!book || !bible[book]?.[ch]) return null;
    const lm = /:([\d,\-]+)$/.exec(label.trim());
    return { book, chapter: +ch, verses: lm ? lm[1] : anchor || "", label: label.trim(), url: `/bible/${bslug}/${ch}${anchor ? "#v" + anchor : ""}` };
  };
  // The "Precept(s)" breakdowns, one or two sentences on why each precept is there, written
  // from the class by scripts/precepts/why.py and keyed "<note file>|<scripture opened>|<precept>".
  const whyFile = path.join(DATA, "precepts", "why.json");
  const WHY = fs.existsSync(whyFile) ? JSON.parse(fs.readFileSync(whyFile, "utf8")) : {};
  // The verse each precept explains when the class opened a range (scripts/precepts/at.py):
  // the precept shows under that verse rather than piled on the first verse of the range.
  const atFile = path.join(DATA, "precepts", "at.json");
  const AT = fs.existsSync(atFile) ? JSON.parse(fs.readFileSync(atFile, "utf8")) : {};
  // Who taught each passage of a note, when a class had several teachers or the note names
  // none: "<note file>|<scripture opened>" -> "Bishop Nathanyel". The Bishops' and Deacons'
  // teaching is shown first wherever several classes speak to a verse.
  const teachersFile = path.join(DATA, "precepts", "teachers.json");
  const TEACHERS = fs.existsSync(teachersFile) ? JSON.parse(fs.readFileSync(teachersFile, "utf8")) : {};
  function scanPrecepts(body, n) {
    const classNote = { label: n.title, url: n.url, date: n.date || "", teacher: n.teacher || "" };
    let note = classNote;
    const lines = body.split("\n");
    let opened = null, ts = "", precept = null, point = "", video = null, points = [], passage = null;
    const closePassage = () => { if (opened && points.length) placePoints(opened, points, { note, ts, video, t: ts ? secondsOf(ts) : 0 }); if (passage) passage.points = points.length; points = []; };
    const flush = () => {
      if (!opened || !precept) return;
      const text = precept.text.join(" ").replace(/\s+/g, " ").trim();
      const key = `${n.file}|${opened.label}|${precept.ref.label}`;
      const why = WHY[key];
      const at = AT[key]?.v;
      link(at ? { ...opened, verses: at } : opened, { kind: "precept", ref: precept.ref, text, point, note, ts, ...(why ? { why } : {}) });
      link(precept.ref, { kind: "opened", ref: opened, text, point, note, ts, ...(why ? { why } : {}) });
      if (passage) passage.precepts.push({ label: precept.ref.label, url: precept.ref.url, ...(why ? { why } : {}) });
      precept = null;
    };
    for (const raw of lines) {
      const h = HEAD.exec(raw);
      if (h) {
        flush(); closePassage(); opened = refOf(h[1], h[2], h[3], h[4]); ts = h[5] || ""; point = "";
        const who = opened && TEACHERS[`${n.file}|${opened.label}`]; note = who ? { ...classNote, teacher: who } : classNote;
        video = /[?&]v=([\w-]{11})/.exec(h[6] || "")?.[1] ?? n.videoId ?? null;
        if (opened && ts && video) { const k = `${opened.book}|${opened.chapter}`; if (!moments.has(k)) moments.set(k, []); moments.get(k).push({ verses: opened.verses || "", label: n.title, url: n.url, date: n.date || "", teacher: note.teacher, video, t: secondsOf(ts), ts }); }
        passage = opened ? { book: opened.book, chapter: opened.chapter, verses: opened.verses || "", label: opened.label, url: opened.url, ts, video, t: ts ? secondsOf(ts) : 0, teacher: note.teacher || "", precepts: [], points: 0 } : null;
        if (passage) { if (!openedBy.has(n.url)) openedBy.set(n.url, []); openedBy.get(n.url).push(passage); }
        continue;
      }
      if (!opened) continue;
      const pm = PRECEPT.exec(raw);
      if (pm) { flush(); const ref = refOf(pm[1], pm[2], pm[3], pm[4]); precept = ref ? { ref, text: [] } : null; continue; }
      if (/^- /.test(raw)) { flush(); point = plain(raw.slice(2)); points.push(point); continue; }
      if (/^\S/.test(raw) && !/^>/.test(raw)) { flush(); if (/^#/.test(raw)) { closePassage(); opened = null; } continue; }
      if (precept && /^\s{4}\S/.test(raw) && !/^\s*>/.test(raw) && !/^\s*Precepts:/.test(raw)) precept.text.push(plain(raw));
    }
    flush(); closePassage();
  }

  for (let i = 0; i < notes.length; i++) if (["class", "captains"].includes(notes[i].kind)) notes[i] = correctedClass(notes[i], classMetadata);
  const sortDated = (list) => list.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title) || a.url.localeCompare(b.url));
  const studyBooks = [...new Set(notes.filter((n) => n.kind === "study").map((n) => n.book))].sort((a, b) => bookNum[a] - bookNum[b]);
  const studyNotes = studyBooks.flatMap((b) => notes.filter((x) => x.kind === "study" && x.book === b).sort((x, y) => x.chapters[0] - y.chapters[0]));
  const classNotes = sortDated(notes.filter((n) => n.kind === "class"));
  const captainNotes = sortDated(notes.filter((n) => n.kind === "captains"));
  const encNotes = notes.filter((n) => n.kind === "encyclopedia").sort((a, b) => a.title.localeCompare(b.title));

  // Citation order matters for nothing downstream except stable output, so it follows the
  // same order the site has always used: notes, cases, laws, precepts.
  const historyNoteList = notes.filter((n) => n.kind === "history");
  for (const n of [...studyNotes, ...classNotes, ...captainNotes, ...encNotes, ...historyNoteList]) scanCitations(n.body, noteSelf(n));
  // Study notes too: their breakdown of each passage is a verse's comment like a class's.
  for (const n of [...classNotes, ...captainNotes, ...studyNotes]) scanPrecepts(n.body, n);
  // Classes with no study note yet: their precept passes (data/precepts/classes/<video>.json,
  // checked by scripts/precepts/classes.py) add the same precepts, moments and breakdowns.
  // A class that has since got its note is read from the note instead.
  const notedVideos = new Set([...classNotes, ...captainNotes].map((n) => n.videoId).filter(Boolean));
  const passDir = path.join(DATA, "precepts", "classes");
  const BOOK_ALIAS = { ecclesiasticus: "sirach", "wisdom of sirach": "sirach", "rest of esther": "esther-greek", "the rest of esther": "esther-greek", "esther (greek)": "esther-greek", "the wisdom of solomon": "wisdom-of-solomon", "song of the three holy children": "song-of-the-three-children", "the song of the three holy children": "song-of-the-three-children", "history of susanna": "susanna", "the history of susanna": "susanna", "prayer of manasses": "prayer-of-manasseh", "the prayer of manasses": "prayer-of-manasseh", "epistle of jeremy": "epistle-of-jeremiah", psalm: "psalms", "song of songs": "song-of-solomon" };
  const slugByName = Object.fromEntries(Object.entries(bookSlug).map(([b, sl]) => [b.toLowerCase(), sl]));
  const refFrom = (label) => {
    const m = /^\s*(.+?)\s+(\d+)(?::\s*([\d,\s\-–]+))?\s*$/.exec(String(label)); if (!m) return null;
    const name = m[1].trim().toLowerCase().replace(/\./g, "");
    const sl = slugByName[name] ?? BOOK_ALIAS[name]; const book = sl && bookBySlug[sl];
    if (!book || !bible[book]?.[m[2]]) return null;
    const verses = (m[3] ?? "").replace(/\s+/g, "").replace(/–/g, "-");
    const first = verses ? verses.split(/[-,]/)[0] : "";
    return { book, chapter: +m[2], verses, label: String(label).trim(), url: `/bible/${sl}/${m[2]}${first ? "#v" + first : ""}` };
  };
  const passFiles = fs.existsSync(passDir) ? fs.readdirSync(passDir).filter((f) => f.endsWith(".json")).sort() : [];
  let passPrecepts = 0;
  for (const f of passFiles) {
    const c = correctedClass(JSON.parse(fs.readFileSync(path.join(passDir, f), "utf8")), classMetadata);
    if (!c.video || notedVideos.has(c.video)) continue;
    const classNote = { label: c.title, url: `https://www.youtube.com/watch?v=${c.video}`, date: c.date || "", teacher: c.teacher || "" };
    for (const p of c.passages ?? []) {
      const opened = refFrom(p.opened); if (!opened) continue;
      const note = p.teacher ? { ...classNote, teacher: p.teacher } : classNote;
      const ts = p.ts || "", t = ts ? secondsOf(ts) : 0;
      if (ts) { const k = `${opened.book}|${opened.chapter}`; if (!moments.has(k)) moments.set(k, []); moments.get(k).push({ verses: opened.verses, label: c.title, url: note.url, date: note.date, teacher: note.teacher, video: c.video, t, ts }); }
      for (const s of p.sense ?? []) {
        if (!s.text) continue;
        const k = `${opened.book}|${opened.chapter}`; if (!commentary.has(k)) commentary.set(k, []);
        commentary.get(k).push({ verses: String(s.at || opened.verses.split(/[-,]/)[0] || "1"), passage: opened.label, points: String(s.text).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean), note, ts, video: c.video, t });
      }
      for (const pre of p.precepts ?? []) {
        const ref = refFrom(pre.ref); if (!ref) continue;
        const row = { text: "", point: "", note, ts: pre.ts ?? ts, ...(pre.why ? { why: pre.why } : {}) };
        link(pre.at ? { ...opened, verses: String(pre.at) } : opened, { kind: "precept", ref, ...row });
        link(ref, { kind: "opened", ref: opened, ...row });
        passPrecepts++;
      }
    }
  }
  if (passFiles.length) console.error(`precept passes: ${passFiles.length} classes, ${passPrecepts} precepts`);
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
    ROOT, DATA, classMetadata,
    bibleIndex, BOOKS, CHAPTERS, bible, prologues, bookSlug, bookBySlug, bookNum, testament, abbr, chapterUrl, bookUrl, verseText, refLabel, resolveChapter,
    handbook, sectionById, partSlug, partUrl, sectionUrl, lawUrl,
    precepts, sortedPrecepts, preceptUrl, findPrecept,
    cases, ERAS, eraSlug, caseUrl, isBlessing,
    notes, studyNotes, classNotes, captainNotes, encNotes, history, studyBooks, noteByTitle, studyFor, noteLabel,
    cited, uniqueCitations, linked, moments, commentary, openedBy, lexicon, topics,
  };
}
