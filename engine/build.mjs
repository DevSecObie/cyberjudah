import { validatePeople, personPicture } from "./people-validation.mjs";

import { correctedClass, classCatalog } from "./class-metadata.mjs";
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

import { fetchBoard, findVisuals, placeFrames } from "./frames.mjs";
import { teachingDate } from "./timeline.mjs";
import { strongsPages } from "./strongs-pages.mjs";
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
const { BOOKS, CHAPTERS, bible, bookSlug, testament, chapterUrl, bookUrl, handbook, sectionUrl, partUrl, sortedPrecepts, preceptUrl, cases, ERAS, caseUrl, isBlessing, notes, classNotes, captainNotes, cited, uniqueCitations, linked, moments, commentary } = L;

/* ---------------- people (STEPBible TIPNR, CC BY 4.0) ---------------- */
// Who is named in each verse, and a page per person: names, family, every verse, and what the
// classes taught where the person comes up (a comment on one of their verses naming them).
const peopleFile = path.join(ROOT, "data", "people", "people.json");
const peopleDoc = fs.existsSync(peopleFile) ? JSON.parse(fs.readFileSync(peopleFile, "utf8")) : { people: [] };
const peopleProblems = validatePeople(peopleDoc);
if (peopleProblems.length) throw new Error(peopleProblems.join("\n"));
const personById = new Map(peopleDoc.people.map((p) => [p.id, p]));
const namedIn = new Map(); // "slug|ch" -> { verse: [id] }
for (const p of peopleDoc.people) for (const ref of p.verses) {
  const [sl, ch, v] = ref.split("/"); const k = `${sl}|${ch}`;
  if (!namedIn.has(k)) namedIn.set(k, {}); (namedIn.get(k)[v] ??= []).push(p.id);
}
const bySlugName = Object.fromEntries(Object.entries(bookSlug).map(([b, sl]) => [sl, b]));

/* ---------------- Strong's: every King James word keyed to its Hebrew or Greek ---------------- */
// data/strongs (scripts/strongs/build.py): each verse of the 66 books as spans with Strong's
// numbers, and Strong's own dictionaries. Chapters carry the spans; each number gets a page
// with its entry and every verse it stands behind (the concordance).
const STRONGS = path.join(ROOT, "data", "strongs");
const strongsCache = new Map();
const strongsTags = (slug) => {
  if (!strongsCache.has(slug)) {
    const f = path.join(STRONGS, "tags", `${slug}.json`);
    strongsCache.set(slug, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null);
  }
  return strongsCache.get(slug);
};

