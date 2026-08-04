#!/usr/bin/env python3
"""Build content/Encyclopedia from the study notes.

Reads _tools/lexicon.tsv (topic, summary, terms), every study note under
"content/Study Bible/<Book>/<Range>/<Range> Study Notes.md", and the
Bible chapter files under "content/Bible" (to resolve ![[Chapter#^vN]]
verse transclusions for matching), then writes one linked entry per
topic into content/Encyclopedia/, plus _Index.md.

Run from the repo root:

    python3 _tools/build_encyclopedia.py

No dependencies beyond Python. It only reads the markdown; it never
modifies the study notes or the Bible files. Rerun it after each new
chapter set lands in content/Study Bible, then commit the result.

To grow the encyclopedia, add a row to _tools/lexicon.tsv:
topic <tab> summary <tab> term;term;term
"""

import csv
import re
import sys
from pathlib import Path

BOM = "﻿"

BOOK_ORDER = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
    "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
    "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles",
    "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
    "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah",
    "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
]

# **[[Genesis 1#^v1|Genesis 1:1-2]]** or **Genesis 1:1-2** alone on a line
ENTRY_RE = re.compile(r"^\*\*(\[\[[^\]]+\]\]|[^*\[\]]+)\*\*\s*$")
# - **[[...|Ref]]** at precept indent
PRECEPT_HEAD_RE = re.compile(r"^\s+-\s+\*\*(\[\[[^\]]+\]\]|[^*\[\]]+)\*\*\s*$")
TRANSCLUDE_RE = re.compile(r"!\[\[([^\]|]+)\]\]")
WIKILINK_RE = re.compile(r"\[\[(?:[^\]|]+\|)?([^\]|]+)\]\]")
VERSE_LINE_RE = re.compile(r"^(\d+ .*?)\s*\^v(\d+)\s*$")


def link_display(token):
    """'[[Genesis 1#^v1|Genesis 1:1-2]]' -> 'Genesis 1:1-2'; plain text passes through."""
    m = WIKILINK_RE.fullmatch(token.strip())
    return m.group(1).strip() if m else token.strip()


def strip_links(text):
    """Replace wikilinks with their display text for term matching."""
    return WIKILINK_RE.sub(lambda m: m.group(1), text)


class Entry:
    def __init__(self, token, doc, book):
        self.token = token            # original bold token, e.g. [[Genesis 2#^v1|Genesis 2:1-3]]
        self.ref = link_display(token)
        self.doc = doc                # e.g. "Genesis 1-4"
        self.book = book
        self.anchors = []             # transcluded verse anchors, e.g. "Genesis 2#^v1"
        self.bullets = []             # top-level teaching bullets, verbatim (no "- ")
        self.precepts = []            # (token, ref, [anchors], note)


def load_bible(bible_dir):
    """Map 'Genesis 2#^v1' -> verse text, from every Bible chapter file."""
    verses = {}
    for path in bible_dir.glob("*/*.md"):
        stem = path.stem
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            m = VERSE_LINE_RE.match(line.strip())
            if m:
                verses[f"{stem}#^v{m.group(2)}"] = m.group(1)
    return verses


def parse_doc(path, book):
    doc = path.stem.replace(" Study Notes", "")
    entries = []
    current = None
    precept = None
    in_precepts = False

    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.rstrip()
        stripped = line.strip()

        if line.startswith("#"):
            in_precepts = False
            precept = None
            continue

        m = ENTRY_RE.match(line)
        if m:
            current = Entry(m.group(1), doc, book)
            entries.append(current)
            in_precepts = False
            precept = None
            continue

        if current is None:
            continue

        if stripped == "Precepts:":
            in_precepts = True
            precept = None
            continue

        if in_precepts:
            pm = PRECEPT_HEAD_RE.match(line)
            if pm:
                token = pm.group(1)
                precept = [token, link_display(token), [], ""]
                current.precepts.append(precept)
                continue
            if precept is not None and line.startswith(" "):
                tm = TRANSCLUDE_RE.search(stripped)
                if tm:
                    precept[2].append(tm.group(1))
                elif stripped and not stripped.startswith("-"):
                    precept[3] = (precept[3] + " " + stripped).strip()
                continue
            if not line.strip():
                continue
            in_precepts = False
            precept = None
            # fall through to entry-level handling

        tm = TRANSCLUDE_RE.search(stripped)
        if tm and stripped.startswith("!"):
            current.anchors.append(tm.group(1))
            continue
        if line.startswith("- "):
            current.bullets.append(line[2:].strip())
        elif line.startswith("  ") and stripped.startswith("- ") and current.bullets:
            current.bullets[-1] += " " + stripped[2:].strip()

    return entries


