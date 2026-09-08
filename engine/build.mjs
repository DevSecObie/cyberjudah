// The CyberJudah content engine.
//
//   node engine/build.mjs [--out dist] [--site https://cyberjudah.io] [--no-thumbs]
//
// Reads the vault (see library.mjs) and writes one framework-independent data set:
//
//   dist/api/**                 the library as JSON, one file per addressable thing
//   dist/search/*.json          browse feeds (classes, captains), topic labels, small indexes
//   dist/pagefind/**            a sharded full-text index any static page can query
//   dist/library.sqlite.gz      the same library as SQLite with FTS5 (import into D1, Turso, or query locally)
//   dist/img/{classes,captains} thumbnails pulled to our own origin
//   dist/classes/rss.xml, dist/captains/rss.xml, dist/study/{rss.xml,feed.json}
//   dist/llms.txt, dist/manifest.json
//
// Nothing here knows about the front end. Docusaurus, TanStack, Astro, a phone app: all read
// the same files. See engine/README.md for the contract.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import zlib from "node:zlib";
import Database from "better-sqlite3";
import * as pagefind from "pagefind";

import { loadLibrary, plain, VERDICT, versesOf, firstVerse } from "./library.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const OUT = path.resolve(ROOT, opt("out", "dist"));
const SITE = opt("site", "https://devsecobie.github.io/cyberjudah").replace(/\/$/, "");
const THUMBS = !args.includes("--no-thumbs");
const t0 = Date.now();

const write = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
const writeJson = (p, o) => write(p, JSON.stringify(o));
const xesc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const API = path.join(OUT, "api");
const SEARCH = path.join(OUT, "search");

const L = loadLibrary(ROOT);
const { BOOKS, CHAPTERS, bible, bookSlug, testament, chapterUrl, bookUrl, handbook, sectionUrl, partUrl, sortedPrecepts, preceptUrl, cases, ERAS, caseUrl, isBlessing, notes, classNotes, captainNotes, cited, uniqueCitations } = L;

/* ---------------- api: scripture and concordance ---------------- */
for (const b of BOOKS) {
  const chs = Object.keys(bible[b]).map(Number).sort((x, y) => x - y);
  for (const c of chs) {
    const verses = bible[b][String(c)] ?? [];
    writeJson(path.join(API, "kjv", bookSlug[b], `${c}.json`), { book: b, chapter: c, translation: "KJV", url: chapterUrl(b, c), verses: verses.map((t, i) => ({ verse: i + 1, text: t })).filter((v) => v.text) });
    // Emitted for every chapter, cited or not: an uncited chapter is an empty list, not a 404.
    writeJson(path.join(API, "concordance", bookSlug[b], `${c}.json`), { book: b, chapter: c, cited_by: uniqueCitations(cited.get(`${b}|${c}`) ?? []) });
  }
  writeJson(path.join(API, "kjv", bookSlug[b], "index.json"), { book: b, slug: bookSlug[b], testament: testament(b), chapters: CHAPTERS[b], verses: chs.reduce((a, c) => a + (bible[b][String(c)] ?? []).filter(Boolean).length, 0), chapterIds: chs });
}
writeJson(path.join(API, "kjv", "books.json"), L.bibleIndex.map((e) => ({ ...e, testament: testament(e.book), url: bookUrl(e.book), chapterIds: Object.keys(bible[e.book]).map(Number).sort((a, b) => a - b) })));

/* ---------------- api: law, precepts, cases ---------------- */
// A reference resolved for rendering: the chapter's slug and route, the study note that
// teaches the chapter, and the verses themselves (capped; `more` counts the rest), so a law
// section or a precept is one fetch for a front end.
const QUOTE_MAX = 12;
function resolveRef(r) {
  const slug = bookSlug[r.book];
  const chapter = bible[r.book]?.[String(r.chapter)] ?? [];
  const wanted = r.verses ? versesOf(r.verses) : chapter.map((_, i) => i + 1);
  const rows = wanted.filter((v) => chapter[v - 1]).map((v) => ({ verse: v, text: chapter[v - 1] }));
  const study = L.studyFor(r.book, r.chapter);
  return {
    ...r, slug: slug ?? null,
    url: slug ? `${chapterUrl(r.book, r.chapter)}${r.verses ? `#v${firstVerse(r.verses)}` : ""}` : null,
    label: `${r.book} ${r.chapter}${r.verses ? `:${r.verses}` : ""}`,
    study: study ? { range: study.range, url: study.url } : null,
    text: rows.slice(0, QUOTE_MAX), more: Math.max(0, rows.length - QUOTE_MAX),
  };
}
for (const p of handbook.parts) for (const s of p.sections)
  writeJson(path.join(API, "laws", `${s.id}.json`), { id: s.id, title: s.title, part: { n: p.n, title: p.title, url: partUrl(p) }, url: sectionUrl(s),
    seeAlso: (s.seeAlso ?? []).map((id) => { const o = L.sectionById[String(id).toUpperCase()]; return o ? { id: o.id, title: o.title, url: sectionUrl(o) } : { id, title: "", url: null }; }),
    entries: s.entries.map((e) => ({ id: `${s.id}.${e.n}`, text: e.text, refs: (e.refs ?? []).map(resolveRef), citation: e.citation })) });
