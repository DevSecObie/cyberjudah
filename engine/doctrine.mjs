import fs from "node:fs";
import path from "node:path";

// The Doctrine section (data/doctrine.json): each false doctrine answered from scripture and the
// classes. An answer is not written here: it points at a breakdown a merged precept pass already
// holds (data/precepts/classes/<video>.json): the passage it sits under, the verse ("v12") or
// precept ("Hosea 1:10-11") it explains, and the first words of each paragraph to take. The
// teacher's words, the teacher and the moment come from that pass, so nothing in this section
// can say what a class did not.

// Book names a pass may use that the Bible data files under another name.
const BOOK_ALIAS = { Ecclesiasticus: "Sirach" };

const hmsToSeconds = (ts) => String(ts).split(":").reduce((a, x) => a * 60 + Number(x), 0);

/** "Jeremiah 10:1-5" → { book: "Jeremiah", chapter: 10, verses: "1-5" } (null when it is not a reference). */
export function splitRef(ref) {
  const m = /^(.+?) (\d+):([\d,\- ]+)$/.exec(String(ref).trim());
  if (!m) return null;
  return { book: BOOK_ALIAS[m[1]] ?? m[1], chapter: Number(m[2]), verses: m[3].replace(/\s+/g, "") };
}

/** "3-5,9" → [3, 4, 5, 9]. */
export function verseList(verses) {
  const out = [];
  for (const part of String(verses).split(",")) {
    const [a, b = a] = part.split("-").map(Number);
    if (!(a >= 1 && b >= a)) return [];
    for (let v = a; v <= b; v++) out.push(v);
  }
  return out;
}

/** The scripture a pass block explains: a precept's own reference, or the verse(s) "v3-4" of the opened passage. */
export function blockRef(opened, at) {
  if (/^v[\d,\-]+$/.test(at)) {
    const o = splitRef(opened);
    return o ? { book: o.book, chapter: o.chapter, verses: at.slice(1) } : null;
  }
  return splitRef(at);
}

/** One pass block: the sense of a verse ("v12") or the reason given for a precept ("Hosea 1:10-11"), with its own moment when it has one. */
function block(passage, at) {
  if (/^v[\d,\-]+$/.test(at)) { const s = passage.sense?.find((x) => x.at === at.slice(1)); return s ? { text: s.text } : null; }
  const p = passage.precepts?.find((x) => x.ref === at);
  return p ? { text: p.why, ts: p.ts } : null;
}

