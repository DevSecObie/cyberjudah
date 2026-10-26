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

/** Whether a paragraph quotes a verse: five of its words in a row. */
function quotes(text, verse) {
  const w = words(verse), hay = words(text);
  if (w.length < 5) return w.length > 0 && contains(hay, w);
  for (let i = 0; i + 5 <= w.length; i++) if (contains(hay, w.slice(i, i + 5))) return true;
  return false;
}

/**
 * A teacher's paragraph with the scripture it recites set aside: each quotation of five words or more
 * that runs through verses of this chapter becomes their reference, "(Job 3:17)", named once. Returns ""
 * when fewer than ten of the teacher's own words are left.
 */
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function explanation(text, book, chapter, verses) {
  const flat = [];
  verses.forEach((t, i) => { for (const w of words(t)) flat.push([w, i + 1]); });
  const find = (w) => {
    outer: for (let i = 0; i + w.length <= flat.length; i++) { for (let k = 0; k < w.length; k++) if (flat[i + k][0] !== w[k]) continue outer; return [flat[i][1], flat[i + w.length - 1][1]]; }
    return null;
  };
  const cited = new Set();
  const out = String(text).replace(/\s*“([^”]*)”/g, (all, q) => {
    const w = words(q);
    const at = w.length >= 5 && find(w);
    if (!at) return all;
    const r = `${book} ${chapter}:${at[0]}${at[1] > at[0] ? `-${at[1]}` : ""}`;
    // A verse recited again is named once.
    if (cited.has(r)) return "";
    cited.add(r);
    return `${all.match(/^\s*/)[0]}(${r})`;
  })
    // Verses recited one after another become one reference: "(Job 3:13), (Job 3:14)" is "(Job 3:13-14)".
    .replace(new RegExp(`\\(${esc(`${book} ${chapter}:`)}\\d+(?:-\\d+)?\\)(?:[\\s,]*\\(${esc(`${book} ${chapter}:`)}\\d+(?:-\\d+)?\\))+`, "g"), (run) => {
      const ns = [...run.matchAll(/:(\d+)(?:-(\d+))?\)/g)].flatMap((m) => [Number(m[1]), Number(m[2] ?? m[1])]);
      const a = Math.min(...ns), b = Math.max(...ns);
      return `(${book} ${chapter}:${a}${b > a ? `-${b}` : ""})`;
    })
    .replace(/^[\s:;,]+/, "").replace(/\s+([.,:;])/g, "$1").replace(/([.,:;])[.,:;]+/g, "$1").replace(/[,;:]$/, ".")
    // A sentence left starting after a recited verse starts with a capital.
    .replace(/([.?!]\s+)([a-z])/g, (m, a, c) => a + c.toUpperCase()).trim();
  const own = words(out.replace(/\([^)]*\d+:\d+[^)]*\)/g, " "));
  return own.length >= 10 ? out : "";
}

const RANK = ["Bishop", "Deacon", "Captain", "Elder"];
const rankOf = (teacher) => { const i = RANK.findIndex((r) => teacher.startsWith(r)); return i < 0 ? RANK.length : i; };

/**
 * The points under one scripture: up to `max` paragraphs, word for word, in which the merged passes
 * break that verse down, each from a different class. Those that speak to the doctrine (its `terms`)
 * come first, then a Bishop's before a Deacon's and so on, then the shorter; paragraphs the doctrine
 * already quotes as answers are left out. A verse no pass breaks down gets the class moments it was
 * read in instead (`read: true`), so a point is never anyone's words but a teacher's.
 */
