// Stamp topic tags and a teacher onto the committed class and captains notes.
//
//   node scripts/tag-notes.mjs [--dry] [--report]
//
// The notes carried one tag each, the series name, so /classes/browse could only filter by
// title text and year while the cases and precepts already had a hundred topical tags. This
// derives topics from data/topics.tsv and writes them into the frontmatter, where they are
// committed source: Docusaurus turns them into /classes/tags/<topic> pages, the browse page
// facets on them, and they can be corrected by hand afterwards.
//
// Idempotent. The `tags` line is rewritten whole with the series tag first, so a rerun after
// editing data/topics.tsv replaces the derived set rather than appending to it. A tag that is
// not a known topic slug and not the series is treated as a hand-addition and kept.
//
// The teacher is only written where the note actually says who taught: "taught by X",
// "class from X", "X teaches". Most classes never name the teacher, and those are left blank
// rather than guessed at from whoever happens to be mentioned first — the notes are full of
// people who are greeted, prayed for or quoted without teaching anything.
//
// Some notes carry a teacher this cannot derive, read out of the class by hand: the Abya Yala
// class names its teacher only in the opening prayer ("put your spirit upon Captain Zephaniah,
// that he might bring out this information"). Those are preserved, not overwritten - see the
// note on --reset below.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");
const REPORT = process.argv.includes("--report");
const RESET = process.argv.includes("--reset");   // recompute `teacher` instead of keeping hand edits

const FEEDS = [
  { dir: path.join(ROOT, "blog"), series: "IUIC in the ClassRoom" },
  { dir: path.join(ROOT, "captains"), series: "15 Minutes w/ The Captains" },
];

/* ---------------- topics ---------------- */
const TOPICS = fs.readFileSync(path.join(ROOT, "data", "topics.tsv"), "utf8")
  .split("\n").slice(1).filter(Boolean)
  .map((line) => {
    const [slug, label, terms] = line.split("\t");
    return { slug, label, terms: terms.split(";").map((t) => t.trim().toLowerCase()).filter(Boolean) };
  });
const TOPIC_SLUGS = new Set(TOPICS.map((t) => t.slug));

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Word-bounded so "war" does not match "toward" and "fast" does not match "steadfast".
const MATCHERS = TOPICS.map((t) => ({ ...t, res: t.terms.map((term) => new RegExp(`\\b${reEsc(term)}\\b`, "g")) }));

// A two-hour class mentions almost everything at least once, so a raw count tags every note
// with whatever is common across the whole corpus rather than with what the class was about.
// A topic is kept when the note uses it at a materially higher rate than the average note
// does, which is what separates "the class on bitterness" from "the class that said bitter".
const MIN_HITS = 4;             // below this the rate is noise whatever the ratio says
const MIN_RATIO = 2.0;          // times the corpus mean rate for that topic
const MIN_HITS_IF_TITLED = 2;   // the title names it: that is the subject, by declaration
const MAX_TOPICS = 5;

/** What a topic scorer reads: the teacher's own prose.
 *  The quoted scripture is dropped (a blockquote is the passage, not the subject) and so are
 *  link targets and citation labels, which otherwise made every class that opened Isaiah look
 *  like a class about the prophets. */
