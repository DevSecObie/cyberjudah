#!/usr/bin/env python3
"""Class precept passes: the precepts, and the class's own breakdown of each scripture it
opened, for a class that has no study note yet. One file per class, written by a person or
an agent (see AGENTS.md), at data/precepts/classes/<video id>.json:

  {"video": "...", "title": "...", "date": "YYYY-MM-DD", "teacher": "",
   "passages": [{"opened": "Isaiah 61:1-3", "ts": "29:11",
                 "sense":    [{"at": "1", "text": "..."}],
                 "precepts": [{"ref": "Luke 21:24", "at": "1", "why": "..."}]}]}

  python3 scripts/precepts/classes.py check [FILE ...]   # validate (all files when none given)
  python3 scripts/precepts/classes.py next [N]           # the next classes to do, newest first

`check` is what the pull-request check runs. It fails on: invalid JSON or shape; a video
with no transcript; a reference that is not a real verse; an `at` outside its passage;
timestamps that go backwards; a quote (in curly quotes) that is not word for word the King
James text of a verse in that passage's books and chapters; an empty breakdown.
"""
import glob
import json
from datetime import date
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DIR = os.path.join(ROOT, "data", "precepts", "classes")
INDEX = json.load(open(os.path.join(ROOT, "data", "bible", "index.json"), encoding="utf-8"))
# The 1611 names the app shows, and common short forms, for the data set's books.
ALIASES = {
    "ecclesiasticus": "sirach", "sirach": "sirach", "wisdom of sirach": "sirach",
    "rest of esther": "esther-greek", "the rest of esther": "esther-greek", "additions to esther": "esther-greek", "esther (greek)": "esther-greek",
    "wisdom": "wisdom-of-solomon", "the wisdom of solomon": "wisdom-of-solomon",
    "song of the three holy children": "song-of-the-three-children", "the song of the three holy children": "song-of-the-three-children",
    "history of susanna": "susanna", "the history of susanna": "susanna",
    "prayer of manasses": "prayer-of-manasseh", "the prayer of manasses": "prayer-of-manasseh",
    "epistle of jeremy": "epistle-of-jeremiah", "the epistle of jeremiah": "epistle-of-jeremiah",
    "psalm": "psalms", "song of songs": "song-of-solomon", "canticles": "song-of-solomon",
    "revelations": "revelation", "the revelation": "revelation",
    "i esdras": "1-esdras", "ii esdras": "2-esdras", "i maccabees": "1-maccabees", "ii maccabees": "2-maccabees",
}
BY_NAME = {e["book"].lower(): e["slug"] for e in INDEX}
_bible = {}


def chapters(slug):
    if slug not in _bible:
        with open(os.path.join(ROOT, "data", "bible", f"{slug}.json"), encoding="utf-8") as source:
            _bible[slug] = json.load(source)["chapters"]
    return _bible[slug]


def book_slug(name):
    n = re.sub(r"\s+", " ", name.strip().lower().replace(".", ""))
    n = re.sub(r"^(first|1st)\s", "1 ", n)
    n = re.sub(r"^(second|2nd)\s", "2 ", n)
    n = re.sub(r"^(third|3rd)\s", "3 ", n)
    return BY_NAME.get(n) or ALIASES.get(n) or next((e["slug"] for e in INDEX if e["slug"] == n.replace(" ", "-")), None)


def parse(ref):
    """'Isaiah 61:1-3' -> (slug, chapter, [1, 2, 3]); a whole chapter -> every verse. None when not a real passage."""
    m = re.match(r"^\s*(.+?)\s+(\d+)(?::\s*([\d,\s\-–]+))?\s*$", str(ref))
    if not m:
        return None
    slug = book_slug(m.group(1))
    if not slug:
        return None
    ch = chapters(slug).get(m.group(2))
    if not ch:
        return None
    if not m.group(3):
        return slug, int(m.group(2)), list(range(1, len(ch) + 1))
    vs = []
    for part in re.split(r"\s*,\s*", m.group(3).strip()):
        a, _, b = part.replace("–", "-").partition("-")
        if not a.strip().isdigit() or (b and not b.strip().isdigit()):
            return None
        a, b = int(a), int(b) if b else int(a)
        if b < a or a < 1 or b > len(ch):
            return None
        vs += list(range(a, b + 1))
    return slug, int(m.group(2)), vs