// Words as the captions give them: lower case, no punctuation, a bleep ("[ __ ]", written "…") one word.
const BLEEP = "\u0000";
export function words(text) {
  return String(text).toLowerCase().replace(/\[\s*_+\s*\]|…/g, ` ${BLEEP} `).replace(/[’']/g, "").replace(/[^a-z0-9\u0000]+/g, " ").trim().split(" ").filter(Boolean);
}
const contains = (hay, needle) => {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) { for (let k = 0; k < needle.length; k++) if (hay[i + k] !== needle[k]) continue outer; return true; }
  return false;
};

/**
 * A quotation straight from a class transcript, for a class no pass covers yet: { video, from, to,
 * ref, text, teacher? }. The text is the teacher's words punctuated; its words must run, in order and
 * unbroken, through the captions between `from` and `to`, the scripture's book must be named in or
 * just before that stretch, and a teacher must be the one the records give or be named in the class.
 */
function resolveQuote(a, at, { readTranscript, hasChapter, teacherOf, problems }) {
  const t = readTranscript(a.video);
  if (!t) { problems.push(`${at}: no transcript for this class`); return null; }
  const from = hmsToSeconds(a.from), to = hmsToSeconds(a.to);
  if (!(to >= from)) { problems.push(`${at}: "to" must not come before "from"`); return null; }
  const ref = splitRef(a.ref);
  if (!ref || !hasChapter(ref.book, ref.chapter)) { problems.push(`${at}: "${a.ref}" is not a KJV or Apocrypha chapter`); return null; }
  const segs = t.segments ?? [];
  const span = segs.filter((s) => s[0] >= from - 1 && s[0] <= to + 1).map((s) => s[s.length - 1]).join(" ");
  if (!a.text || !contains(words(span), words(a.text))) { problems.push(`${at}: the text is not word for word what the captions say between ${a.from} and ${a.to}`); return null; }
  const near = segs.filter((s) => s[0] >= from - 180 && s[0] <= to + 60).map((s) => s[s.length - 1]).join(" ");
  const bookWords = words(ref.book === "Sirach" ? "Ecclesiasticus" : ref.book).filter((w) => !/^\d+$/.test(w));
  if (!contains(words(near), bookWords)) { problems.push(`${at}: ${ref.book} is not named near this moment`); return null; }
  const known = teacherOf(a.video) || "";
  let teacher = known;
  if (a.teacher && a.teacher !== known) {
    const name = words(a.teacher).slice(1);
    if (!name.length || !contains(words(segs.map((s) => s[s.length - 1]).join(" ")), name)) { problems.push(`${at}: teacher "${a.teacher}" is not in the class records or named in the class`); return null; }
    teacher = a.teacher;
  }
  return { ref, video: a.video, ts: a.from, t: from, teacher, title: t.cleanTitle || t.title || "", date: t.date || "", text: a.text };
}

/**
 * Resolves data/doctrine.json against the passes. Returns { doctrines, problems }: a doctrine
 * keeps only the answers that resolved, and every pointer that did not is a problem, so the
 * build can stop on it.
 */
export function resolveDoctrine(doc, { readPass, readTranscript = () => null, hasChapter, teacherOf = () => "", verseCount = () => 0, classUses = () => true }) {
  const problems = [];
  const seen = new Set();
  const doctrines = (doc.doctrines ?? []).map((d, i) => {
    const where = `doctrine ${d.slug ?? i}`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.slug ?? "")) problems.push(`${where}: slug must be lower-case words joined by hyphens`);
    if (seen.has(d.slug)) problems.push(`${where}: slug used twice`);
    seen.add(d.slug);
    if (!d.name || !d.claim) problems.push(`${where}: needs a name and a claim`);
    const answers = [];
    for (const [j, a] of (d.answers ?? []).entries()) {
      if (a.from !== undefined) {
        const r = resolveQuote(a, `${where}, answer ${j + 1} (${a.video} ${a.from})`, { readTranscript, hasChapter, teacherOf, problems });
        if (r) answers.push(r);
        continue;
      }
      const at = `${where}, answer ${j + 1} (${a.video} ${a.opened} ${a.at})`;
      const pass = readPass(a.video);
      if (!pass) { problems.push(`${at}: no precept pass for this class`); continue; }
      // A class can open the same scripture twice; the block names which time.
      const opened = (pass.passages ?? []).filter((p) => p.opened === a.opened);
      if (!opened.length) { problems.push(`${at}: the pass has no passage "${a.opened}"`); continue; }
      const passage = opened.find((p) => block(p, a.at));
      if (!passage) { problems.push(`${at}: the passage has no "${a.at}"`); continue; }
      const { text, ts = passage.ts } = block(passage, a.at);
      const ref = blockRef(a.opened, a.at);
      if (!ref || !hasChapter(ref.book, ref.chapter)) { problems.push(`${at}: "${a.at}" is not a KJV or Apocrypha chapter`); continue; }
      const paras = text.split("\n\n");
      const picked = [];
      for (const start of a.paras ?? []) {
        const hits = paras.filter((p) => p.startsWith(start));
        if (hits.length !== 1) { problems.push(`${at}: ${hits.length ? "more than one paragraph" : "no paragraph"} starts "${start}"`); continue; }
        picked.push(hits[0]);
      }
      if (!picked.length) { problems.push(`${at}: no paragraphs picked`); continue; }
      const teacher = passage.teacher || pass.teacher || "";
      answers.push({ ref, video: a.video, ts, t: hmsToSeconds(ts), teacher, title: pass.title ?? "", date: pass.date ?? "", text: picked.join("\n\n") });
    }
    if (!answers.length) problems.push(`${where}: no answers`);
    // The scriptures that answer it: each verse one the classes themselves read, opened or gave as a precept.
    const scriptures = [];
    for (const s of d.scriptures ?? []) {
      const ref = splitRef(s);
      if (!ref || !hasChapter(ref.book, ref.chapter)) { problems.push(`${where}: scripture "${s}" is not a KJV or Apocrypha chapter`); continue; }
      const vs = verseList(ref.verses);
      if (!vs.length || vs.some((v) => v < 1 || v > verseCount(ref.book, ref.chapter))) { problems.push(`${where}: scripture "${s}" names a verse the chapter does not have`); continue; }
      const unused = vs.filter((v) => !classUses(ref.book, ref.chapter, v));
      if (unused.length) { problems.push(`${where}: scripture "${s}": no class read, opened or gave verse ${unused.join(", ")}`); continue; }
      scriptures.push(ref);
    }
    return { slug: d.slug, name: d.name, claim: d.claim, answers, scriptures, related: d.related ?? {} };
  });
  return { doctrines, problems };
}