function prose(title, body) {
  return (title + "\n" + body)
    .split("\n").filter((l) => !/^\s*>/.test(l)).join("\n")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, " ")
    .replace(/<[^>]+>/g, " ")
    .toLowerCase().replace(/[’']/g, "").replace(/\s+/g, " ");
}

/** Raw hits per topic, plus the word count they are a rate over. */
function countTopics(title, body) {
  const hay = prose(title, body);
  const words = Math.max(1, hay.split(" ").length);
  const hayTitle = title.toLowerCase().replace(/[’']/g, "");
  const hits = new Map();
  for (const t of MATCHERS) {
    let n = 0;
    for (const re of t.res) { re.lastIndex = 0; n += (hay.match(re) ?? []).length; }
    if (n) hits.set(t.slug, n);
  }
  const titled = new Set(MATCHERS.filter((t) => t.terms.some((term) => hayTitle.includes(term))).map((t) => t.slug));
  return { hits, words, titled };
}

/** Corpus mean rate per topic, over the notes that use it at all. */
function meanRates(counted) {
  const sum = new Map(), n = new Map();
  for (const c of counted) for (const [slug, h] of c.hits) {
    sum.set(slug, (sum.get(slug) ?? 0) + h / c.words);
    n.set(slug, (n.get(slug) ?? 0) + 1);
  }
  return new Map([...sum].map(([slug, s]) => [slug, s / n.get(slug)]));
}

function topicsFor(counted, mean) {
  const scored = [];
  for (const [slug, h] of counted.hits) {
    const titled = counted.titled.has(slug);
    if (titled ? h < MIN_HITS_IF_TITLED : h < MIN_HITS) continue;
    const ratio = (h / counted.words) / (mean.get(slug) || 1e-9);
    if (!titled && ratio < MIN_RATIO) continue;
    scored.push({ slug, ratio, titled });
  }
  // A topic named in the title outranks one that is merely dense in a two-hour class.
  scored.sort((a, b) => (b.titled ? 1 : 0) - (a.titled ? 1 : 0) || b.ratio - a.ratio || a.slug.localeCompare(b.slug));
  if (scored.length) return scored.slice(0, MAX_TOPICS).map((s) => s.slug);
  // A class that sits just under the bar on everything still has a strongest subject, and one
  // approximate tag serves a reader better than none at all: without this the note is
  // reachable only by its title.
  const best = [...counted.hits].filter(([, h]) => h >= MIN_HITS)
    .map(([slug, h]) => ({ slug, ratio: (h / counted.words) / (mean.get(slug) || 1e-9) }))
    .sort((a, b) => b.ratio - a.ratio)[0];
  return best ? [best.slug] : [];
}

/* ---------------- teacher ---------------- */
const TITLE = "(?:Deacon|Bishop|Captain|Elder|Officer)";
const NAME = "[A-Z][A-Za-z]+";
// Only phrasings that say this person taught this class. Ordered most to least explicit;
// the first to match wins.
// Most explicit first. "X teaches this class" beats "class from X", which beats a first-person
// introduction, because a note often mentions another session in passing: "the evening class
// with Bishop Nathaniel follows" says nothing about who taught this one, which is why
// "class with X" is not accepted at all - only "class from X" and "taught by X".
const TEACHER_PATTERNS = [
  new RegExp(`\\b(${TITLE}) (${NAME}) (?:teaches|is teaching|taught) (?:this|the|today)`),
  new RegExp(`\\b(${TITLE}) (${NAME}) teaches\\b`),
  new RegExp(`\\b(${TITLE}) (${NAME}) is teaching\\b`),
  new RegExp(`\\btaught by (${TITLE}) (${NAME})\\b`),
  new RegExp(`\\b(?:Sabbath |morning |evening |early morning |afternoon )*class from (${TITLE}) (${NAME})\\b`, "i"),
  new RegExp(`\\b(${TITLE}) (${NAME}) (?:opens|opened|brings|delivers|delivered) (?:this|the) (?:class|episode|lesson)`),
  // The captains introduce themselves in the first person, which is the speaker by definition.
  new RegExp(`\\b(?:My name is|I am|I\u2019m|I'm) (${TITLE}) (${NAME})\\b`),
  // No trailing punctuation required: "It is Captain Yahoshua with another edition of
  // 15 Minutes" is as much an introduction as "It is Captain Yochanan."
  new RegExp(`\\b(?:It is|This is) (${TITLE}) (${NAME})\\b`),
];
function teacherFor(body) {
  for (const re of TEACHER_PATTERNS) {
    const m = re.exec(body);
    // Group 1 keeps the source casing for the title even when the pattern is case-insensitive.
    if (m) return `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} ${m[2]}`;
  }
  return null;
}

/* ---------------- rewrite ---------------- */
const parseTags = (line) => {
  const m = /^tags:\s*\[(.*)\]\s*$/.exec(line);
  if (!m) return null;
  return [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1].replace(/\\(["\\])/g, "$1"));
};
const yamlList = (xs) => `[${xs.map((x) => JSON.stringify(x)).join(", ")}]`;

let files = 0, tagged = 0, teachers = 0, untaught = 0;
const rows = [];

// Pass one: read every note and count. The rates cannot be judged until the whole corpus
// has been seen, so nothing is written until pass two.
const docs = [];
for (const feed of FEEDS) {
  if (!fs.existsSync(feed.dir)) continue;
  for (const year of fs.readdirSync(feed.dir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const name of fs.readdirSync(path.join(feed.dir, year.name)).filter((f) => f.endsWith(".md"))) {
      const file = path.join(feed.dir, year.name, name);
      const before = fs.readFileSync(file, "utf8");
      const fmEnd = before.indexOf("\n---\n", 4);
      if (!before.startsWith("---\n") || fmEnd < 0) continue;
      const head = before.slice(4, fmEnd).split("\n");
      const body = before.slice(fmEnd + 5);
      const title = /^title:\s*"(.*)"\s*$/.exec(head.find((l) => l.startsWith("title:")) ?? "")?.[1] ?? name;
      docs.push({ feed, file, name, before, head, body, title, counted: countTopics(title, body) });
    }
  }
}
const mean = meanRates(docs.map((d) => d.counted));

// Pass two: assign and write.
{
  {
    for (const { feed, file, name, before, head, body, title, counted } of docs) {
      const topics = topicsFor(counted, mean);
      const teacher = teacherFor(body);

      const tagLine = head.findIndex((l) => l.startsWith("tags:"));
      const existing = tagLine >= 0 ? (parseTags(head[tagLine]) ?? []) : [];
      // Anything that is neither the series nor a topic slug was added by hand: keep it.
      const kept = existing.filter((t) => t !== feed.series && !TOPIC_SLUGS.has(t));
      const nextTags = [feed.series, ...topics, ...kept];

      const out = [...head];
      if (tagLine >= 0) out[tagLine] = `tags: ${yamlList(nextTags)}`;
      else out.push(`tags: ${yamlList(nextTags)}`);

      // A teacher already in the frontmatter is a hand correction and is left alone: only 14
      // of these notes say who taught, so the rest are expected to be filled in by hand, and
      // a rerun after adding a topic must not wipe that work. --reset recomputes the field
      // from the text, discarding hand edits, and is what to use after changing the patterns.
      // A text merge of two branches that both added `teacher:` at different points in the
      // frontmatter leaves two of them, which is a duplicate YAML key and fails the build.
      // Collapse any extras onto the first before reading it.
      for (let i = out.length - 1; i > out.findIndex((l) => l.startsWith("teacher:")); i--)
        if (out[i].startsWith("teacher:")) out.splice(i, 1);
      const teacherLine = out.findIndex((l) => l.startsWith("teacher:"));
      const existingTeacher = teacherLine >= 0 ? /^teacher:\s*"(.*)"\s*$/.exec(out[teacherLine])?.[1] ?? null : null;
      const nextTeacher = RESET ? teacher : (existingTeacher ?? teacher);
      if (nextTeacher) {
        if (teacherLine >= 0) out[teacherLine] = `teacher: ${JSON.stringify(nextTeacher)}`;
        else out.splice(out.findIndex((l) => l.startsWith("tags:")), 0, `teacher: ${JSON.stringify(nextTeacher)}`);
        teachers++;
      } else {
        if (teacherLine >= 0) out.splice(teacherLine, 1);
        untaught++;
      }

      rows.push({ name, topics, teacher: nextTeacher });
      if (topics.length) tagged++;

      const after = `---\n${out.join("\n")}\n---\n${body}`;
      if (after !== before) { files++; if (!DRY) fs.writeFileSync(file, after); }
    }
  }
}

if (REPORT) {
  const counts = new Map();
  for (const r of rows) for (const t of r.topics) counts.set(t, (counts.get(t) ?? 0) + 1);
  console.error("\ntopic\tnotes");
  for (const [t, n] of [...counts].sort((a, b) => b[1] - a[1])) console.error(`${t}\t${n}`);
  console.error("\nper-note assignment:");
  for (const r of rows) console.error(`  ${r.name.replace(/^\d{4}-\d\d-\d\d-/, "").replace(/\.md$/, "").slice(0, 52).padEnd(54)} ${r.topics.join(", ")}`);
  console.error("\nnotes with no topic:");
  for (const r of rows.filter((x) => !x.topics.length)) console.error(`  ${r.name}`);
  console.error("\nteachers:");
  const tc = new Map();
  for (const r of rows) if (r.teacher) tc.set(r.teacher, (tc.get(r.teacher) ?? 0) + 1);
  for (const [t, n] of [...tc].sort((a, b) => b[1] - a[1])) console.error(`  ${n}\t${t}`);
}
console.error(`${DRY ? "[dry] " : ""}${files} notes rewritten · ${tagged} with topics · ${teachers} with a named teacher · ${untaught} unattributed`);
