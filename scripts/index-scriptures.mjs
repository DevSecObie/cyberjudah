// Put the list of scripture a note opens at the top of the note.
//
//   node scripts/index-scriptures.mjs [--dry]
//
// A class note is an hour of prose with the passages threaded through it. To find out whether
// a class is the one that went through Ezekiel 37 you had to open it and scroll. This writes a
// summary line under the existing "taught" line, listing every chapter the note opens in the
// order it opens them, each linked into the scripture.
//
// The notes are the source of record, so this edits them rather than the built page: the
// vault export and the markdown in the repo get the same line.
//
// Idempotent: an existing block is replaced, so a rerun after the note is edited refreshes it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");
const FEED_DIRS = [path.join(ROOT, "blog"), path.join(ROOT, "captains")];

const bibleIndex = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "bible", "index.json"), "utf8"));
const bookBySlug = Object.fromEntries(bibleIndex.map((e) => [e.slug, e.book]));
const ABBR = { Genesis: "Gen", Exodus: "Exod", Leviticus: "Lev", Numbers: "Num", Deuteronomy: "Deut", Joshua: "Josh", Judges: "Judg", "1 Samuel": "1 Sam", "2 Samuel": "2 Sam", "1 Kings": "1 Kgs", "2 Kings": "2 Kgs", "1 Chronicles": "1 Chr", "2 Chronicles": "2 Chr", Nehemiah: "Neh", Psalms: "Ps", Proverbs: "Prov", Ecclesiastes: "Eccl", "Song of Solomon": "Song", Isaiah: "Isa", Jeremiah: "Jer", Lamentations: "Lam", Ezekiel: "Ezek", Daniel: "Dan", Hosea: "Hos", Obadiah: "Obad", Micah: "Mic", Nahum: "Nah", Habakkuk: "Hab", Zephaniah: "Zeph", Haggai: "Hag", Zechariah: "Zech", Malachi: "Mal", Matthew: "Matt", Romans: "Rom", "1 Corinthians": "1 Cor", "2 Corinthians": "2 Cor", Galatians: "Gal", Ephesians: "Eph", Philippians: "Phil", Colossians: "Col", "1 Thessalonians": "1 Thess", "2 Thessalonians": "2 Thess", "1 Timothy": "1 Tim", "2 Timothy": "2 Tim", Philemon: "Phlm", Hebrews: "Heb", "1 Peter": "1 Pet", "2 Peter": "2 Pet", Revelation: "Rev", "Wisdom of Solomon": "Wis", Sirach: "Sir", "1 Maccabees": "1 Macc", "2 Maccabees": "2 Macc", "Esther (Greek)": "Esth (Gk)", "Song of the Three Children": "Song Thr", "Bel and the Dragon": "Bel", "Prayer of Manasseh": "Pr Man", "Epistle of Jeremiah": "Ep Jer" };
const abbr = (b) => ABBR[b] ?? b;

// A <span>, not a <p>: a line starting with a block-level tag opens a raw CommonMark HTML
// block and everything inside it stops being markdown, which would print the links as their
// literal source. <span> is inline, so the paragraph is still parsed and the links work.
const OPENS_BLOCK = /^<span class="opens">[\s\S]*?<\/span>\n+/m;
const TAUGHT_LINE = /^<p class="taught">.*<\/p>\n/m;
// A long class turns to fifty chapters. The line is for orientation, not for completeness:
// every one of them is linked in the body, and the full reverse index is /classes/by-book.
const SHOWN = 16;

// The passages a note opens are the bold citation headings that introduce a quotation,
// "**[Deuteronomy 8:1-3](/bible/deuteronomy/8#v1)**". The verse superscripts inside the
// quotation itself link to the same chapter and are deliberately not counted: they are the
// text being read, not another passage being turned to.
const OPENING = /^\*\*\[([^\]]+)\]\(\/bible\/([a-z0-9-]+)\/(\d+)(?:#v\d+)?\)\*\*/gm;

let files = 0, refs = 0, skipped = 0;

for (const dir of FEED_DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const year of fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const name of fs.readdirSync(path.join(dir, year.name)).filter((f) => f.endsWith(".md"))) {
      const file = path.join(dir, year.name, name);
      const before = fs.readFileSync(file, "utf8");
      const stripped = before.replace(OPENS_BLOCK, "");

      // Distinct chapters, first mention wins, order preserved.
      const seen = new Map();
      for (const [, , bslug, ch] of stripped.matchAll(OPENING)) {
        const book = bookBySlug[bslug];
        if (!book) continue;
        const key = `${book} ${ch}`;
        if (!seen.has(key)) seen.set(key, `[${abbr(book)} ${ch}](/bible/${bslug}/${ch})`);
      }

      if (!seen.size) { skipped++; continue; }
      const links = [...seen.values()];
      const shown = links.slice(0, SHOWN).join(" · ");
      const rest = links.length > SHOWN ? ` · <i>and ${links.length - SHOWN} more below</i>` : "";
      const block = `<span class="opens"><b>Opens</b> ${shown}${rest}</span>`;

      // Under the "taught" line where there is one, otherwise at the top of the body. Both
      // paths leave exactly one blank line on each side so a rerun reproduces this byte for
      // byte instead of drifting by a newline every time.
      let after;
      if (TAUGHT_LINE.test(stripped)) {
        after = stripped.replace(TAUGHT_LINE, (m) => `${m}\n${block}\n`);
      } else {
        const fmEnd = stripped.indexOf("\n---\n", 4);
        after = fmEnd < 0 ? stripped : `${stripped.slice(0, fmEnd + 5)}\n${block}\n\n${stripped.slice(fmEnd + 5).replace(/^\n+/, "")}`;
      }

      refs += seen.size;
      if (after !== before) { files++; if (!DRY) fs.writeFileSync(file, after); }
    }
  }
}

console.error(`${DRY ? "[dry] " : ""}${files} notes indexed · ${refs} chapter references listed · ${skipped} notes opened no scripture`);