/* ---------------- api: scripture and concordance ---------------- */
// Every moment a class read a verse aloud, straight from the transcripts
// (scripts/precepts/readings.py): per book, chapter and verse, [video, second]. A class with a
// note lends the note's title, date, teacher and url; the rest carry what the transcript says.
const READINGS = path.join(ROOT, "data", "precepts", "readings");
const readVideos = fs.existsSync(path.join(READINGS, "videos.json")) ? JSON.parse(fs.readFileSync(path.join(READINGS, "videos.json"), "utf8")) : {};
for (const [video, row] of Object.entries(readVideos)) readVideos[video] = correctedClass(row, L.classMetadata, video);
writeJson(path.join(API, "classes", "metadata.json"), classCatalog(readVideos, notes, L.classMetadata));
writeJson(path.join(API, "classes", "corrections.json"), Object.fromEntries(L.classMetadata));
const noteByVideo = new Map(L.notes.filter((n) => n.videoId).map((n) => [n.videoId, n]));
const hms = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`; };
const teacherRank = (t) => (/^bishop\b/i.test(t ?? "") ? 0 : /^deacon\b/i.test(t ?? "") ? 1 : 2);
function readingsOf(slug) {
  const f = path.join(READINGS, `${slug}.json`);
  if (!fs.existsSync(f)) return {};
  const raw = JSON.parse(fs.readFileSync(f, "utf8")), out = {};
  for (const [c, vs] of Object.entries(raw)) {
    out[c] = {};
    for (const [v, rows] of Object.entries(vs)) {
      out[c][v] = rows.map(([video, t]) => {
        const meta = readVideos[video] ?? {}, note = noteByVideo.get(video);
        return { video, t, ts: hms(t), title: note?.title || meta.title || "Class", date: note?.date || meta.date || "", teacher: note?.teacher || meta.teacher || "", ...(note ? { url: note.url } : {}) };
      }).sort((a, b) => teacherRank(a.teacher) - teacherRank(b.teacher) || (b.date || "").localeCompare(a.date || ""));
    }
  }
  return out;
}
let readingsTotal = 0;
for (const b of BOOKS) {
  const readings = readingsOf(bookSlug[b]);
  const chs = Object.keys(bible[b]).map(Number).sort((x, y) => x - y);
  for (const c of chs) {
    const verses = bible[b][String(c)] ?? [];
    const tags = strongsTags(bookSlug[b]);
    writeJson(path.join(API, "kjv", bookSlug[b], `${c}.json`), { book: b, chapter: c, translation: "KJV", url: chapterUrl(b, c), ...(c === chs[0] && L.prologues[b] ? { prologue: L.prologues[b] } : {}), verses: verses.map((t, i) => ({ verse: i + 1, text: t, ...(tags?.[String(c)]?.[String(i + 1)] ? { words: tags[String(c)][String(i + 1)] } : {}) })).filter((v) => v.text) });
    // Emitted for every chapter, cited or not: an uncited chapter is an empty list, not a 404.
    writeJson(path.join(API, "concordance", bookSlug[b], `${c}.json`), { book: b, chapter: c, cited_by: uniqueCitations(cited.get(`${b}|${c}`) ?? []), precepts: linked.get(`${b}|${c}`) ?? [], moments: moments.get(`${b}|${c}`) ?? [], commentary: commentary.get(`${b}|${c}`) ?? [], people: namedIn.get(`${bookSlug[b]}|${c}`) ?? {}, read: readings[String(c)] ?? {} });
    readingsTotal += Object.values(readings[String(c)] ?? {}).reduce((a, r) => a + r.length, 0);
  }
  writeJson(path.join(API, "kjv", bookSlug[b], "index.json"), { book: b, slug: bookSlug[b], testament: testament(b), chapters: CHAPTERS[b], verses: chs.reduce((a, c) => a + (bible[b][String(c)] ?? []).filter(Boolean).length, 0), chapterIds: chs });
}
if (readingsTotal) console.error(`readings: ${readingsTotal} verse readings from the transcripts placed on their verses`);
// The Greek of the Apocrypha (Swete's Septuagint, scripts/strongs/lxx.py), a chapter a file, for the Words tab of books Strong's does not cover.
const LXX = path.join(ROOT, "data", "lxx");
if (fs.existsSync(LXX)) {
  let n = 0;
  for (const f of fs.readdirSync(LXX).filter((x) => x.endsWith(".json") && x !== "sources.json")) {
    const slug = f.slice(0, -5), chs = JSON.parse(fs.readFileSync(path.join(LXX, f), "utf8"));
    for (const [c, vs] of Object.entries(chs)) { writeJson(path.join(API, "lxx", slug, `${c}.json`), { slug, chapter: +c, source: "Swete's Septuagint (1909)", verses: vs }); n += Object.keys(vs).length; }
  }
  console.error(`lxx: ${n} Greek verses of the Apocrypha`);
}
writeJson(path.join(API, "kjv", "books.json"), L.bibleIndex.map((e) => ({ ...e, testament: testament(e.book), url: bookUrl(e.book), chapterIds: Object.keys(bible[e.book]).map(Number).sort((a, b) => a - b) })));
if (fs.existsSync(path.join(STRONGS, "hebrew.json"))) {
  const dict = { ...JSON.parse(fs.readFileSync(path.join(STRONGS, "hebrew.json"), "utf8")), ...JSON.parse(fs.readFileSync(path.join(STRONGS, "greek.json"), "utf8")) };
  const occ = new Map(); // number -> [{ slug, book, chapter, verse, words }]
  const rendered = new Map(); // number -> Map(kjv word -> count)
  for (const b of BOOKS) {
    const tags = strongsTags(bookSlug[b]);
    if (!tags) continue;
    for (const [c, vs] of Object.entries(tags)) for (const [v, spans] of Object.entries(vs)) for (const [text, nums] of spans) {
      const word = text.replace(/[^A-Za-z' -]/g, "").trim();
      for (const n of nums) {
        if (!occ.has(n)) { occ.set(n, []); rendered.set(n, new Map()); }
        const list = occ.get(n);
        const last = list[list.length - 1];
        if (last && last.slug === bookSlug[b] && last.chapter === Number(c) && last.verse === Number(v)) last.words.push(word);
        else list.push({ slug: bookSlug[b], book: b, chapter: Number(c), verse: Number(v), words: [word] });
        rendered.get(n).set(word.toLowerCase(), (rendered.get(n).get(word.toLowerCase()) ?? 0) + 1);
      }
    }
  }
  const strongsIndex = [];
  for (const [n, e] of Object.entries(dict)) {
    const list = occ.get(n) ?? [];
    const count = list.reduce((a, o) => a + o.words.length, 0);
    const words = [...(rendered.get(n) ?? new Map()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w, k]) => ({ word: w, count: k }));
    const complete = list.map((o) => ({ slug: o.slug, book: o.book, chapter: o.chapter, verse: o.verse, text: bible[o.book]?.[String(o.chapter)]?.[o.verse - 1] ?? "", words: o.words }));
    const paged = strongsPages(n, complete);
    for (const page of paged.pages) writeJson(path.join(API, "strongs", n, "occurrences", paged.revision, `${page.page}.json`), page);
    writeJson(path.join(API, "strongs", `${n}.json`), {
      number: n, language: n[0] === "H" ? "Hebrew" : "Greek", ...e, count, verses: list.length, words,
      occurrences: paged.firstPage.occurrences,
      occurrencePages: { revision: paged.revision, pageSize: paged.pageSize, pages: paged.pages.length + 1, nextPage: paged.firstPage.nextPage },
      source: "Strong's Exhaustive Concordance (1890) and Concise Dictionaries (1894), public domain; JSON by Open Scriptures (CC BY-SA).",
    });
    strongsIndex.push({ n, lemma: e.lemma, xlit: e.xlit, def: (e.def || e.kjv || "").slice(0, 90), count });
  }
  writeJson(path.join(API, "strongs", "index.json"), strongsIndex);
  console.error(`strongs: ${strongsIndex.length} entries, ${[...occ.values()].reduce((a, l) => a + l.length, 0)} verse occurrences`);
}

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
for (const p of handbook.parts) for (const s of p.sections) {
  // Case cross-references for this law section
  const caseRefs = (s.caseRefs ?? []).map((cr) => {
    const c = cases.cases.find((x) => x.slug === cr.slug);
    return { slug: cr.slug, name: cr.name, charge: cr.charge, verdict: cr.verdict, url: c ? caseUrl(c) : null };
  });
  writeJson(path.join(API, "laws", `${s.id}.json`), { id: s.id, title: s.title, part: { n: p.n, title: p.title, url: partUrl(p) }, url: sectionUrl(s),
    seeAlso: (s.seeAlso ?? []).map((id) => { const o = L.sectionById[String(id).toUpperCase()]; return o ? { id: o.id, title: o.title, url: sectionUrl(o) } : { id, title: "", url: null }; }),
    entries: s.entries.map((e) => ({ id: `${s.id}.${e.n}`, text: e.text, refs: (e.refs ?? []).map(resolveRef), citation: e.citation })),
    ...(caseRefs.length ? { caseRefs } : {}) });
}
writeJson(path.join(API, "laws", "index.json"), handbook.parts.map((p) => ({ n: p.n, title: p.title, url: partUrl(p), sections: p.sections.map((s) => ({ id: s.id, title: s.title, laws: s.entries.length, url: sectionUrl(s) })) })));
for (const t of sortedPrecepts) writeJson(path.join(API, "precepts", `${t.slug}.json`), { ...t, refs: t.refs.map(resolveRef), url: preceptUrl(t) });
writeJson(path.join(API, "precepts", "index.json"), sortedPrecepts.map((t) => ({ slug: t.slug, title: t.title, refs: t.refs.length, url: preceptUrl(t) })));
const seeAlsoEncyclopedia = (hay) => {
  const h = hay.toLowerCase();
  return L.lexicon.filter((l) => l.terms.some((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(h))).map((l) => L.noteByTitle.get(l.topic.toLowerCase())).filter(Boolean).map((n) => ({ title: n.title, url: n.url }));
};
// Resolve refs for cases without the 12-verse cap
function resolveRefFull(r) {
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
    text: rows, more: 0,
  };
}
/* ---------------- the people in each case study ---------------- */
// A case study is linked to a person when its title names them and they are named in the case's
// own scripture (a chapter it reads): the title says who, the scripture says which of those so
// named, the one named in its very verses first.
const normName = (s) => s.replace(/[\u2010-\u2015]/g, "-").replace(/\u2019/g, "'");
const caseVerses = (c) => {
  const out = new Set();
  for (const r of c.refs) {
    const slug = bookSlug[r.book], chapter = bible[r.book]?.[String(r.chapter)];
    if (!slug || !chapter) continue;
    for (const v of r.verses ? versesOf(r.verses) : chapter.map((_, i) => i + 1)) out.add(`${slug}/${r.chapter}/${v}`);
  }
  return out;
};
// The patriarchs whose names became nations: in a title after Genesis, "Israel", "Judah", "Moab"
// are the people, not the man.
const EPONYMS = new Set(["Israel", "Judah", "Benjamin", "Levi", "Moab", "Amalek", "Esau"]);
const eponymous = (p) => EPONYMS.has(p.name) && p.verses[0]?.startsWith("genesis/");
const nameMatchers = new Map(); // name -> [regex, people]
for (const p of peopleDoc.people) for (const n of new Set([p.name, ...p.names])) {
  const k = normName(n);
  // A name as written, capital and all; not a people's name ("Hittite") but the person's own.
  if (k.length < 2 || !/^[A-Z]/.test(k) || (k !== p.name && /ites?$/.test(k))) continue;
  if (!nameMatchers.has(k)) nameMatchers.set(k, [new RegExp(`(?<![A-Za-z-])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z-])`), []]);
  nameMatchers.get(k)[1].push(p);
}
const peopleOfCase = new Map(), casesOfPerson = new Map();
for (const c of cases.cases) {
  const title = normName(c.name), verses = caseVerses(c), found = [];
  const chapters = new Set([...verses].map((v) => v.slice(0, v.lastIndexOf("/"))));
  const early = c.era === "Primeval" || c.era === "Patriarchal";
  for (const [, [re, people]] of nameMatchers) {
    const m = re.exec(title); if (!m) continue;
    // "Ahaziah of Israel", "the captivity of Judah": a realm; "son of Nebat" is still a man.
    const before = title.slice(0, m.index);
    if (/\bof $/.test(before) && !/\b(son|sons|daughter|daughters|wife|father|mother|brother|house) of $/i.test(before)) continue;
    let best = null, most = 0;
    for (const p of people) {
      if (eponymous(p) && !early) continue;
      const n = p.verses.reduce((a, v) => a + (verses.has(v) ? 1000 : 0) + (chapters.has(v.slice(0, v.lastIndexOf("/"))) ? 1 : 0), 0);
      if (n > most) { best = p; most = n; }
    }
    if (best && !found.some((f) => f.p.id === best.id)) found.push({ p: best, at: m.index });
  }
  found.sort((a, b) => a.at - b.at);
  peopleOfCase.set(c.slug, found.map(({ p }) => ({ id: p.id, name: p.name })));
  for (const { p } of found) (casesOfPerson.get(p.id) ?? casesOfPerson.set(p.id, []).get(p.id)).push(c);
}
const preview = (s = "") => { const t = s.replace(/\s+/g, " ").trim(); if (t.length <= 200) return t; const m = /^.{60,200}?[.;](?=\s)/.exec(t); return m ? m[0] : `${t.slice(0, 200).replace(/\s+\S*$/, "")}…`; };

for (const c of cases.cases) {
  // Prefer author-selected related cases from the HTML extraction, fall back to auto-computed
  const related = c.relatedCases?.length
    ? c.relatedCases.map((rc) => { const o = cases.cases.find((x) => x.slug === rc.slug); return o ? { slug: o.slug, name: o.name, charge: o.charge, url: caseUrl(o), desc: rc.desc } : { slug: rc.slug, name: rc.name, charge: rc.desc, url: null, desc: rc.desc }; })
    : cases.cases.filter((o) => o !== c && isBlessing(o) === isBlessing(c) && o.themes.some((t) => c.themes.includes(t))).slice(0, 6).map((o) => ({ slug: o.slug, name: o.name, charge: o.charge, url: caseUrl(o) }));
  const taught = [...new Set(c.refs.map((r) => L.studyFor(r.book, r.chapter)).filter(Boolean))].map((n) => ({ title: n.title, range: n.range, url: n.url }));
  const laws = c.laws.map((l) => { const [sid, n] = l.split("."); const s = L.sectionById[sid]; const en = s && n ? s.entries[+n - 1] : null; return { id: l, text: en ? en.text : s ? `${s.title} (section)` : "", url: L.lawUrl(l) }; });
  const precepts = c.topics.map((t) => { const p = L.findPrecept(t); return p ? { slug: p.slug, title: p.title, url: preceptUrl(p) } : { slug: t, title: t, url: null }; });
  const see = seeAlsoEncyclopedia(`${c.charge} ${c.summary} ${c.themes.join(" ")} ${c.topics.join(" ")}`);
  writeJson(path.join(API, "cases", `${c.slug}.json`), {
    ...c, url: caseUrl(c), kind: c.kind ?? "judgment", verdictLabel: VERDICT[c.verdict] ?? c.verdict,
    related, taught, lawsResolved: laws, preceptsResolved: precepts, people: peopleOfCase.get(c.slug) ?? [],
    // The date the teaching gives this case, if any (the Timeline shows no other).
    ...(teachingDate(c) ? { date: teachingDate(c) } : {}),
    refsResolved: c.refs.map(resolveRefFull), see,
    // Enriched fields (pass through if present)
    ...(c.code ? { code: c.code } : {}),
    ...(c.offenseFull ? { offenseFull: c.offenseFull } : {}),
    ...(c.judgmentFull ? { judgmentFull: c.judgmentFull } : {}),
    ...(c.alsoCited ? { alsoCited: c.alsoCited.map(resolveRef) } : {}),
    ...(c.studyContent ? { studyContent: c.studyContent } : {}),
    ...(c.teachingExcerpts ? { teachingExcerpts: c.teachingExcerpts } : {}),
  });
}
writeJson(path.join(API, "cases", "index.json"), { eras: ERAS, verdicts: cases.verdicts, cases: cases.cases.map((c) => ({ slug: c.slug, name: c.name, era: c.era, kind: c.kind ?? "judgment", charge: c.charge, verdict: c.verdict, url: caseUrl(c), themes: c.themes ?? [], topics: c.topics ?? [], ...(c.code ? { code: c.code } : {}), ...(teachingDate(c) ? { date: teachingDate(c).label } : {}) })) });

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

const personRef = (id) => { const p = personById.get(id); return p ? { id, name: p.name, ...personPicture(p) } : null; };
const peopleIndex = [];
for (const p of peopleDoc.people) {
  const words = new Set(p.names.map((n) => n.toLowerCase()));
  const taught = [];
  for (const ref of p.verses) {
    const [sl, ch, v] = ref.split("/"); const book = bySlugName[sl]; if (!book) continue;
    for (const c of commentary.get(`${book}|${ch}`) ?? []) {
      if (c.verses !== v) continue;
      const pts = c.points.filter((pt) => [...words].some((w) => new RegExp(`\\b${w.replace(/[^a-z]/g, "")}\\b`, "i").test(pt)));
      if (pts.length) taught.push({ verse: `${book} ${ch}:${v}`, url: `/bible/${sl}/${ch}#v${v}`, points: pts, note: c.note, ts: c.ts, video: c.video, t: c.t });
    }
  }
  writeJson(path.join(API, "people", `${p.id}.json`), {
    id: p.id, name: p.name, names: p.names, description: p.description, type: p.type, tribe: p.tribe, ...personPicture(p),
    father: p.father.map(personRef).filter(Boolean), mother: p.mother.map(personRef).filter(Boolean),
    siblings: p.siblings.map(personRef).filter(Boolean), partners: p.partners.map(personRef).filter(Boolean), children: p.children.map(personRef).filter(Boolean),
    verses: p.verses, taught, source: { name: peopleDoc.source, license: peopleDoc.license, url: peopleDoc.url },
    cases: (casesOfPerson.get(p.id) ?? []).map((c) => ({ slug: c.slug, name: c.name, url: caseUrl(c), era: c.era, kind: c.kind ?? "judgment", verdict: c.verdict, verdictLabel: VERDICT[c.verdict] ?? c.verdict, charge: c.charge, preview: preview(c.summary) })),
  });
  peopleIndex.push({ id: p.id, name: p.name, names: p.names, description: p.description, type: p.type, verses: p.verses.length, first: p.verses[0] });
}
writeJson(path.join(API, "people", "index.json"), peopleIndex);

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
  // The thread of a topic: every scripture the classes on it opened, in Bible order, each with
  // the classes that opened it (the recording at that second) and the precepts read with it.
  const threadOf = (rows) => {
    const stops = new Map();
    for (const r of rows) {
      if (r.kind === "case") continue;
      for (const p of L.openedBy.get(r.url) ?? []) {
        const k = `${p.book}|${p.chapter}|${p.verses}`;
        if (!stops.has(k)) { const first = p.verses ? Number(p.verses.split(/[-,]/)[0]) : 1; stops.set(k, { book: p.book, chapter: p.chapter, verses: p.verses, label: p.label, url: p.url, text: (bible[p.book]?.[String(p.chapter)]?.[first - 1] ?? "").slice(0, 220), classes: [], precepts: [] }); }
        const st = stops.get(k);
        if (!st.classes.some((c) => c.url === r.url && c.ts === p.ts)) st.classes.push({ title: r.title, url: r.url, date: r.date ?? "", teacher: p.teacher || r.teacher || "", ts: p.ts, video: p.video, t: p.t, points: p.points });
        for (const q of p.precepts) if (!st.precepts.some((x) => x.label === q.label)) st.precepts.push(q);
      }
    }
    const first = (v) => (v ? Number(v.split(/[-,]/)[0]) : 0);
    return [...stops.values()].map((st) => ({ ...st, classes: st.classes.sort((a, b) => teacherRank(a.teacher) - teacherRank(b.teacher) || String(b.date).localeCompare(String(a.date))) }))
      .sort((a, b) => (L.bookNum[a.book] ?? 99) - (L.bookNum[b.book] ?? 99) || a.chapter - b.chapter || first(a.verses) - first(b.verses));
  };
  for (const [slugKey, rows] of topicRows) writeJson(path.join(API, "topics", `${slugKey}.json`), { slug: slugKey, label: pretty(slugKey), url: `/topics/${slugKey}`, items: rows.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")) || a.title.localeCompare(b.title)), thread: threadOf(rows) });
}

/* ---------------- api: glossary ---------------- */
{
  // data/glossary.json: the terms the teachings use, each defined from the teachings and the
  // KJV. Every reference and moment is checked here, so a bad entry fails the build rather
  // than publishing a broken link.
  const file = path.join(ROOT, "data", "glossary.json");
  const glossary = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { entries: [] };
  const problems = [];
  const seen = new Set();
  const REF = /^(.+?) (\d+)(?::(\d+(?:-\d+)?))?$/;
  const entries = (glossary.entries ?? []).map((e) => {
    const where = e.term || "(untitled entry)";
    if (!e.term || !e.definition) problems.push(`${where}: needs a term and a definition`);
    const slug = e.slug || String(e.term).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (seen.has(slug)) problems.push(`${where}: slug ${slug} is used twice`);
    seen.add(slug);
    const scripture = (e.scripture ?? []).flatMap((label) => {
      const m = REF.exec(String(label).trim());
      const chapter = m ? bible[m[1]]?.[m[2]] : null;
      const verses = m?.[3] ? versesOf(m[3]) : [];
      if (!m || !bookSlug[m[1]] || !chapter || verses.some((v) => !chapter[v - 1])) { problems.push(`${where}: no such passage "${label}"`); return []; }
      return [{ label: String(label).trim(), url: `${chapterUrl(m[1], +m[2])}${m[3] ? `#v${firstVerse(m[3])}` : ""}` }];
    });
    const taught = (e.taught ?? []).flatMap((t) => {
      if (!/^[\w-]{11}$/.test(t.video ?? "") || !(Number(t.seconds) >= 0)) { problems.push(`${where}: bad moment ${JSON.stringify(t)}`); return []; }
      return [{ title: t.title ?? "", video: t.video, seconds: Math.floor(Number(t.seconds)), url: `https://www.youtube.com/watch?v=${t.video}&t=${Math.floor(Number(t.seconds))}s` }];
    });
    const see = (e.see ?? []).filter((s) => s && s.url && s.title);
    return { term: e.term, slug, aliases: e.aliases ?? [], definition: e.definition, scripture, see, taught, url: `/glossary#${slug}` };
  });
  if (problems.length) throw new Error(`data/glossary.json:\n  ${problems.join("\n  ")}`);
  entries.sort((a, b) => a.term.localeCompare(b.term, "en", { sensitivity: "base" }));
  writeJson(path.join(API, "glossary", "index.json"), { about: glossary.about ?? "", entries });
}

/* ---------------- downloads ---------------- */
{
  const vault = path.join(ROOT, "data", "downloads", "vault.zip");
  if (fs.existsSync(vault)) { fs.mkdirSync(path.join(OUT, "downloads"), { recursive: true }); fs.copyFileSync(vault, path.join(OUT, "downloads", "vault.zip")); }
}

/* ---------------- frames: what was on the screen, placed in the notes ---------------- */
// For every class or episode with a recording and a transcript, the captions say when the
// teacher pointed at the screen; the Worker's storyboard grid says where that frame sits.
if (THUMBS) {
  const withVideo = notes.filter((n) => (n.kind === "class" || n.kind === "captains") && n.videoId);
  const transcriptOf = (n) => { for (const d of ["blog", "captains"]) { const f = path.join(ROOT, d, "transcripts", `${n.videoId}.json`); if (fs.existsSync(f)) return f; } return null; };
  const jobs = withVideo.map((n) => ({ n, file: transcriptOf(n) })).filter((j) => j.file).map((j) => ({ ...j, visuals: findVisuals(JSON.parse(fs.readFileSync(j.file, "utf8")).segments ?? []) })).filter((j) => j.visuals.length);
  let placed = 0, figures = 0, noBoard = 0;
  const one = async (j) => {
    const board = await fetchBoard(j.n.videoId);
    if (!board) { noBoard++; return; }
    const body = placeFrames(j.n.body, j.n.videoId, board, j.visuals);
    if (body !== j.n.body) { j.n.body = body; placed++; figures += j.visuals.length; }
  };
  for (let i = 0; i < jobs.length; i += 8) await Promise.all(jobs.slice(i, i + 8).map(one));
  console.error(`frames: ${placed} notes with ${figures} frames placed, ${noBoard} recordings without frames yet (${jobs.length} with screen moments)`);
}

/* ---------------- api: library (public-domain books the classes read from) ---------------- */
// data/library/<slug>/: book.json, pages.json, figures/ and reads.json (scripts/library/).
// Each book gets its contents, its chapters page by page, its pictures (fold-out maps, plates,
// pages with figures), and every class moment where it was read, linked to that class's note
// when there is one.
const LIB = path.join(ROOT, "data", "library");
const libraryIndex = [];
const bookSearchRows = []; // [title, url, sub, text] per page, for search.sql
const booksReadIn = new Map(); // videoId -> [{ slug, title, vol, page, t, ts }]
const booksByNote = new Map(); // note url -> the same, for notes found by their artwork
if (fs.existsSync(LIB)) {
  // A note names its video in data-video-id, or only (lowercased) in its class artwork's file name.
  for (const [video, row] of Object.entries(readVideos)) readVideos[video] = correctedClass(row, L.classMetadata, video);
writeJson(path.join(API, "classes", "metadata.json"), classCatalog(readVideos, notes, L.classMetadata));
writeJson(path.join(API, "classes", "corrections.json"), Object.fromEntries(L.classMetadata));
const noteByVideo = new Map();
  for (const n of notes) {
    if (n.videoId) noteByVideo.set(n.videoId.toLowerCase(), n);
    const art = /\/class-images\/class-([a-z0-9_-]{11})\.jpg/.exec(n.body ?? "")?.[1];
    if (art && !noteByVideo.has(art)) noteByVideo.set(art, n);
  }
  for (const h of L.history) if (h.noted && h.videoId && !noteByVideo.has(h.videoId.toLowerCase())) noteByVideo.set(h.videoId.toLowerCase(), h);
  const transcript = (v) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "blog", "transcripts", `${v}.json`), "utf8")); } catch { return {}; } };
  for (const slug of fs.readdirSync(LIB).sort()) {
    const dir = path.join(LIB, slug);
    if (!fs.existsSync(path.join(dir, "book.json"))) continue;
    let book, pages, readsRaw;
    try {
      book = JSON.parse(fs.readFileSync(path.join(dir, "book.json"), "utf8"));
      pages = fs.readdirSync(dir).filter((f) => f === "pages.json" || /^pages-v\d+\.json$/.test(f)).sort((a, b) => a.length - b.length || a.localeCompare(b)).flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
      readsRaw = fs.existsSync(path.join(dir, "reads.json")) ? JSON.parse(fs.readFileSync(path.join(dir, "reads.json"), "utf8")).reads : [];
    } catch (e) { console.error(`library: ${slug} skipped (${e.message})`); continue; }
    // What the class said as it read: the recording's words from just before the reading to
    // two and a half minutes after, or until the class turned to another page of the book.
    const said = (r, all) => {
      const t = transcript(r.video), segs = t.segments ?? [];
      const next = all.filter((x) => x.video === r.video && x.t > r.t && !(x.vol === r.vol && x.page === r.page)).map((x) => x.t).sort((a, b) => a - b)[0];
      const end = Math.max(r.t + 45, Math.min(r.t + 150, next ? next - 2 : Infinity));
      return segs.filter((s) => s[0] >= r.t - 12 && s[0] <= end).slice(0, 60).map((s) => ({ t: Math.round(s[0]), text: String(s[1]).replace(/\s+/g, " ").trim() })).filter((s) => s.text);
    };
    const reads = readsRaw.map((r) => {
      const n = noteByVideo.get(r.video.toLowerCase()), t = n ? null : transcript(r.video);
      return { video: r.video, vol: r.vol ?? 1, page: r.page, t: r.t, ts: r.ts, title: n?.title ?? t.title ?? "", date: n?.date ?? t.date ?? null, teacher: n?.teacher ?? "", url: n?.url ?? null, said: said(r, readsRaw) };
    }).sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")) || a.t - b.t);
    for (const r of reads) {
      const row = { slug, title: book.title, vol: r.vol, page: r.page, t: r.t, ts: r.ts, video: r.video };
      if (!booksReadIn.has(r.video)) booksReadIn.set(r.video, []);
      booksReadIn.get(r.video).push(row);
      if (r.url) { if (!booksByNote.has(r.url)) booksByNote.set(r.url, []); booksByNote.get(r.url).push(row); }
    }
    const same = (a, b) => a.vol === b.vol && a.page === b.page;
    const inChapter = (c, x) => x.vol === c.vol && x.page >= c.page && x.page <= c.end;
    const readsOn = (p) => reads.filter((r) => same(r, p)).map(({ video, t, ts, title, date, teacher, url, said }) => ({ video, t, ts, title, date, teacher, url, said }));
    const chapters = book.chapters.map((c, k) => ({ k, ...c, reads: reads.filter((r) => inChapter(c, r)).length }));
    const figures = (book.figures ?? []).map((f) => ({ ...f, url: `/api/library/${slug}/${f.file}`, chapter: chapters.findIndex((c) => f.page != null && inChapter(c, f)), reads: reads.filter((r) => r.vol === f.vol && (r.page === f.page || r.page === f.page + 1)).length, readings: reads.filter((r) => r.vol === f.vol && (r.page === f.page || r.page === f.page + 1)).map(({ video, t, ts, title, date, teacher, url, said }) => ({ video, t, ts, title, date, teacher, url, said })) }));
    const figByImg = new Map(figures.filter((f) => f.kind !== "foldout").map((f) => [`${f.vol}/${f.img}`, f.url]));
    chapters.forEach((c) => writeJson(path.join(API, "library", slug, "chapter", `${c.k}.json`), {
      ...c, item: book.items?.[c.vol - 1]?.id ?? null,
      pages: pages.filter((p) => inChapter(c, p)).map((p) => ({ ...p, reads: readsOn(p), figure: figByImg.get(`${p.vol}/${p.img}`) ?? null, foldout: figures.find((f) => f.kind === "foldout" && f.vol === p.vol && f.page === p.page) ?? null })),
    }));
    fs.mkdirSync(path.join(API, "library", slug, "figures"), { recursive: true });
    if (fs.existsSync(path.join(dir, "figures"))) for (const f of fs.readdirSync(path.join(dir, "figures"))) fs.copyFileSync(path.join(dir, "figures", f), path.join(API, "library", slug, "figures", f));
    for (const p of pages) { const c = chapters.find((x) => inChapter(x, p)); bookSearchRows.push([book.title, `/books/${slug}/p/${p.vol}-${p.page}`, `${book.volumes > 1 ? `vol. ${p.vol}, ` : ""}p. ${p.page}${c?.title ? ` · ${c.title}` : ""}`, p.text]); }
    const classes = new Set(reads.map((r) => r.video)).size;
    const cover = book.cover ? `/api/library/${slug}/${book.cover}` : figures[0]?.url ?? null;
    writeJson(path.join(API, "library", slug, "book.json"), { ...book, cover, chapters, figures, reads: reads.map(({ said, ...r }) => r), classes });
    libraryIndex.push({ slug, title: book.title, subtitle: book.subtitle, author: book.author, year: book.year, pages: book.pages, volumes: book.volumes ?? 1, chapters: chapters.length, figures: figures.length, cover, reads: reads.length, classes });
  }
}
writeJson(path.join(API, "library", "index.json"), libraryIndex);
console.error(`library: ${libraryIndex.length} book(s), ${libraryIndex.reduce((a, b) => a + b.reads, 0)} class readings, ${libraryIndex.reduce((a, b) => a + b.figures, 0)} pictures`);