def compile_terms(terms):
    return [re.compile(r"\b" + re.escape(t.strip()) + r"\b", re.IGNORECASE)
            for t in terms if t.strip()]


def entry_matches(entry, pats, verses):
    mb = [b for b in entry.bullets if any(p.search(strip_links(b)) for p in pats)]
    mp = []
    for token, ref, anchors, note in entry.precepts:
        text = " ".join([ref, note] + [verses.get(a, "") for a in anchors])
        if any(p.search(text) for p in pats):
            mp.append((token, ref, note))
    verse_text = " ".join([entry.ref] + [verses.get(a, "") for a in entry.anchors])
    vh = any(p.search(verse_text) for p in pats)
    return mb, mp, vh


def doc_sort_key(doc):
    m = re.search(r"(\d+)(?:-\d+)?$", doc)
    return int(m.group(1)) if m else 0


def build(root):
    notes_dir = root / "content" / "Study Bible"
    bible_dir = root / "content" / "Bible"
    lexicon_path = root / "_tools" / "lexicon.tsv"
    out_dir = root / "content" / "Encyclopedia"
    for p in (notes_dir, bible_dir, lexicon_path):
        if not p.exists():
            sys.exit(f"not found: {p} (run from the repo root)")

    topics = []
    with lexicon_path.open(encoding="utf-8-sig") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            topics.append({
                "topic": row["topic"].strip(),
                "summary": row["summary"].strip(),
                "pats": compile_terms(row["terms"].split(";")),
            })

    verses = load_bible(bible_dir)

    # Book folders may carry a canonical "NN - " prefix (e.g. "01 - Genesis")
    book_dirs = {}
    for d in notes_dir.iterdir():
        if d.is_dir():
            book_dirs[re.sub(r"^\d+ - ", "", d.name)] = d

    all_entries = []
    for book in BOOK_ORDER:
        book_dir = book_dirs.get(book)
        if book_dir is None:
            continue
        docs = sorted(book_dir.glob("*/*Study Notes.md"),
                      key=lambda p: doc_sort_key(p.stem.replace(" Study Notes", "")))
        for path in docs:
            all_entries.extend(parse_doc(path, book))

    out_dir.mkdir(exist_ok=True)

    index_lines = [
        "# Encyclopedia",
        "",
        "Topical entries built from the study notes by _tools/build_encyclopedia.py.",
        "Grow the lexicon in _tools/lexicon.tsv and rerun the script after each new chapter set.",
        "",
    ]

    for t in topics:
        lines = [f"# {t['topic']}", "", t["summary"], ""]
        count = 0
        current_book = None

        for e in all_entries:
            mb, mp, vh = entry_matches(e, t["pats"], verses)
            if not (mb or mp or (vh and e.bullets)):
                continue
            count += 1
            if e.book != current_book:
                current_book = e.book
                lines += [f"## {e.book}", ""]

            lines.append(f"**{e.token}**  taught in [[{e.doc} Study Notes|{e.doc}]]")
            lines.append("")
            for b in (mb if mb else e.bullets):
                lines.append(f"- {b}")
            for token, _ref, note in mp:
                if note:
                    lines.append(f"- Precept **{token}**: {note}")
                else:
                    lines.append(f"- Precept **{token}**.")
            lines.append("")

        if count == 0:
            lines += ["No entries found yet. Grow the lexicon or build more chapters.", ""]

        out_path = out_dir / f"{t['topic']}.md"
        out_path.write_text(BOM + "\n".join(lines).rstrip() + "\n",
                            encoding="utf-8", newline="\n")
        index_lines.append(f"- [[{t['topic']}]]  {count} references")
        print(f"{t['topic']}: {count} references")

    (out_dir / "_Index.md").write_text(BOM + "\n".join(index_lines) + "\n",
                                       encoding="utf-8", newline="\n")
    print(f"\nWrote {len(topics)} entries + _Index.md to {out_dir}")


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd())
