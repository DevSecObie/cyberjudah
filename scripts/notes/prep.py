#!/usr/bin/env python3
"""Turn a raw transcript into everything a note needs before a word of it is written.

    prep.py <raw-transcript.txt> --video <id> [--out DIR] [--quiet]

Does the deterministic half of the pipeline in scripts/notes/README.md, which is the half
that costs the most time by hand and is the easiest to get wrong:

  1. condenses the transcript (same output as condense.py)
  2. finds every scripture reference the teacher calls for, through the ASR mangling
  3. verifies each one against data/bible and reports the ones that do not resolve
  4. reads the teacher's name out of the self-introduction, if he gives one
  5. writes a brief: the metadata, the checked references, and the condensed text

What it deliberately does not do is write the note. The note is near-verbatim in the
teacher's own words, which is a judgement call on every line; this just means that by the
time anyone starts writing, every reference is already known good.

MEASURED, against two Sabbath classes whose references were collected by hand first:

    THE PIT AND PENDULUM  (tuned on)   15 found, 14 of 19 correct   74% recall
    INTEGRATED BUT DIVIDED (held out)  18 found, 17 of 29 correct   59% recall

Read that as: **this finds most of the references and never invents one, but it does not
find all of them.** The held-out number is the real one. It misses a call the recogniser
mangled past recognition ("Isaiah 33 and6", "verse1 15"), a book named in one breath and
its verse in the next, and every range the teacher reads through without announcing the
end verse. So it is a safety net under a human reading the transcript, not a substitute
for reading it. Raising recall wants a scored corpus of briefs and patient iteration; the
scorer this was measured with is the place to start.

Exit status is non-zero if any reference failed to resolve, so it can gate a pipeline.
"""
import json, os, re, sys, unicodedata

ROOT = os.environ.get("CJ_ROOT") or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
IDX = json.load(open(f"{ROOT}/data/bible/index.json"))
SLUG = {e["book"]: e["slug"] for e in IDX}
BOOKS = [e["book"] for e in IDX]

# ---------------------------------------------------------------- book names
# The transcripts are auto-captioned, so a book arrives however the recogniser heard it:
# "Mcabes", "Sarak", "limitation", "Ecclesiasticus" for Sirach, "First John" for 1 John.
# Spellings seen in the IUIC transcripts, plus the ordinary abbreviations.
ALIAS = {
    "psalm": "Psalms", "psalms": "Psalms",
    "ecclesiasticus": "Sirach", "sirach": "Sirach", "sarak": "Sirach", "sarach": "Sirach",
    "maccabees": "1 Maccabees", "mcabes": "1 Maccabees", "macabees": "1 Maccabees",
    "limitation": "Lamentations", "limitations": "Lamentations", "lamentation": "Lamentations",
    "revelations": "Revelation", "song of solomon": "Song of Solomon",
    "canticles": "Song of Solomon", "apocalypse": "Revelation",
    "esdras": "1 Esdras", "wisdom": "Wisdom of Solomon",
    "solomon": "Wisdom of Solomon", "jeremy": "Epistle of Jeremiah",
}
ORD = {"first": "1", "second": "2", "third": "3", "1st": "1", "2nd": "2", "3rd": "3",
       "i": "1", "ii": "2", "iii": "3", "one": "1", "two": "2"}
WORDNUM = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
           "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13,
           "fourteen": 14, "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18,
           "nineteen": 19, "twenty": 20}

def _norm(s):
    s = unicodedata.normalize("NFKD", s.lower()).replace("’", "'")
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return " ".join(s.split())

_LOOKUP = {}
for b in BOOKS:
    _LOOKUP[_norm(b)] = b
    # "1 Samuel" also answers to "first samuel" and "i samuel"
    m = re.match(r"^([123]) (.+)$", b)
    if m:
        for word, digit in ORD.items():
            if digit == m.group(1):
                _LOOKUP[_norm(f"{word} {m.group(2)}")] = b
for k, v in ALIAS.items():
    _LOOKUP.setdefault(_norm(k), v)

def resolve_book(raw):
    """A book name however it was heard, or None."""
    n = _norm(raw)
    if n in _LOOKUP:
        return _LOOKUP[n]
    for word, digit in ORD.items():                      # "second mcabes"
        if n.startswith(word + " "):
            rest = n[len(word) + 1:]
            for cand, book in _LOOKUP.items():
                if cand == rest and re.match(r"^[123] ", book):
                    return f"{digit} {book.split(' ', 1)[1]}"
            if rest in ALIAS:
                base = ALIAS[rest]
                stem = base.split(" ", 1)[1] if re.match(r"^[123] ", base) else base
                if f"{digit} {stem}" in SLUG:
                    return f"{digit} {stem}"
    return None