export function pointsFor(ref, { said, heard, terms = "", taken = new Set(), readTranscript = () => null, verseText = () => "", chapterText = () => [], max = 2 }) {
  const match = terms ? new RegExp(terms, "i") : null;
  const seen = new Set(), all = [];
  for (const v of verseList(ref.verses)) for (const p of said.get(`${ref.book}|${ref.chapter}|${v}`) ?? []) {
    if (taken.has(p.text) || seen.has(p.text)) continue;
    // A block of several verses or paragraphs speaks to this verse only where it quotes it.
    if (!p.only && !quotes(p.text, verseText(ref.book, ref.chapter, v))) continue;
    seen.add(p.text);
    // Only the explanation: the chapter's verses recited in it give way to their reference, and a
    // paragraph with little left but the recital is no explanation at all.
    const text = explanation(p.text, ref.book, ref.chapter, chapterText(ref.book, ref.chapter));
    if (text) all.push({ ...p, text });
  }
  all.sort((a, b) => (match && !match.test(a.text)) - (match && !match.test(b.text)) || rankOf(a.teacher) - rankOf(b.teacher) || a.text.length - b.text.length);
  const out = [], videos = new Set();
  for (const p of all) {
    if (out.length >= max) break;
    if (videos.has(p.video)) continue;
    videos.add(p.video);
    out.push({ video: p.video, ts: p.ts, t: hmsToSeconds(p.ts), teacher: p.teacher, title: p.title, date: p.date, text: p.text });
  }
  if (out.length) return out;
  for (const v of verseList(ref.verses)) for (const [video, t] of heard.get(`${ref.book}|${ref.chapter}|${v}`) ?? []) {
    if (out.length >= max) break;
    if (videos.has(video)) continue;
    videos.add(video);
    const tr = readTranscript(video);
    const ts = [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60].map((x, i) => (i ? String(x).padStart(2, "0") : String(x))).join(":").replace(/^0:/, "");
    out.push({ video, ts, t, title: tr?.cleanTitle || tr?.title || "", date: tr?.date || "", read: true });
  }
  return out;
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
  // The pass paragraphs that break each verse down are kept too, for the points under a scripture.
  const used = new Set();
  const use = (r) => { if (r) for (const v of verseList(r.verses)) used.add(`${r.book}|${r.chapter}|${v}`); };
  const said = new Map();
  const tell = (r, from, text, ts) => {
    if (!r) return;
    const vs = verseList(r.verses);
    for (const v of vs) {
      const k = `${r.book}|${r.chapter}|${v}`;
      if (!said.has(k)) said.set(k, []);
      const paras = String(text).split("\n\n");
      for (const para of paras) said.get(k).push({ ...from, ts, text: para, only: vs.length === 1 && paras.length === 1 });
    }
  };
  for (const f of fs.readdirSync(passDir).filter((f) => f.endsWith(".json"))) {
    const pass = JSON.parse(fs.readFileSync(path.join(passDir, f), "utf8"));
    for (const p of pass.passages ?? []) {
      const o = splitRef(p.opened); use(o);
      const from = { video: pass.video, teacher: p.teacher || pass.teacher || "", title: pass.title ?? "", date: pass.date ?? "" };
      for (const s of p.sense ?? []) if (o) { const r = { book: o.book, chapter: o.chapter, verses: s.at }; use(r); tell(r, from, s.text, p.ts); }
      for (const q of p.precepts ?? []) { const r = splitRef(q.ref); use(r); tell(r, from, q.why, q.ts ?? p.ts); }
    }
  }
  const topics = path.join(ROOT, "data", "precepts.json");
  if (fs.existsSync(topics)) for (const t of JSON.parse(fs.readFileSync(topics, "utf8")).topics ?? []) for (const r of t.refs ?? []) use({ ...r, book: BOOK_ALIAS[r.book] ?? r.book });
  // And every verse read aloud in a class, as the transcripts place the readings (data/precepts/readings).
  const readDir = path.join(ROOT, "data", "precepts", "readings");
  const heard = new Map();
  for (const e of index) {
    const f = path.join(readDir, `${e.slug}.json`);
    if (!fs.existsSync(f)) continue;
    for (const [ch, verses] of Object.entries(JSON.parse(fs.readFileSync(f, "utf8")))) for (const [v, at] of Object.entries(verses)) { used.add(`${e.book}|${ch}|${v}`); heard.set(`${e.book}|${ch}|${v}`, at); }
  }
  const versesIn = new Map();
  const verseCount = (book, chapter) => {
    if (!versesIn.has(book)) { const e = index.find((b) => b.book === book); versesIn.set(book, e ? JSON.parse(fs.readFileSync(path.join(ROOT, "data", "bible", `${e.slug}.json`), "utf8")).chapters : {}); }
    return versesIn.get(book)[String(chapter)]?.length ?? 0;
  };
  const chapterText = (book, chapter) => { verseCount(book, chapter); return versesIn.get(book)?.[String(chapter)] ?? []; };
  const verseText = (book, chapter, v) => { verseCount(book, chapter); return versesIn.get(book)?.[String(chapter)]?.[v - 1] ?? ""; };
  const { doctrines, problems } = resolveDoctrine(doc, { readPass, readTranscript, hasChapter, teacherOf: (v) => teachers.get(v) ?? "", verseCount, classUses: (book, chapter, v) => used.has(`${book}|${chapter}|${v}`) });
  for (const d of doctrines) {
    const terms = (doc.doctrines.find((x) => x.slug === d.slug)?.terms) ?? "";
    const taken = new Set(d.answers.flatMap((a) => a.text.split("\n\n")));
    d.scriptures = d.scriptures.map((ref) => ({ ...ref, points: pointsFor(ref, { said, heard, terms, taken, readTranscript, verseText, chapterText }) }));
  }
  return { title: doc.title ?? "Doctrine", intro: doc.intro ?? "", doctrines, problems };
}