def at_verses(at, passage):
    a, _, b = str(at).replace("–", "-").partition("-")
    if not a.strip().isdigit() or (b and not b.strip().isdigit()):
        return None
    vs = list(range(int(a), int(b or a) + 1))
    return vs if vs and set(vs) <= set(passage[2]) else None


def seconds(ts):
    if not re.match(r"^\d{1,2}(:\d{2}){1,2}$", str(ts or "")):
        return None
    parts = str(ts).split(":")
    if any(int(x) > 59 for x in parts[1:]):
        return None
    t = 0
    for x in parts:
        t = t * 60 + int(x)
    return t


def norm(s):
    return re.sub(r"\s+", " ", s.replace("’", "'").replace("‘", "'")).strip().lower()


def check(path):
    errs = []
    name = os.path.basename(path)
    try:
        with open(path, encoding="utf-8") as source:
            d = json.load(source)
    except ValueError as e:
        return [f"{name}: not valid JSON ({e})"]
    video = d.get("video", "")
    if name != f"{video}.json":
        errs.append(f"{name}: the file must be named after its video id ({video}.json)")
    if not os.path.exists(os.path.join(ROOT, "blog", "transcripts", f"{video}.json")):
        errs.append(f"{name}: no transcript for video {video!r} in blog/transcripts")
    for k in ("title", "date"):
        if not str(d.get(k, "")).strip():
            errs.append(f"{name}: missing {k}")
    try:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(d.get("date", ""))):
            raise ValueError()
        date.fromisoformat(d["date"])
    except (ValueError, TypeError):
        errs.append(f"{name}: date must be a real calendar date in YYYY-MM-DD")
    passages = d.get("passages")
    if not isinstance(passages, list) or not passages:
        return errs + [f"{name}: passages must be a non-empty list"]
    last = -1
    for i, p in enumerate(passages, 1):
        where = f"{name} passage {i} ({p.get('opened', '?')})"
        opened = parse(p.get("opened", ""))
        if not opened:
            errs.append(f"{where}: 'opened' is not a real King James passage")
            continue
        t = seconds(p.get("ts"))
        if t is None:
            errs.append(f"{where}: ts must be m:ss or h:mm:ss")
        elif t < last:
            errs.append(f"{where}: ts {p['ts']} goes back in time; keep passages in the order opened")
        else:
            last = t
        refs = [opened]
        for j, s in enumerate(p.get("sense", []) or [], 1):
            if not at_verses(s.get("at"), opened):
                errs.append(f"{where} sense {j}: at {s.get('at')!r} is not a verse of {p['opened']}")
            if not str(s.get("text", "")).strip():
                errs.append(f"{where} sense {j}: empty text")
        for j, pre in enumerate(p.get("precepts", []) or [], 1):
            if "ts" in pre and seconds(pre["ts"]) is None:
                errs.append(f"{where} precept {j}: ts must be m:ss or h:mm:ss, with minutes and seconds below 60")
            r = parse(pre.get("ref", ""))
            if not r:
                errs.append(f"{where} precept {j}: {pre.get('ref')!r} is not a real King James reference")
                continue
            refs.append(r)
            if not at_verses(pre.get("at"), opened):
                errs.append(f"{where} precept {j} ({pre['ref']}): at {pre.get('at')!r} is not a verse of {p['opened']}")
            if not str(pre.get("why", "")).strip():
                errs.append(f"{where} precept {j} ({pre['ref']}): empty why")
        # Quotes must be the King James words of the passage, a precept, or their chapters.
        text = norm(" ".join(v for slug, ch, _ in refs for v in chapters(slug)[str(ch)]))
        bodies = [s.get("text", "") for s in p.get("sense", []) or []] + [x.get("why", "") for x in p.get("precepts", []) or []]
        for body in bodies:
            for q in re.findall(r"“([^”]+)”", body):
                if norm(q).rstrip(".,;:!?") not in text:
                    errs.append(f"{where}: quote not word for word from the King James text of these chapters: “{q}”")
    return errs