# ---------------------------------------------------------------- verse text
_chap = {}
def chapter(book, ch):
    if book not in _chap:
        _chap[book] = json.load(open(f"{ROOT}/data/bible/{SLUG[book]}.json"))["chapters"]
    return _chap[book].get(str(ch))

# ---------------------------------------------------------------- extraction
NUM = r"(?:\d{1,3}|" + "|".join(WORDNUM) + r")"
def _n(tok):
    tok = tok.strip().lower()
    return int(tok) if tok.isdigit() else WORDNUM.get(tok)

BOOKPAT = r"([1-3]?\s?[A-Za-z][A-Za-z'’]*(?:\s+of\s+(?:the\s+)?[A-Za-z]+)?(?:\s+[A-Za-z]+)?)"
PATTERNS = [
    # Zechariah 11:5   ·   2 Kings 8:7-15
    re.compile(BOOKPAT + r"\s+(\d{1,3})\s*[:∶]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?", re.I),
    # Job chapter 1 and verse 1   ·   Ecclesiasticus chapter 26 and verse 10
    re.compile(BOOKPAT + r"\s+chapter\s+(" + NUM + r")\s*(?:and\s+)?(?:verse|verses)\s+(" + NUM + r")(?:\s*(?:to|through|[-–])\s*(" + NUM + r"))?", re.I),
    # Job 1 and 1   ·   Revelation 12 and 10
    re.compile(BOOKPAT + r"\s+(\d{1,3})\s+and\s+(?:verse\s+)?(\d{1,3})\b", re.I),
]

def tidy(text):
    """Undo the ASR damage that hides a reference from the patterns above.

    The captions arrive with speaker arrows dropped mid-reference ("Revelation chapter 14 >>
    verse 12"), the word 'and' welded to its number ("Isaiah 33 and6"), and 'verse' carrying a
    stray digit from the next word ("verse1 15"). None of that changes what was said; all of it
    stops a regex. Only used for finding references, never for anything quoted.
    """
    t = re.sub(r"\s*>>\s*", " ", text)                        # speaker arrows
    t = re.sub(r"\b(and|verse|verses|chapter)(\d)", r"\1 \2", t, flags=re.I)   # and6 -> and 6
    t = re.sub(r"\b(verse|verses|chapter)\s*\d{1,2}\s+(\d{1,3})\b", r"\1 \2", t, flags=re.I)  # verse1 15 -> verse 15
    t = re.sub(r"\buh+\b|\bum+\b", " ", t, flags=re.I)        # filler between book and number
    return re.sub(r"[ \t]+", " ", t)

def extract(text):
    """Every (book, chapter, first, last, raw) the transcript calls for, in order."""
    text = tidy(text)
    out, seen = [], set()
    for pat in PATTERNS:
        for m in pat.finditer(text):
            book = resolve_book(m.group(1))
            if not book:
                continue
            ch, a = _n(m.group(2)), _n(m.group(3))
            b = _n(m.group(4)) if m.lastindex and m.lastindex >= 4 and m.group(4) else None
            if not ch or not a:
                continue
            key = (book, ch, a, b)
            if key in seen:
                continue
            seen.add(key)
            out.append({"book": book, "chapter": ch, "first": a, "last": b,
                        "raw": " ".join(m.group(0).split()), "at": m.start()})
    out.sort(key=lambda r: r["at"])
    return out

def verify(ref):
    """(ok, detail). Checks the chapter exists and the verses are in range."""
    body = chapter(ref["book"], ref["chapter"])
    if body is None:
        return False, f"{ref['book']} has no chapter {ref['chapter']}"
    last = ref["last"] or ref["first"]
    if ref["first"] > len(body) or last > len(body):
        return False, f"{ref['book']} {ref['chapter']} has {len(body)} verses, asked {ref['first']}-{last}"
    return True, f"{ref['book']} {ref['chapter']}:{ref['first']}" + (f"-{last}" if ref["last"] else "")

