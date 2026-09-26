// Spell every leader's name one way across the notes, from data/names.tsv.
//
//   node scripts/fix-names.mjs [--dry]
//
// The recordings are auto-captioned and a name arrives however the recogniser heard it:
// Bishop Kani has been written Kai, Kana, Kanai, Kennai, Kenny and thirty other ways. The
// glossary in data/names.tsv holds the spelling to use and every mis-spelling seen, one
// person per row: `name` is the correct form with its title ("Bishop Kani"), `variants` is
// a `;`-separated list of the wrong forms, each with its title too so an ordinary word can
// never be caught ("Bishop keeps" is not a name).
//
// Runs first in `npm run notes:fix`, over the note bodies and the frontmatter alike, so the
// `teacher` field and the browse chips it feeds get the same spelling. Matches are whole
// words, any case (captions shout: "BISHOP KANAI"), and the possessive survives ("Bishop
// Kai's class" -> "Bishop Kani's class"). Transcripts under blog/transcripts and the like
// are the evidence layer and are never touched.
//
// lint.py reads the same file and fails a note that still carries a listed variant.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");
const DIRS = ["blog", "captains", path.join("history", "notes")].map((d) => path.join(ROOT, d));

export function loadNames(file = path.join(ROOT, "data", "names.tsv")) {
  const [head, ...rows] = fs.readFileSync(file, "utf8").split("\n").filter((l) => l.trim());
  const cols = head.split("\t");
  const iName = cols.indexOf("name"), iVar = cols.indexOf("variants");
  if (iName < 0 || iVar < 0) throw new Error(`${file}: header needs name and variants columns`);
  const out = [];
  for (const row of rows) {
    const cells = row.split("\t");
    const name = cells[iName]?.trim();
    const variants = (cells[iVar] ?? "").split(";").map((v) => v.trim()).filter(Boolean);
    if (!name) continue;
    for (const v of variants) if (v.toLowerCase() === name.toLowerCase()) throw new Error(`${file}: "${name}" lists itself as a variant`);
    out.push({ name, variants });
  }
  return out;
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");

/** One regex per person, all its variants alternated, longest first so "Bishop Ka Nai" wins
 *  over "Bishop Ka". Whole words only; case-insensitive. */
export function compile(names) {
  return names.map(({ name, variants }) => ({
    name,
    re: new RegExp(`\\b(?:${[...variants].sort((a, b) => b.length - a.length).map(escape).join("|")})\\b`, "gi"),
  }));
}

export function fixText(text, rules) {
  let n = 0;
  for (const { name, re } of rules) text = text.replace(re, () => (n++, name));
  return { text, n };
}

function* notes() {
  for (const dir of DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const year of fs.readdirSync(dir)) {
      const ydir = path.join(dir, year);
      if (!/^\d{4}$/.test(year) || !fs.statSync(ydir).isDirectory()) continue;
      for (const f of fs.readdirSync(ydir)) if (f.endsWith(".md")) yield path.join(ydir, f);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rules = compile(loadNames());
  let files = 0, fixes = 0;
  const perName = new Map();
  for (const file of notes()) {
    const before = fs.readFileSync(file, "utf8");
    let after = before, n = 0;
    for (const { name, re } of rules) {
      after = after.replace(re, () => { n++; perName.set(name, (perName.get(name) ?? 0) + 1); return name; });
    }
    if (n) {
      files++; fixes += n;
      if (!DRY) fs.writeFileSync(file, after);
      console.error(`${DRY ? "[dry] " : ""}${path.relative(ROOT, file)}: ${n} name${n === 1 ? "" : "s"} respelled`);
    }
  }
  for (const [name, n] of [...perName].sort((a, b) => b[1] - a[1])) console.error(`  ${String(n).padStart(4)}  ${name}`);
  console.error(`${DRY ? "[dry] " : ""}${files} notes rewritten · ${fixes} names respelled · ${rules.length} people in data/names.tsv`);
}