writeJson(path.join(API, "laws", "index.json"), handbook.parts.map((p) => ({ n: p.n, title: p.title, url: partUrl(p), sections: p.sections.map((s) => ({ id: s.id, title: s.title, laws: s.entries.length, url: sectionUrl(s) })) })));
for (const t of sortedPrecepts) writeJson(path.join(API, "precepts", `${t.slug}.json`), { ...t, refs: t.refs.map(resolveRef), url: preceptUrl(t) });
writeJson(path.join(API, "precepts", "index.json"), sortedPrecepts.map((t) => ({ slug: t.slug, title: t.title, refs: t.refs.length, url: preceptUrl(t) })));
const seeAlsoEncyclopedia = (hay) => {
  const h = hay.toLowerCase();
  return L.lexicon.filter((l) => l.terms.some((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(h))).map((l) => L.noteByTitle.get(l.topic.toLowerCase())).filter(Boolean).map((n) => ({ title: n.title, url: n.url }));
};
for (const c of cases.cases) {
  const related = cases.cases.filter((o) => o !== c && isBlessing(o) === isBlessing(c) && o.themes.some((t) => c.themes.includes(t))).slice(0, 6).map((o) => ({ slug: o.slug, name: o.name, charge: o.charge, url: caseUrl(o) }));
  const taught = [...new Set(c.refs.map((r) => L.studyFor(r.book, r.chapter)).filter(Boolean))].map((n) => ({ title: n.title, range: n.range, url: n.url }));
  const laws = c.laws.map((l) => { const [sid, n] = l.split("."); const s = L.sectionById[sid]; const en = s && n ? s.entries[+n - 1] : null; return { id: l, text: en ? en.text : s ? `${s.title} (section)` : "", url: L.lawUrl(l) }; });
  const precepts = c.topics.map((t) => { const p = L.findPrecept(t); return p ? { slug: p.slug, title: p.title, url: preceptUrl(p) } : { slug: t, title: t, url: null }; });
  const see = seeAlsoEncyclopedia(`${c.charge} ${c.summary} ${c.themes.join(" ")} ${c.topics.join(" ")}`);
  writeJson(path.join(API, "cases", `${c.slug}.json`), { ...c, url: caseUrl(c), kind: c.kind ?? "judgment", verdictLabel: VERDICT[c.verdict] ?? c.verdict, related, taught, lawsResolved: laws, preceptsResolved: precepts, refsResolved: c.refs.map(resolveRef), see });
}
writeJson(path.join(API, "cases", "index.json"), { eras: ERAS, verdicts: cases.verdicts, cases: cases.cases.map((c) => ({ slug: c.slug, name: c.name, era: c.era, kind: c.kind ?? "judgment", charge: c.charge, verdict: c.verdict, url: caseUrl(c), themes: c.themes ?? [], topics: c.topics ?? [] })) });

/* ---------------- api: the concordance as a whole ---------------- */
// One row per citing document per chapter (the per-chapter files keep one row per passage).
const mergeRows = (rows) => {
  const out = new Map();
  for (const r of uniqueCitations(rows)) {
    const k = `${r.kind}|${r.url}`;
    if (!out.has(k)) out.set(k, { kind: r.kind, label: r.label, url: r.url, verses: [] });
    if (r.verses && !out.get(k).verses.includes(r.verses)) out.get(k).verses.push(r.verses);
  }
  return [...out.values()];
};
const concordanceIndex = [];
for (const b of BOOKS) {
  const chs = Object.keys(bible[b]).map(Number).sort((x, y) => x - y).filter((c) => (cited.get(`${b}|${c}`) ?? []).length);
  const chapters = chs.map((c) => ({ chapter: c, url: chapterUrl(b, c), cited_by: mergeRows(cited.get(`${b}|${c}`)) }));
  const citations = chapters.reduce((a, c) => a + c.cited_by.length, 0);
  writeJson(path.join(API, "concordance", `${bookSlug[b]}.json`), { book: b, slug: bookSlug[b], testament: testament(b), url: bookUrl(b), chapters: CHAPTERS[b], cited: chs, citations, chapterRows: chapters });
  concordanceIndex.push({ book: b, slug: bookSlug[b], testament: testament(b), url: bookUrl(b), chapters: CHAPTERS[b], cited: chs, citations });
}
writeJson(path.join(API, "concordance", "index.json"), concordanceIndex);

/* ---------------- api: encyclopedia, topics ---------------- */
writeJson(path.join(API, "encyclopedia", "index.json"), L.encNotes.map((n) => ({ slug: n.slug, title: n.title, url: n.url, summary: n.summary ?? "" })));
{
  // Every topic label with the notes and cases that carry it, so a topic page is one fetch.
  const topicRows = new Map();
  const add = (slugKey, row) => { if (!topicRows.has(slugKey)) topicRows.set(slugKey, []); topicRows.get(slugKey).push(row); };
  for (const n of [...classNotes, ...captainNotes]) for (const t of n.topics ?? []) add(t, { kind: n.kind === "captains" ? "captains" : "class", title: n.title, url: n.url, date: n.date ?? null, teacher: n.teacher ?? "" });
  for (const c of cases.cases) for (const t of [...(c.themes ?? []), `verdict-${c.verdict}`]) add(t, { kind: "case", title: c.name, url: caseUrl(c), charge: c.charge, verdict: c.verdict });
  const labelOf = new Map(L.topics.map((t) => [t.slug, t.label]));
  const pretty = (s) => labelOf.get(s) ?? (s.startsWith("verdict-") ? `Verdict: ${VERDICT[s.slice(8)] ?? s.slice(8)}` : s.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()));
  const index = [...topicRows.entries()].map(([slugKey, rows]) => ({ slug: slugKey, label: pretty(slugKey), notes: rows.filter((r) => r.kind !== "case").length, cases: rows.filter((r) => r.kind === "case").length, url: `/topics/${slugKey}` })).sort((a, b) => a.label.localeCompare(b.label));
  writeJson(path.join(API, "topics", "index.json"), index);
  for (const [slugKey, rows] of topicRows) writeJson(path.join(API, "topics", `${slugKey}.json`), { slug: slugKey, label: pretty(slugKey), url: `/topics/${slugKey}`, items: rows.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")) || a.title.localeCompare(b.title)) });
}

/* ---------------- downloads ---------------- */
{
  const vault = path.join(ROOT, "data", "downloads", "vault.zip");
  if (fs.existsSync(vault)) { fs.mkdirSync(path.join(OUT, "downloads"), { recursive: true }); fs.copyFileSync(vault, path.join(OUT, "downloads", "vault.zip")); }
}

/* ---------------- api: notes ---------------- */
writeJson(path.join(API, "notes", "index.json"), notes.map((n) => ({ kind: n.kind, title: n.title, url: n.url, book: n.book, chapters: n.chapters, range: n.range, date: n.date, year: n.year, series: n.series, teacher: n.teacher, topics: n.topics ?? [], summary: n.summary ?? n.description ?? "", videoId: n.videoId ?? null })));
for (const n of notes) {
  const rel = n.url.replace(/^\//, "") + ".json";
  writeJson(path.join(API, "notes", rel), { kind: n.kind, title: n.title, url: n.url, book: n.book ?? null, chapters: n.chapters ?? null, date: n.date ?? null, teacher: n.teacher ?? "", summary: n.summary ?? n.description ?? "", topics: n.topics ?? [], videoId: n.videoId ?? null, body: n.body });
}

/* ---------------- api: Our Hidden History ---------------- */
// The verbatim transcript, from the second the speakers begin, cut into speaker turns (">>"
// in the captions) and, within a long turn, into paragraphs at sentence ends. Every paragraph
// keeps the timestamp of its first caption, so the site can seek the recording to it.
function transcriptTurns(h) {
  const turns = [];
  let cur = null;
  const push = () => { if (cur && cur.text.trim()) turns.push({ t: cur.t, text: cur.text.replace(/\s+/g, " ").trim() }); cur = null; };
  for (const [t, raw] of h.segments) {
    if (t < (h.start ?? 0)) continue;
    let text = raw;
    if (/^>>/.test(text)) { push(); text = text.replace(/^>>\s*/, ""); }
    if (!cur) cur = { t, text: "" };
    // A paragraph ends at a sentence end past ~1100 characters; older caption tracks have no
    // punctuation at all, so past ~1600 it ends at the caption boundary regardless.
    if (cur.text.length > 1100 && (/[.!?]$/.test(cur.text.trim()) || cur.text.length > 1600)) { push(); cur = { t, text: "" }; }
    cur.text += (cur.text ? " " : "") + text.replace(/>>/g, "").trim();
  }
  push();
  // A one-word interjection ("Yeah.", "Right.") is not a turn worth its own line; it joins the
  // line before it. Speaker changes with something to say stay separate.
  const merged = [];
  for (const t of turns) {
    if (merged.length && t.text.length < 30) merged[merged.length - 1].text += " " + t.text;
    else merged.push({ ...t });
  }
  return merged;
}
const historyRows = L.history.map((h) => ({ slug: h.slug, title: h.title, url: h.url, episode: h.episode, date: h.date, year: h.year, duration: h.duration, views: h.views, videoId: h.videoId,
  thumb: `https://i.ytimg.com/vi/${h.videoId}/hqdefault.jpg`, words: h.words, teacher: h.teacher, topics: h.topics, noted: h.noted, summary: h.description }));
writeJson(path.join(API, "history", "index.json"), historyRows);
const historyTurns = new Map();
for (const h of L.history) {
  const turns = transcriptTurns(h);
  historyTurns.set(h.slug, turns);
  writeJson(path.join(API, "history", `${h.slug}.json`), { ...historyRows.find((r) => r.slug === h.slug), rawTitle: h.rawTitle, start: h.start, body: h.body || null, turns });
}
console.error(`history: ${L.history.length} episodes, ${L.history.filter((h) => h.noted).length} written up`);

/* ---------------- api: cross references, WEB parallel ---------------- */
for (const [file, dir] of [["crossrefs.json", "xref"], ["web-translation.json", "web"]]) {
  const p = path.join(L.DATA, file);
  if (!fs.existsSync(p)) continue;
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const [slug, chapters] of Object.entries(data)) for (const [c, verses] of Object.entries(chapters)) writeJson(path.join(API, dir, slug, `${c}.json`), verses);
}

/* ---------------- browse feeds with thumbnails and book weights ---------------- */
const latest = {};
const feedRowsByKind = {};
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
  const IMG = path.join(OUT, "img", feed.dir);
  fs.mkdirSync(IMG, { recursive: true });
  const localThumb = new Map();
  if (THUMBS) {
    const ids = [...new Set(feed.list.map((n) => n.videoId).filter(Boolean))];
    let got = 0, missed = 0;
    const pull = async (id) => {
      try {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), 10000);
        const res = await fetch(`https://i.ytimg.com/vi/${id}/mqdefault.jpg`, { signal: ac.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(String(res.status));
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 1000) throw new Error("too small");
        fs.writeFileSync(path.join(IMG, `${id}.jpg`), buf);
        localThumb.set(id, true); got++;
      } catch { missed++; }
    };
    for (let i = 0; i < ids.length; i += 8) await Promise.all(ids.slice(i, i + 8).map(pull));
    if (ids.length) console.error(`${feed.label} thumbnails: ${got} local, ${missed} falling back to i.ytimg.com`);
  }
  const rows = feed.list.map((n) => {
    const w = [...(weights.get(n.url) ?? new Map())].sort((a, b) => b[1] - a[1] || BOOKS.indexOf(a[0]) - BOOKS.indexOf(b[0]));
    const cut = Math.max(3, (w[0]?.[1] ?? 0) * 0.4);
    const id = n.videoId || "";
    return {
      title: n.title, url: n.url, date: n.date, year: n.year, teacher: n.teacher || "",
      thumb: !id ? "" : localThumb.get(id) ? `/img/${feed.dir}/${id}.jpg` : `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      books: w.filter(([, c]) => c >= cut).slice(0, 4).map(([b]) => b),
      allBooks: w.map(([b]) => b),
      topics: n.topics ?? [],
      estimated: !!n.dateEstimated,
      videoId: id || null,
    };
  });
  writeJson(path.join(SEARCH, feed.out), rows);
  feedRowsByKind[feed.label] = rows;
  latest[feed.label] = rows.map((r) => ({ kind: feed.label, title: r.title, url: r.url, date: r.date, teacher: r.teacher, thumb: r.thumb, books: r.books }));
}
writeJson(path.join(SEARCH, "topics.json"), L.topics);
writeJson(path.join(SEARCH, "books.json"), BOOKS.map((b) => ({ book: b, slug: bookSlug[b] })));
writeJson(path.join(SEARCH, "laws.json"), handbook.parts.flatMap((p) => p.sections.flatMap((s) => s.entries.map((e) => ({ id: `${s.id}.${e.n}`, text: e.text, url: `${sectionUrl(s)}#${s.id}.${e.n}` })))));
writeJson(path.join(SEARCH, "precepts.json"), sortedPrecepts.map((t) => ({ title: t.title, url: preceptUrl(t), n: t.refs.length })));
writeJson(path.join(SEARCH, "cases.json"), cases.cases.map((c) => ({ name: c.name, url: caseUrl(c), text: `${c.charge}. ${c.summary} ${c.offense} ${c.judgment}` })));

/* ---------------- classes by book ---------------- */
{
  const byBook = new Map();
  for (const [key, rows] of cited) {
    const [book, ch] = key.split("|");
    for (const r of uniqueCitations(rows)) {
      const kind = r.url.startsWith("/classes/") ? "class" : r.url.startsWith("/captains/") ? "captains" : null;
      if (!kind) continue;
      if (!byBook.has(book)) byBook.set(book, new Map());
      const m = byBook.get(book);
      if (!m.has(r.url)) m.set(r.url, { label: r.label, kind, chapters: new Set() });
      m.get(r.url).chapters.add(+ch);
    }
  }
  writeJson(path.join(API, "by-book.json"), BOOKS.filter((b) => byBook.has(b)).map((b) => ({
    book: b, slug: bookSlug[b], testament: testament(b),
    notes: [...byBook.get(b).entries()].map(([url, v]) => ({ url, label: v.label, kind: v.kind, chapters: [...v.chapters].sort((x, y) => x - y) })).sort((x, y) => x.chapters[0] - y.chapters[0] || x.label.localeCompare(y.label)),
  })));
}

/* ---------------- feeds ---------------- */
const rss = (title, link, description, items, lastBuild) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>\n  <title>${xesc(title)}</title>\n  <link>${xesc(link)}</link>\n  <description>${xesc(description)}</description>\n  <language>en</language>\n  <lastBuildDate>${new Date(lastBuild).toUTCString()}</lastBuildDate>\n${items}\n</channel></rss>\n`;
const item = (title, url, iso, description) => `  <item>\n    <title>${xesc(title)}</title>\n    <link>${xesc(url)}</link>\n    <guid isPermaLink="true">${xesc(url)}</guid>\n    <pubDate>${new Date(iso).toUTCString()}</pubDate>\n    <description>${xesc(description)}</description>\n  </item>`;
for (const [kind, list, name, label] of [["class", classNotes, "classes", "Sabbath class notes"], ["captains", captainNotes, "captains", "15 Minutes w/ The Captains"]]) {
  const recent = list.filter((n) => n.date).slice(0, 50);
  if (!recent.length) continue;
  write(path.join(OUT, name, "rss.xml"), rss(`CyberJudah · ${label}`, `${SITE}/${name}`, `${label}, newest first`,
    recent.map((n) => item(n.title, SITE + n.url, n.date, n.description || `${n.teacher || label} · ${n.date}`)).join("\n"), recent[0].date));
  writeJson(path.join(OUT, name, "feed.json"), { version: "https://jsonfeed.org/version/1.1", title: `CyberJudah · ${label}`, home_page_url: `${SITE}/${name}`, feed_url: `${SITE}/${name}/feed.json`,
    items: recent.map((n) => ({ id: SITE + n.url, url: SITE + n.url, title: n.title, summary: n.description || "", date_published: n.date, tags: n.topics ?? [] })) });
}
{
  // The study notes and encyclopedia are reference works ordered by book, not by date; the
  // date each entry carries is the commit that introduced its file. Needs full git history.
  const feedNotes = notes.filter((n) => n.kind === "study" || n.kind === "encyclopedia");
  let added = new Map();
  try {
    const log = execFileSync("git", ["log", "--reverse", "--pretty=format:%cI", "--name-only", "--diff-filter=A", "--", "docs/study", "docs/encyclopedia"],
      { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
    let when = null;
    for (const line of log.split("\n")) {
      if (!line.trim()) continue;
      if (/^\d{4}-\d\d-\d\dT/.test(line)) { when = line.trim(); continue; }
      if (when && !added.has(line.trim())) added.set(line.trim(), when);
    }
  } catch { added = new Map(); }
  const dated = feedNotes.map((n) => ({ n, iso: n.added || added.get(n.file) })).filter((x) => x.iso).sort((a, b) => b.iso.localeCompare(a.iso));
  if (dated.length) {
    const recent = dated.slice(0, 50);
    write(path.join(OUT, "study", "rss.xml"), rss("CyberJudah · 4 Chapters a Day", `${SITE}/study`, "Notes from the daily reading, newest first",
      recent.map(({ n, iso }) => item(n.title, SITE + n.url, iso, n.kind === "study" ? `${n.range} · ${n.title}` : (n.summary || n.title))).join("\n"), recent[0].iso));
    writeJson(path.join(OUT, "study", "feed.json"), { version: "https://jsonfeed.org/version/1.1", title: "CyberJudah · 4 Chapters a Day", home_page_url: `${SITE}/study`, feed_url: `${SITE}/study/feed.json`,
      items: recent.map(({ n, iso }) => ({ id: SITE + n.url, url: SITE + n.url, title: n.title, summary: n.kind === "study" ? n.range : (n.summary || ""), date_published: iso })) });
    console.error(`study feed: ${recent.length} entries`);
  } else console.error("study feed: skipped (no per-file git history; is this a shallow clone?)");
}

/* ---------------- stats ---------------- */
const stats = {
  chapters: Object.values(CHAPTERS).reduce((a, b) => a + b, 0), books: BOOKS.length,
  verses: BOOKS.reduce((a, b) => a + Object.values(bible[b]).flat().filter(Boolean).length, 0),
  studies: notes.filter((n) => n.kind === "study").length, classes: classNotes.length, captains: captainNotes.length, encyclopedia: L.encNotes.length,
  laws: handbook.parts.reduce((a, p) => a + p.sections.reduce((x, s) => x + s.entries.length, 0), 0), sections: Object.keys(L.sectionById).length, parts: handbook.parts.length,
  history: L.history.length, historyHours: Math.round(L.history.reduce((a, h) => a + (h.duration ?? 0), 0) / 3600),
  precepts: sortedPrecepts.length, cases: cases.cases.filter((c) => !isBlessing(c)).length, blessings: cases.cases.filter(isBlessing).length, citedChapters: cited.size,
  recent: [...(latest.class ?? []), ...(latest.captains ?? [])].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 10),
};
writeJson(path.join(API, "stats.json"), stats);
writeJson(path.join(API, "index.json"), {
  kjv: "/api/kjv/books.json", chapter: "/api/kjv/<book-slug>/<chapter>.json", concordance: "/api/concordance/<book-slug>/<chapter>.json",
  notes: "/api/notes/index.json", note: "/api/notes/<site-path>.json", laws: "/api/laws/index.json", law: "/api/laws/<SECTION>.json",
  precepts: "/api/precepts/index.json", precept: "/api/precepts/<slug>.json", cases: "/api/cases/index.json", case: "/api/cases/<slug>.json",
  concordanceIndex: "/api/concordance/index.json", concordanceBook: "/api/concordance/<book-slug>.json", encyclopedia: "/api/encyclopedia/index.json",
  topics: "/api/topics/index.json", topic: "/api/topics/<slug>.json", byBook: "/api/by-book.json",
  history: "/api/history/index.json", episode: "/api/history/<slug>.json", xref: "/api/xref/<book-slug>/<chapter>.json", web: "/api/web/<book-slug>/<chapter>.json", stats: "/api/stats.json",
  search: { classes: "/search/classes.json", captains: "/search/captains.json", topics: "/search/topics.json", books: "/search/books.json", laws: "/search/laws.json", precepts: "/search/precepts.json", cases: "/search/cases.json", pagefind: "/pagefind/pagefind.js", sqlite: "/library.sqlite.gz" },
  downloads: { vault: "/downloads/vault.zip" },
  feeds: { classes: "/classes/rss.xml", captains: "/captains/rss.xml", study: "/study/rss.xml" },
});

/* ---------------- llms.txt ---------------- */
write(path.join(OUT, "llms.txt"), [
  "# CyberJudah", "",
  "> A King James Bible with the Apocrypha, cross-linked with the class notes, daily reading",
  "> notes, encyclopedia, handbook of Bible law, precepts and case studies taught from it.",
  "> Every chapter lists what cites it; every citation links back into the text.", "",
  `The Bible text is the public-domain King James Version (1769) with the Apocrypha, ${BOOKS.length} books, ${stats.chapters} chapters.`, "",
  "## Pages", "",
  `- [The Bible](${SITE}/bible): every chapter, with the notes, laws, precepts and cases that cite it`,
  `- [4 Chapters a Day](${SITE}/study): ${stats.studies} study notes on the daily reading, one page per chapter`,
  `- [Sabbath class notes](${SITE}/classes): ${stats.classes} classes`,
  `- [15 Minutes w/ The Captains](${SITE}/captains): ${stats.captains} episodes`,
  `- [Encyclopedia](${SITE}/encyclopedia): ${stats.encyclopedia} standing subjects gathered from the notes`,
  `- [The Law](${SITE}/law): a handbook of Bible law in ${stats.parts} parts, ${stats.laws} laws`,
  `- [Precepts](${SITE}/precepts): ${stats.precepts} precepts with their references`,
  `- [Case studies](${SITE}/cases): ${stats.cases} judgments recorded in scripture, and ${stats.blessings} who kept the law and were blessed`, "",
  "## Data", "",
  "Everything on the site is available as static JSON at the same versification as the pages.", "",
  `- [API index](${SITE}/api/index.json): every endpoint`,
  `- [Books](${SITE}/api/kjv/books.json), chapters at ${SITE}/api/kjv/<book-slug>/<chapter>.json`,
  `- [Notes index](${SITE}/api/notes/index.json): study, class, captains and encyclopedia notes`,
  `- Citations for a chapter: ${SITE}/api/concordance/<book-slug>/<chapter>.json`,
  `- [SQLite library with full-text search](${SITE}/library.sqlite.gz)`, "",
  "## Feeds", "",
  `- [Sabbath class notes](${SITE}/classes/rss.xml)`, `- [15 Minutes w/ The Captains](${SITE}/captains/rss.xml)`, `- [4 Chapters a Day](${SITE}/study/rss.xml)`, "",
].join("\n"));

/* ---------------- SQLite: the library as one queryable file ---------------- */
// Full-text tables use external content, so each text is stored once: the FTS index points
// back at the row it came from. Import into Cloudflare D1, Turso, or open it locally.
{
  const dbPath = path.join(OUT, "library.sqlite");
  const db = new Database(dbPath);
  db.pragma("journal_mode = MEMORY");
  db.exec(`
    CREATE TABLE books (n INTEGER PRIMARY KEY, book TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, testament TEXT NOT NULL, chapters INTEGER NOT NULL, verses INTEGER NOT NULL);
    CREATE TABLE verses (id INTEGER PRIMARY KEY, book_slug TEXT NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL, text TEXT NOT NULL, UNIQUE (book_slug, chapter, verse));
    CREATE TABLE notes (id INTEGER PRIMARY KEY, url TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, title TEXT NOT NULL, book TEXT, chapter_from INTEGER, chapter_to INTEGER, date TEXT, year TEXT, teacher TEXT, series TEXT, topics TEXT, summary TEXT, video_id TEXT, body TEXT NOT NULL, plain TEXT NOT NULL);
    CREATE TABLE laws (id INTEGER PRIMARY KEY, law TEXT NOT NULL UNIQUE, section TEXT NOT NULL, section_title TEXT NOT NULL, part INTEGER NOT NULL, part_title TEXT NOT NULL, text TEXT NOT NULL, citation TEXT, url TEXT NOT NULL);
    CREATE TABLE law_refs (law TEXT NOT NULL, book TEXT NOT NULL, chapter INTEGER NOT NULL, verses TEXT);
    CREATE TABLE precepts (slug TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL, refs INTEGER NOT NULL);
    CREATE TABLE precept_refs (slug TEXT NOT NULL, book TEXT NOT NULL, chapter INTEGER NOT NULL, verses TEXT, key INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE cases (id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, era TEXT NOT NULL, kind TEXT NOT NULL, charge TEXT NOT NULL, verdict TEXT NOT NULL, summary TEXT, offense TEXT, judgment TEXT, text TEXT NOT NULL, laws TEXT, topics TEXT, themes TEXT, url TEXT NOT NULL);
    CREATE TABLE case_refs (slug TEXT NOT NULL, book TEXT NOT NULL, chapter INTEGER NOT NULL, verses TEXT);
    CREATE TABLE citations (book TEXT NOT NULL, book_slug TEXT NOT NULL, chapter INTEGER NOT NULL, verses TEXT, kind TEXT NOT NULL, label TEXT NOT NULL, url TEXT NOT NULL);
    CREATE INDEX citations_chapter ON citations (book_slug, chapter);
    CREATE INDEX citations_url ON citations (url);
    CREATE VIRTUAL TABLE verses_fts USING fts5 (text, content='verses', content_rowid='id', tokenize='porter unicode61');
    CREATE VIRTUAL TABLE notes_fts USING fts5 (title, plain, content='notes', content_rowid='id', tokenize='porter unicode61');
    CREATE VIRTUAL TABLE laws_fts USING fts5 (text, content='laws', content_rowid='id', tokenize='porter unicode61');
    CREATE VIRTUAL TABLE cases_fts USING fts5 (name, text, content='cases', content_rowid='id', tokenize='porter unicode61');
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  const tx = db.transaction(() => {
    const iBook = db.prepare("INSERT INTO books VALUES (?,?,?,?,?,?)");
    const iVerse = db.prepare("INSERT INTO verses (book_slug, chapter, verse, text) VALUES (?,?,?,?)");
    L.bibleIndex.forEach((e, i) => {
      iBook.run(i + 1, e.book, e.slug, testament(e.book), e.chapters, e.verses);
      for (const [c, vs] of Object.entries(bible[e.book])) vs.forEach((t, vi) => { if (t) iVerse.run(e.slug, +c, vi + 1, t); });
    });
    const iNote = db.prepare("INSERT INTO notes (url, kind, title, book, chapter_from, chapter_to, date, year, teacher, series, topics, summary, video_id, body, plain) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    for (const n of notes) iNote.run(n.url, n.kind, n.title, n.book ?? null, n.chapters?.[0] ?? null, n.chapters?.[1] ?? null, n.date ?? null, n.year ?? null, n.teacher ?? null, n.series ?? null, JSON.stringify(n.topics ?? []), n.summary ?? n.description ?? null, n.videoId ?? null, n.body, plain(n.body));
    const iLaw = db.prepare("INSERT INTO laws (law, section, section_title, part, part_title, text, citation, url) VALUES (?,?,?,?,?,?,?,?)");
    const iLawR = db.prepare("INSERT INTO law_refs VALUES (?,?,?,?)");
    for (const p of handbook.parts) for (const s of p.sections) for (const e of s.entries) {
      const id = `${s.id}.${e.n}`;
      iLaw.run(id, s.id, s.title, p.n, p.title, e.text, e.citation ?? null, `${sectionUrl(s)}#${id}`);
      for (const r of e.refs ?? []) iLawR.run(id, r.book, r.chapter, r.verses ?? null);
    }
    const iPre = db.prepare("INSERT INTO precepts VALUES (?,?,?,?)");
    const iPreR = db.prepare("INSERT INTO precept_refs VALUES (?,?,?,?,?)");
    for (const t of sortedPrecepts) { iPre.run(t.slug, t.title, preceptUrl(t), t.refs.length); for (const r of t.refs) iPreR.run(t.slug, r.book, r.chapter, r.verses ?? null, r.key ? 1 : 0); }
    const iCase = db.prepare("INSERT INTO cases (slug, name, era, kind, charge, verdict, summary, offense, judgment, text, laws, topics, themes, url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    const iCaseR = db.prepare("INSERT INTO case_refs VALUES (?,?,?,?)");
    for (const c of cases.cases) {
      iCase.run(c.slug, c.name, c.era, c.kind ?? "judgment", c.charge, c.verdict, c.summary ?? null, c.offense ?? null, c.judgment ?? null, `${c.charge}. ${c.summary ?? ""} ${c.offense ?? ""} ${c.judgment ?? ""}`, JSON.stringify(c.laws ?? []), JSON.stringify(c.topics ?? []), JSON.stringify(c.themes ?? []), caseUrl(c));
      for (const r of c.refs) iCaseR.run(c.slug, r.book, r.chapter, r.verses ?? null);
    }
    const iCit = db.prepare("INSERT INTO citations VALUES (?,?,?,?,?,?,?)");
    for (const [key, rows] of cited) { const [book, ch] = key.split("|"); for (const r of uniqueCitations(rows)) iCit.run(book, bookSlug[book], +ch, r.verses || null, r.kind, r.label, r.url); }
    const iMeta = db.prepare("INSERT INTO meta VALUES (?,?)");
    iMeta.run("built", new Date().toISOString());
    iMeta.run("stats", JSON.stringify(stats));
    for (const t of ["verses_fts", "notes_fts", "laws_fts", "cases_fts"]) db.exec(`INSERT INTO ${t}(${t}) VALUES ('rebuild')`);
  });
  tx();
  db.exec("VACUUM");
  db.close();
  // Shipped gzipped: the raw file is over the per-file limit of the CDNs that front a git
  // branch, and every consumer that can open SQLite can gunzip first.
  const gz = zlib.gzipSync(fs.readFileSync(dbPath), { level: 9 });
  fs.writeFileSync(`${dbPath}.gz`, gz);
  console.error(`sqlite: ${(fs.statSync(dbPath).size / 1048576).toFixed(1)} MB, ${(gz.length / 1048576).toFixed(1)} MB gzipped`);
  fs.rmSync(dbPath);
}

/* ---------------- search.sql: the search index for Cloudflare D1 ---------------- */
// One FTS5 table the site queries server-side. Every verse is a row; notes are split at
// headings and paragraph breaks into pieces of a few KB so a statement stays small and a
// snippet lands near the match; laws, precepts and cases are one row each.
{
  const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const rows = [];
  const add = (kind, title, url, sub, text, meta = {}) => { if (text && text.trim()) rows.push([kind, title, url, sub ?? "", text.replace(/\s+/g, " ").trim(), meta.book ?? "", meta.chapter ?? 0]); };
  for (const b of BOOKS) for (const [c, vs] of Object.entries(bible[b])) vs.forEach((t, i) => { if (t) add("verse", `${b} ${c}:${i + 1}`, `/bible/${bookSlug[b]}/${c}#v${i + 1}`, "", t, { book: b, chapter: +c }); });
  const CHUNK = 5000;
  for (const n of notes) {
    // Split the markdown at headings first, then pack paragraphs up to CHUNK characters.
    let buf = "", head = "";
    const flush = () => { if (buf.trim()) add(n.kind, n.title, n.url, head, buf); buf = ""; };
    for (const part of n.body.split(/\n(?=#{2,3} )/)) {
      const hm = part.match(/^#{2,3} (.+)/);
      if (hm) { flush(); head = plain(hm[1]); }
      for (const raw of part.replace(/^#{2,3} .+\n?/, "").split(/\n{2,}/)) {
        const para = plain(raw);
        if (!para) continue;
        if (buf.length + para.length > CHUNK && buf) flush();
        buf += (buf ? " " : "") + para;
      }
    }
    flush();
  }
  for (const h of L.history) {
    // Transcript paragraphs pack into pieces of a few KB; the url carries the timestamp of the piece.
    let buf = "", at = null;
    const flushH = () => { if (buf.trim()) add("history", h.title, `${h.url}#t=${Math.floor(at ?? 0)}`, h.episode ? `EP ${h.episode}` : (h.date ?? ""), buf); buf = ""; at = null; };
    for (const turn of historyTurns.get(h.slug) ?? []) {
      if (buf.length + turn.text.length > CHUNK && buf) flushH();
      if (at === null) at = turn.t;
      buf += (buf ? " " : "") + turn.text;
    }
    flushH();
  }
  for (const p of handbook.parts) for (const sec of p.sections) for (const e of sec.entries) add("law", `${sec.id}.${e.n} ${e.text}`, `${sectionUrl(sec)}#${sec.id}.${e.n}`, `${sec.id} ${sec.title}`, `${e.text} ${e.citation ?? ""}`);
  for (const t of sortedPrecepts) add("precept", t.title, preceptUrl(t), `${t.refs.length} passages`, `${t.title} ${t.refs.map((r) => `${r.book} ${r.chapter}${r.verses ? ":" + r.verses : ""}`).join(", ")}`);
  for (const c of cases.cases) add("case", c.name, caseUrl(c), `${c.era} · ${VERDICT[c.verdict] ?? c.verdict}`, `${c.charge}. ${c.summary} ${c.offense} ${c.judgment} ${c.themes.join(" ")}`);
  const out = [
    "DROP TABLE IF EXISTS search_docs;",
    "CREATE VIRTUAL TABLE search_docs USING fts5(kind UNINDEXED, title, url UNINDEXED, sub UNINDEXED, text, book UNINDEXED, chapter UNINDEXED, tokenize='porter unicode61');",
  ];
  // Statements stay under ~60 KB (D1 caps a statement's size), packing rows until then.
  let stmt = [], size = 0;
  const flushStmt = () => { if (stmt.length) out.push(`INSERT INTO search_docs(kind, title, url, sub, text, book, chapter) VALUES ${stmt.join(",")};`); stmt = []; size = 0; };
  for (const r of rows) {
    const v = `(${q(r[0])},${q(r[1])},${q(r[2])},${q(r[3])},${q(r[4])},${q(r[5])},${r[6]})`;
    if (size + v.length > 60000) flushStmt();
    stmt.push(v); size += v.length;
  }
  flushStmt();
  out.push("DROP TABLE IF EXISTS search_meta;", "CREATE TABLE search_meta(k TEXT PRIMARY KEY, v TEXT);", `INSERT INTO search_meta VALUES ('built', ${q(new Date().toISOString())}), ('rows', ${rows.length});`);
  const sql = out.join("\n") + "\n";
  fs.writeFileSync(path.join(OUT, "search.sql.gz"), zlib.gzipSync(sql, { level: 9 }));
  console.error(`search.sql: ${rows.length} rows, ${(sql.length / 1048576).toFixed(1)} MB`);
}

/* ---------------- Pagefind: a static full-text index ---------------- */
{
  const records = [];
  for (const n of notes) records.push({ kind: n.kind, title: n.title, url: n.url, content: plain(n.body) });
  for (const b of BOOKS) for (const [c, vs] of Object.entries(bible[b]))
    records.push({ kind: "verse", title: `${b} ${c}`, url: `/bible/${bookSlug[b]}/${c}`, anchored: vs.map((t, i) => (t ? [`v${i + 1}`, `${b} ${c}:${i + 1}`, t] : null)).filter(Boolean) });
  for (const p of handbook.parts) for (const sec of p.sections)
    records.push({ kind: "law", title: `${sec.id} ${sec.title}`, url: sectionUrl(sec), anchored: sec.entries.map((e) => [`${sec.id}.${e.n}`, `${sec.id}.${e.n}`, e.text]) });
  for (const t of sortedPrecepts) records.push({ kind: "precept", title: t.title, url: preceptUrl(t), sub: `${t.refs.length} verses`, content: t.title });
  for (const h of L.history) records.push({ kind: "history", title: h.title, url: h.url, sub: h.episode ? `EP ${h.episode}` : (h.date ?? ""), content: (historyTurns.get(h.slug) ?? []).map((t) => t.text).join(" ") });
  for (const c of cases.cases) records.push({ kind: "case", title: c.name, url: caseUrl(c), content: `${c.charge}. ${c.summary} ${c.offense} ${c.judgment}` });

  const { index, errors: createErrors } = await pagefind.createIndex();
  if (createErrors?.length) { console.error(createErrors); process.exit(1); }
  for (const r of records) {
    let errors;
    if (r.anchored) {
      const body = r.anchored.map(([id, label, text]) => `<h6 id="${id}">${xesc(label)}</h6><p>${xesc(text)}</p>`).join("\n");
      const html = `<!DOCTYPE html><html lang="en"><body data-pagefind-body><span data-pagefind-meta="title">${xesc(r.title)}</span><span data-pagefind-meta="kind">${r.kind}</span><span data-pagefind-filter="kind">${r.kind}</span>${body}</body></html>`;
      ({ errors } = await index.addHTMLFile({ url: r.url, content: html }));
    } else {
      ({ errors } = await index.addCustomRecord({ url: r.url, content: `${r.title}. ${r.content}`, language: "en", meta: { title: r.title, kind: r.kind, ...(r.sub ? { sub: r.sub } : {}) }, filters: { kind: [r.kind] } }));
    }
    if (errors?.length) { console.error(r.url, errors); process.exit(1); }
  }
  const { errors: writeErrors } = await index.writeFiles({ outputPath: path.join(OUT, "pagefind") });
  if (writeErrors?.length) { console.error(writeErrors); process.exit(1); }
  await pagefind.close();
  console.error(`pagefind: ${records.length} records`);
}

/* ---------------- headers for hosts that honour a _headers file ---------------- */
// Cloudflare Workers static assets (and Pages, Netlify) read this. Everything is public
// and CORS-open; the API refreshes within five minutes of a build, the index and images
// are content-stable and can be held longer.
write(path.join(OUT, "_headers"), [
  "/*", "  Access-Control-Allow-Origin: *", "  Cache-Control: public, max-age=300", "  X-Content-Type-Options: nosniff", "",
  "/pointer.json", "  Cache-Control: public, max-age=60", "",
  "/manifest.json", "  Cache-Control: public, max-age=60", "",
  "/pagefind/*", "  Cache-Control: public, max-age=86400", "",
  "/img/*", "  Cache-Control: public, max-age=604800", "",
  "/library.sqlite.gz", "  Cache-Control: public, max-age=3600", "",
].join("\n"));

/* ---------------- manifest ---------------- */
let commit = null;
try { commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { /* not a checkout */ }
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(OUT);
writeJson(path.join(OUT, "manifest.json"), { built: new Date().toISOString(), commit, site: SITE, files: files.length, bytes: files.reduce((a, f) => a + fs.statSync(f).size, 0), stats });
console.error(`engine: ${files.length} files in ${path.relative(ROOT, OUT)} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