/* ---------------- api: notes ---------------- */
writeJson(path.join(API, "notes", "index.json"), notes.map((n) => ({ kind: n.kind, title: n.title, url: n.url, book: n.book, chapters: n.chapters, range: n.range, date: n.date, year: n.year, series: n.series, teacher: n.teacher, topics: n.topics ?? [], summary: n.summary ?? n.description ?? "", videoId: n.videoId ?? null })));
for (const n of notes) {
  const rel = n.url.replace(/^\//, "") + ".json";
  writeJson(path.join(API, "notes", rel), { kind: n.kind, title: n.title, url: n.url, file: n.file ?? null, book: n.book ?? null, chapters: n.chapters ?? null, date: n.date ?? null, teacher: n.teacher ?? "", summary: n.summary ?? n.description ?? "", topics: n.topics ?? [], videoId: n.videoId ?? null, books: booksReadIn.get(n.videoId ?? "") ?? booksByNote.get(n.url) ?? [], body: n.body });
}

/* ---------------- api: Our Hidden History ---------------- */
// Only episodes that have been written up exist as far as the data set is concerned. The
// raw transcripts in history/transcripts are the backlog the notes are written from and
// are never published; an episode page carries the note and the recording, nothing else.
const historyRows = L.history.filter((h) => h.noted).map((h) => ({ slug: h.slug, title: h.title, url: h.url, episode: h.episode, date: h.date, year: h.year, duration: h.duration, videoId: h.videoId,
  thumb: `https://i.ytimg.com/vi/${h.videoId}/hqdefault.jpg`, teacher: h.teacher, topics: h.topics, summary: h.description, intro: introOf(h.body) }));
writeJson(path.join(API, "history", "index.json"), historyRows);
console.error(`history: ${historyRows.length} episodes written up, ${L.history.length - historyRows.length} transcripts in the backlog`);

/* ---------------- api: cross references, WEB parallel ---------------- */
for (const [file, dir] of [["crossrefs.json", "xref"], ["web-translation.json", "web"]]) {
  const p = path.join(L.DATA, file);
  if (!fs.existsSync(p)) continue;
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const [slug, chapters] of Object.entries(data)) for (const [c, verses] of Object.entries(chapters)) writeJson(path.join(API, dir, slug, `${c}.json`), verses);
}