def next_classes(n, book=None):
    """The next classes to pass, newest first; with a book, the classes that read the most
    verses of that book (from data/precepts/readings, scripts/precepts/readings.py) first."""
    sys.path.insert(0, os.path.join(ROOT, "scripts", "notes"))
    import auto  # noqa: E402
    done = {os.path.basename(f)[:-5] for f in glob.glob(os.path.join(DIR, "*.json"))}
    queue = [c for c in auto.queue("classes") if c["videoId"] not in done]
    if not book:
        return queue[:n]
    import prep  # noqa: E402
    name = prep.resolve_book(book)
    if not name:
        raise SystemExit(f"unknown book {book!r}")
    f = os.path.join(ROOT, "data", "precepts", "readings", f"{prep.SLUG[name]}.json")
    if not os.path.exists(f):
        raise SystemExit("no readings yet: run scripts/precepts/readings.py first")
    count = {}
    for vs in json.load(open(f)).values():
        for rows in vs.values():
            for vid, _ in rows:
                count[vid] = count.get(vid, 0) + 1
    ranked = sorted((c for c in queue if count.get(c["videoId"])), key=lambda c: (-count[c["videoId"]], c.get("date") or ""))
    for c in ranked:
        c["verses"] = count[c["videoId"]]
    return ranked[:n]


def series_classes(name):
    """A series of classes to pass in order (data/precepts/series.tsv), the ones done marked."""
    f = os.path.join(ROOT, "data", "precepts", "series.tsv")
    rows = [l.split("\t") for l in open(f, encoding="utf-8").read().splitlines()[1:] if l.strip()]
    done = {os.path.basename(x)[:-5] for x in glob.glob(os.path.join(DIR, "*.json"))}
    out = []
    for series, order, video, title, *rest in rows:
        if series != name: continue
        also = [a for a in (rest[0].split(",") if rest and rest[0] else []) if a]
        owner = rest[1] if len(rest) > 1 else ""
        out.append({"order": order, "videoId": video, "title": title, "also": also, "owner": owner, "done": video in done or any(a in done for a in also)})
    if not out:
        raise SystemExit(f"no series {name!r} in data/precepts/series.tsv")
    return out


def main():
    args = sys.argv[1:]
    if not args or args[0] == "check":
        files = args[1:] or sorted(glob.glob(os.path.join(DIR, "*.json")))
        errs = [e for f in files for e in check(f)]
        for e in errs:
            print("✗ " + e)
        print(f"{len(files)} class file(s) checked, {len(errs)} problem(s)")
        sys.exit(1 if errs else 0)
    if args[0] == "series":
        for c in series_classes(args[1] if len(args) > 1 else "revelation"):
            print(f"{'done ' if c['done'] else 'todo '} {c['order']:>4}  {c['videoId']}  {c['owner']:<7} {c['title']}" + (f"  (same class as {', '.join(c['also'])})" if c['also'] else ""))
        return
    if args[0] == "next":
        rest = args[1:]
        book = None
        if "--book" in rest:
            i = rest.index("--book"); book = rest[i + 1]; rest = rest[:i] + rest[i + 2:]
        for c in next_classes(int(rest[0]) if rest else 10, book):
            print(f"{c['date']}  {c['videoId']}  {c.get('cleanTitle') or c['title']}" + (f"  ({c['verses']} verses of {book})" if book else ""))
        return
    print(__doc__)
    sys.exit(2)


if __name__ == "__main__":
    main()
