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

/**
 * Resolves data/doctrine.json against the passes. Returns { doctrines, problems }: a doctrine
 * keeps only the answers that resolved, and every pointer that did not is a problem, so the
 * build can stop on it.
 */
export function resolveDoctrine(doc, readPass, hasChapter) {
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
    return { slug: d.slug, name: d.name, claim: d.claim, answers, related: d.related ?? {} };
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
  const chaptersOf = new Map(JSON.parse(fs.readFileSync(path.join(ROOT, "data", "bible", "index.json"), "utf8")).map((b) => [b.book, b.chapters]));
  const hasChapter = (book, chapter) => chapter >= 1 && chapter <= (chaptersOf.get(book) ?? 0);
  const { doctrines, problems } = resolveDoctrine(doc, readPass, hasChapter);
  return { title: doc.title ?? "Doctrine", intro: doc.intro ?? "", doctrines, problems };
}