/* ---------------- browse feeds with thumbnails and book weights ---------------- */
// A note's opening ("## Introduction"), as plain text for a feed preview: its timestamps, links
// and emphasis taken out, the words kept whole, cut at a word near 600 characters; the app links
// to the full note.
function introOf(body) {
  const m = /^## Introduction[ \t]*\n([\s\S]*?)(?=\n## |\n<!--|(?![\s\S]))/m.exec(body ?? "");
  if (!m) return "";
  const text = m[1]
    .replace(/^>\s?/gm, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\*?\[\[\d+(?::\d+){1,2}\]\([^)]*\)\]\*?/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]+/g, "")
    .replace(/\s+/g, " ").trim();
  if (text.length <= 600) return text;
  return text.slice(0, 600).replace(/\s+\S*$/, "") + "…";
}
// The chapters a note says its class opened (its "Opens" line), in the class's order.
function opensOf(body) {
  const line = /<span class="opens">([\s\S]*?)<\/span>/.exec(body ?? "")?.[1] ?? "";
  return [...line.matchAll(/\[([^\]]+)\]\(\/bible\/([a-z0-9-]+)\/(\d+)\)/g)].map(([, label, slug, ch]) => ({ label, slug, chapter: +ch }));
}
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
      title: n.title, url: n.url, date: n.date, year: n.year, teacher: n.teacher || "", collection: n.collection || "",
      thumb: !id ? "" : localThumb.get(id) ? `/img/${feed.dir}/${id}.jpg` : `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      books: w.filter(([, c]) => c >= cut).slice(0, 4).map(([b]) => b),
      allBooks: w.map(([b]) => b),
      topics: n.topics ?? [],
      estimated: !!n.dateEstimated,
      videoId: id || null,
      intro: introOf(n.body),
      opens: opensOf(n.body),
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
writeJson(path.join(SEARCH, "cases.json"), cases.cases.map((c) => {
  const narrative = c.offenseFull?.length > 1 ? c.offenseFull.join(" ") + " " + (c.judgmentFull || []).join(" ") : `${c.offense} ${c.judgment}`;
  return { name: c.name, url: caseUrl(c), text: `${c.charge}. ${c.summary} ${narrative}` };
}));

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
  history: L.history.filter((h) => h.noted).length, historyHours: Math.round(L.history.filter((h) => h.noted).reduce((a, h) => a + (h.duration ?? 0), 0) / 3600),
  precepts: sortedPrecepts.length, cases: cases.cases.filter((c) => !isBlessing(c)).length, blessings: cases.cases.filter(isBlessing).length, citedChapters: cited.size,
  recent: [...(latest.class ?? []), ...(latest.captains ?? [])].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 10),
  // What landed lately, so the app can show the library growing: precept passes and books by the
  // day they were added to the repository, and the newest class notes.
  whatsNew: (() => {
    const added = (p) => { try { return execFileSync("git", ["log", "-1", "--format=%cs", "--diff-filter=A", "--", p], { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return ""; } };
    const rows = [];
    const passDir = path.join(ROOT, "data", "precepts", "classes");
    if (fs.existsSync(passDir)) for (const f of fs.readdirSync(passDir).filter((x) => x.endsWith(".json"))) {
      const d = JSON.parse(fs.readFileSync(path.join(passDir, f), "utf8")); const note = noteByVideo.get(d.video);
      rows.push({ kind: "pass", title: d.title, url: note ? note.url : `/watch/${d.video}`, date: added(path.join(passDir, f)) || d.date || "", teacher: d.teacher || "", sub: `${d.passages.reduce((a, p) => a + p.precepts.length, 0)} precepts under ${d.passages.length} scriptures` });
    }
    for (const b of libraryIndex) rows.push({ kind: "book", title: b.title, url: `/books/${b.slug}`, date: added(path.join(ROOT, "data", "library", b.slug, "book.json")), teacher: "", sub: [b.author, b.year].filter(Boolean).join(", ") });
    for (const n of [...(latest.class ?? []), ...(latest.captains ?? [])].slice(0, 6)) rows.push({ kind: n.kind === "captains" ? "captains" : "class", title: n.title, url: n.url, date: n.date, teacher: n.teacher || "", sub: "" });
    // Passes stay out of the twelve: the app does not list them, so counting them here pushed books and
    // classes off Home whenever a few passes landed together.
    return rows.filter((r) => r.date && r.kind !== "pass").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  })(),
};
writeJson(path.join(API, "stats.json"), stats);
writeJson(path.join(API, "index.json"), {
  kjv: "/api/kjv/books.json", chapter: "/api/kjv/<book-slug>/<chapter>.json", concordance: "/api/concordance/<book-slug>/<chapter>.json",
  notes: "/api/notes/index.json", note: "/api/notes/<site-path>.json", laws: "/api/laws/index.json", law: "/api/laws/<SECTION>.json",
  precepts: "/api/precepts/index.json", precept: "/api/precepts/<slug>.json", cases: "/api/cases/index.json", case: "/api/cases/<slug>.json",
  concordanceIndex: "/api/concordance/index.json", glossary: "/api/glossary/index.json", concordanceBook: "/api/concordance/<book-slug>.json", encyclopedia: "/api/encyclopedia/index.json",
  topics: "/api/topics/index.json", topic: "/api/topics/<slug>.json", byBook: "/api/by-book.json",
  history: "/api/history/index.json", strongs: "/api/strongs/<number>.json", strongsIndex: "/api/strongs/index.json", library: "/api/library/index.json", libraryBook: "/api/library/<slug>/book.json", libraryChapter: "/api/library/<slug>/chapter/<k>.json", xref: "/api/xref/<book-slug>/<chapter>.json", web: "/api/web/<book-slug>/<chapter>.json", stats: "/api/stats.json",
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
  for (const p of handbook.parts) for (const sec of p.sections) for (const e of sec.entries) add("law", `${sec.id}.${e.n} ${e.text}`, `${sectionUrl(sec)}#${sec.id}.${e.n}`, `${sec.id} ${sec.title}`, `${e.text} ${e.citation ?? ""}`);
  for (const t of sortedPrecepts) add("precept", t.title, preceptUrl(t), `${t.refs.length} passages`, `${t.title} ${t.refs.map((r) => `${r.book} ${r.chapter}${r.verses ? ":" + r.verses : ""}`).join(", ")}`);
  for (const [title, url, sub, text] of bookSearchRows) add("book", title, url, sub, text);
  for (const c of cases.cases) {
    const narrative = c.offenseFull?.length > 1 ? c.offenseFull.join(" ") + " " + (c.judgmentFull || []).join(" ") : `${c.offense} ${c.judgment}`;
    add("case", c.name, caseUrl(c), `${c.era} · ${VERDICT[c.verdict] ?? c.verdict}`, `${c.charge}. ${c.summary} ${narrative} ${c.themes.join(" ")}`);
  }
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
  const gz = zlib.gzipSync(sql, { level: 9 });
  fs.writeFileSync(path.join(OUT, "search.sql.gz"), gz);
  // The whole index is past the 25 MiB a Workers static asset may be, so it is also written
  // in parts under search-index/, each under 20 MiB gzipped and each valid SQL on its own, to be
  // run in order (the first creates the table, the last writes search_meta); search-index/parts.json
  // lists them. (search/ is taken: the site's search feeds live there.) The whole file stays for the data branch and the D1 load here, but is kept
  // out of the assets upload by .assetsignore.
  const PART_MAX = 20 * 1048576, ratio = gz.length / sql.length, target = Math.floor((PART_MAX * 0.9) / ratio);
  fs.rmSync(path.join(OUT, "search-index"), { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, "search-index"), { recursive: true });
  const parts = [];
  let chunk = [], chunkSize = 0;
  const flushPart = () => {
    if (!chunk.length) return;
    let body = zlib.gzipSync(chunk.join("\n") + "\n", { level: 9 });
    if (body.length > PART_MAX) throw new Error(`search part ${parts.length + 1} is ${body.length} bytes gzipped, over the ${PART_MAX} limit`);
    const name = `${String(parts.length + 1).padStart(2, "0")}.sql.gz`;
    fs.writeFileSync(path.join(OUT, "search-index", name), body);
    parts.push({ file: name, bytes: body.length, statements: chunk.length });
    chunk = []; chunkSize = 0;
  };
  for (const st of out) { if (chunkSize + st.length > target && chunk.length) flushPart(); chunk.push(st); chunkSize += st.length; }
  flushPart();
  writeJson(path.join(OUT, "search-index", "parts.json"), { built: new Date().toISOString(), rows: rows.length, sql_bytes: sql.length, parts });
  write(path.join(OUT, ".assetsignore"), "# Over the 25 MiB Workers asset limit; served in parts from search-index/ instead.\nsearch.sql.gz\n");
  console.error(`search.sql: ${rows.length} rows, ${(sql.length / 1048576).toFixed(1)} MB, ${(gz.length / 1048576).toFixed(1)} MB gzipped, in ${parts.length} parts`);
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