# ---------------------------------------------------------------- teacher
TITLE = r"(Bishop|Deacon|Captain|Elder|Officer)"
NAME = r"[A-Z][a-zA-Z'’-]+"
TEACHER_PATTERNS = [
    re.compile(rf"\b(?:my name is|i am|i'm) {TITLE} ({NAME})\b", re.I),
    re.compile(rf"\b(?:it is|this is) {TITLE} ({NAME})\b", re.I),
    re.compile(rf"\b{TITLE} ({NAME}),? (?:and i|here with|coming to you)\b", re.I),
]
def teacher_of(text):
    for pat in TEACHER_PATTERNS:
        m = pat.search(text)
        if m:
            return f"{m.group(1).capitalize()} {m.group(2)}", " ".join(m.group(0).split())
    return None, None

# ---------------------------------------------------------------- condense
def condense(src):
    body = src.split("# Transcript", 1)[1] if "# Transcript" in src else src
    rows = []
    for line in body.split("\n"):
        m = re.match(r"^\[(\d+(?:\.\d+)?)s\]\s*(.*)$", line.strip())
        if m:
            rows.append((float(m.group(1)), m.group(2).strip()))
    def mmss(s):
        s = int(s); h, rem = divmod(s, 3600); m, sec = divmod(rem, 60)
        return f"{h}:{m:02d}:{sec:02d}" if h else f"{m}:{sec:02d}"
    out, buf, start = [], [], None
    for t, txt in rows:
        if start is None:
            start = t
        buf.append(txt)
        if sum(len(x) + 1 for x in buf) > 700:
            out.append(f"[{mmss(start)}] " + " ".join(buf)); buf, start = [], None
    if buf:
        out.append(f"[{mmss(start)}] " + " ".join(buf))
    return out, len(rows)

# ---------------------------------------------------------------- main
def main(argv):
    if not argv or argv[0].startswith("-"):
        print(__doc__); return 2
    src_path = argv[0]
    video = (argv[argv.index("--video") + 1] if "--video" in argv else "")
    outdir = (argv[argv.index("--out") + 1] if "--out" in argv else os.path.dirname(os.path.abspath(src_path)))
    quiet = "--quiet" in argv
    raw = open(src_path, encoding="utf-8").read()

    paras, nlines = condense(raw)
    text = "\n\n".join(paras)
    stem = os.path.splitext(os.path.basename(src_path))[0]
    os.makedirs(outdir, exist_ok=True)
    cpath = os.path.join(outdir, f"{stem}.condensed.txt")
    open(cpath, "w", encoding="utf-8").write(text)

    refs = extract(text)
    ok, bad = [], []
    for r in refs:
        good, detail = verify(r)
        (ok if good else bad).append((r, detail))

    who, evidence = teacher_of(text[:12000])   # the introduction, if there is one

    lines = [f"# Brief: {stem}", ""]
    if video:
        lines.append(f"- video: `{video}`  ·  https://www.youtube.com/watch?v={video}")
    lines += [f"- transcript: {nlines} caption lines -> {len(paras)} paragraphs, {len(text)} chars",
              f"- condensed: `{os.path.relpath(cpath, ROOT)}`",
              f"- teacher: " + (f'`{who}`  (from "{evidence}")' if who else "**not stated in the opening — leave the field empty**"),
              f"- references found: {len(refs)}  ·  resolved {len(ok)}  ·  unresolved {len(bad)}", ""]
    if bad:
        lines += ["## Unresolved — fix before writing", ""]
        lines += [f"- `{r['raw']}` — {d}" for r, d in bad] + [""]
    lines += ["## References, verified against data/bible", "",
              "In the order the teacher calls for them. Every one below resolves; pass them to v.py or lib.py as-is.", ""]
    for r, d in ok:
        lines.append(f"- `{d}`" + (f"   ← heard as \"{r['raw']}\"" if _norm(r["raw"]) != _norm(d) else ""))
    lines.append("")

    bpath = os.path.join(outdir, f"{stem}.brief.md")
    open(bpath, "w", encoding="utf-8").write("\n".join(lines))

    if not quiet:
        print(f"{nlines} caption lines -> {len(paras)} paragraphs")
        print(f"teacher: {who or '(not stated)'}")
        print(f"references: {len(refs)} found, {len(ok)} resolved, {len(bad)} unresolved")
        for r, d in bad:
            print(f"  !! {r['raw']} — {d}")
        print(f"wrote {os.path.relpath(bpath, ROOT)}")
    return 1 if bad else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