/** Reads data/doctrine.json and resolves it from the repository's passes and Bible data. */
export function loadDoctrine(ROOT) {
  const file = path.join(ROOT, "data", "doctrine.json");
  if (!fs.existsSync(file)) return { title: "Doctrine", doctrines: [], problems: [] };
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  const passDir = path.join(ROOT, "data", "precepts", "classes");
  const readPass = (video) => {
    const f = path.join(passDir, `${video}.json`);
    return /^[A-Za-z0-9_-]{11}$/.test(video) && fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
  };
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "bible", "index.json"), "utf8"));
  const chaptersOf = new Map(index.map((b) => [b.book, b.chapters]));
  const hasChapter = (book, chapter) => chapter >= 1 && chapter <= (chaptersOf.get(book) ?? 0);
  const readTranscript = (video) => {
    if (!/^[A-Za-z0-9_-]{11}$/.test(video)) return null;
    for (const feed of ["blog", "history", "captains"]) {
      const f = path.join(ROOT, feed, "transcripts", `${video}.json`);
      if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
    }
    return null;
  };
  // Who taught a class by the records: an admin correction first, then the class outlines.
  const teachers = new Map();
  for (const file of ["r2-class-teachers.tsv", "class-teachers.tsv"]) {
    const f = path.join(ROOT, "data", "sources", file);
    if (!fs.existsSync(f)) continue;
    const lines = fs.readFileSync(f, "utf8").split("\n").filter((l) => l && !l.startsWith("#"));
    const head = lines.shift().split("\t");
    const v = head.indexOf("video"), te = head.indexOf("teacher");
    for (const l of lines) { const c = l.split("\t"); if (c[v] && c[te]) teachers.set(c[v], c[te]); }
  }
  // Every verse the classes used: the passages they opened, the verses they explained and the
  // precepts they gave in the merged passes, and the scriptures of the precept topics.
  const used = new Set();
  const use = (r) => { if (r) for (const v of verseList(r.verses)) used.add(`${r.book}|${r.chapter}|${v}`); };
  for (const f of fs.readdirSync(passDir).filter((f) => f.endsWith(".json"))) {
    const pass = JSON.parse(fs.readFileSync(path.join(passDir, f), "utf8"));
    for (const p of pass.passages ?? []) {
      const o = splitRef(p.opened); use(o);
      for (const s of p.sense ?? []) if (o) use({ book: o.book, chapter: o.chapter, verses: s.at });
      for (const q of p.precepts ?? []) use(splitRef(q.ref));
    }
  }
  const topics = path.join(ROOT, "data", "precepts.json");
  if (fs.existsSync(topics)) for (const t of JSON.parse(fs.readFileSync(topics, "utf8")).topics ?? []) for (const r of t.refs ?? []) use({ ...r, book: BOOK_ALIAS[r.book] ?? r.book });
  // And every verse read aloud in a class, as the transcripts place the readings (data/precepts/readings).
  const readDir = path.join(ROOT, "data", "precepts", "readings");
  for (const e of index) {
    const f = path.join(readDir, `${e.slug}.json`);
    if (!fs.existsSync(f)) continue;
    for (const [ch, verses] of Object.entries(JSON.parse(fs.readFileSync(f, "utf8")))) for (const v of Object.keys(verses)) used.add(`${e.book}|${ch}|${v}`);
  }
  const versesIn = new Map();
  const verseCount = (book, chapter) => {
    if (!versesIn.has(book)) { const e = index.find((b) => b.book === book); versesIn.set(book, e ? JSON.parse(fs.readFileSync(path.join(ROOT, "data", "bible", `${e.slug}.json`), "utf8")).chapters : {}); }
    return versesIn.get(book)[String(chapter)]?.length ?? 0;
  };
  const { doctrines, problems } = resolveDoctrine(doc, { readPass, readTranscript, hasChapter, teacherOf: (v) => teachers.get(v) ?? "", verseCount, classUses: (book, chapter, v) => used.has(`${book}|${chapter}|${v}`) });
  return { title: doc.title ?? "Doctrine", intro: doc.intro ?? "", doctrines, problems };
}
