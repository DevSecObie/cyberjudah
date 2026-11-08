"""Courses for the classes: one course per series (collection), built from the class notes.

    build_series.py                  every series course into dist/edx/classes/
    build_series.py --list           the courses it would make, with class counts

Where the classes come from: blog/ (IUIC classes and radio shows), captains/ (15 Minutes w/ The
Captains, Giving The Sense From A to Z, Contradict This) and history/notes/ (Our Hidden History).
A class's course is its `collection`, or else its show (the part of `description` before " · ").
Series with a single class go together in "More Classes".

How a class maps onto a course:

    course       the series                       Our Hidden History
    section      a year (30 classes at most)      2020
    subsection   one class                        Eve of Destruction and the Religion of Rebellion
    unit         the whole class (video), then    Watch the class
                 one per part of the note         Introduction / 1 Corinthians 11:1-3 / In Closing

Every lesson unit plays only its own clip of the class: from the timestamp where that scripture is
opened to where the next one starts (Open edX's start_time and end_time on a YouTube video), so a
student never has to scrub through a 3 hour class. Nothing is downloaded; the clip is YouTube.

Also builds "Revelation, chapter by chapter" from data/precepts/series.tsv.
"""
import argparse, collections, glob, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import olx  # noqa: E402
from build_course import ROOT, BLOCK, render, chapter_text  # noqa: E402

SOURCES = ["blog", "captains", os.path.join("history", "notes")]
PER_SECTION = 30
SKIP_HEADINGS = {"Scriptures Opened", "Readings and Scriptures"}  # containers, not lessons
DROP_HEADINGS = {"Announcements & References"}                    # dated notices and outside links
VIDEO = re.compile(r'data-video-id="([^"]+)"')
STAMP = re.compile(r"[?&]t=(\d+)s")
STAMP_TEXT = re.compile(r"\s*\*\[\[[^\]]+\]\([^)]+\)\]\*\s*")


def read_class(path):
    text = open(path, encoding="utf-8").read()
    meta, body = {}, text
    if text.startswith("---"):
        head, body = text[3:].split("\n---", 1)
        for line in head.strip().splitlines():
            k, _, v = line.partition(":")
            v = v.strip()
            meta[k.strip()] = v.strip('"') if not v.startswith("[") else v
    m = VIDEO.search(body)
    meta["video"] = m.group(1) if m else None
    meta["path"] = path
    return meta, body


def series_of(meta):
    name = meta.get("collection") or meta.get("description", "").split(" · ")[0] or "Classes"
    return name.split(" · ")[0].strip()


def lessons(body):
    """(title, lines) for each part of a class note, in order."""
    lines = body.splitlines()
    out, title, cur, dropping = [], None, [], False

    def flush():
        if title and any(l.strip() and not l.strip().startswith("<") for l in cur):
            out.append((title, cur))

    i = 0
    while i < len(lines):
        line = lines[i]
        s = line.strip()
        if s.startswith("## "):
            h = s[3:].strip()
            if h in SKIP_HEADINGS:
                dropping = False
                i += 1
                continue
            flush()
            dropping = h in DROP_HEADINGS
            title, cur = (None, []) if dropping else (h, [])
        elif dropping:
            pass
        elif BLOCK.match(s):
            flush()
            title, cur = BLOCK.match(s).group(1), [line]
        elif s == '<div class="reading">':
            flush()
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            head = STAMP_TEXT.sub("", lines[j]).strip() if j < len(lines) else "Reading"
            head = re.sub(r"\*", "", head)
            title, cur = (head if len(head) <= 80 else head[:77].rsplit(" ", 1)[0] + "..."), []
        elif title is not None:
            cur.append(line)
        i += 1
    flush()
    return out


def first_stamp(lines):
    for l in lines:
        m = STAMP.search(l)
        if m:
            return int(m.group(1))
    return None


def add_class(sec, meta, body):
    title = meta.get("title", "Class")
    sub = sec.subsection(title, uid=f"c-{olx.slug(meta['path'].split(os.sep)[-1][:-3], 70)}")
    vid = meta.get("video")
    about = []
    if meta.get("teacher"):
        about.append(f"<p><strong>{olx.html.escape(meta['teacher'])}</strong></p>")
    if meta.get("description"):
        about.append(f"<p>{olx.html.escape(meta['description'])}</p>")
    sub.unit("Watch the class", html="\n".join(about) or None, video=vid)
    parts = lessons(body)
    stamps = [first_stamp(ls) for _, ls in parts]
    for n, (t, ls) in enumerate(parts):
        start = stamps[n]
        end = next((s for s in stamps[n + 1:] if s and start and s > start), None)
        clip = (vid, start, end) if vid and start is not None else None
        # the heading line of a scripture block is the unit title already
        body_lines = ls[1:] if ls and BLOCK.match(ls[0].strip()) else ls
        sub.unit(t, html=render(body_lines) or None, video=clip)
    return sub


def all_classes():
    classes = []
    for src in SOURCES:
        for path in sorted(glob.glob(os.path.join(ROOT, src, "*", "*.md"))):
            meta, body = read_class(path)
            if meta.get("date"):
                classes.append((meta, body))
    return classes


def grouped():
    groups = collections.defaultdict(list)
    for meta, body in all_classes():
        groups[series_of(meta)].append((meta, body))
    small = [k for k, v in groups.items() if len(v) < 2]
    for k in small:
        groups["More Classes"] += groups.pop(k)
    for v in groups.values():
        v.sort(key=lambda mb: (mb[0]["date"], mb[0].get("episode", ""), mb[0].get("title", "")))
    return dict(sorted(groups.items()))


def code_for(name):
    return "CL" + re.sub(r"[^A-Za-z0-9]", "", name).upper()[:24]


def build_series(name, items):
    teachers = sorted({m.get("teacher") for m, _ in items if m.get("teacher")})
    years = sorted({m["date"][:4] for m, _ in items})
    span = years[0] if years[0] == years[-1] else f"{years[0]}-{years[-1]}"
    about = (f"The {name} classes, {len(items)} in all ({span}), each with its video and the notes on "
             f"every scripture opened. Each lesson plays its own clip of the class.")
    if teachers:
        about += " Taught by " + ", ".join(teachers[:6]) + ("." if len(teachers) <= 6 else " and others.")
    c = olx.Course(code_for(name), name, about=about, kind="class", subtitle=f"Classes · {span}",
                   short=f"{len(items)} classes from {name}, with notes and video clips.")
    by_year = collections.OrderedDict()
    for meta, body in items:
        by_year.setdefault(meta["date"][:4], []).append((meta, body))
    for year, cls in by_year.items():
        chunks = [cls[i:i + PER_SECTION] for i in range(0, len(cls), PER_SECTION)]
        for n, chunk in enumerate(chunks, 1):
            label = year if len(chunks) == 1 else f"{year}, part {n}"
            sec = c.section(label, uid=f"y{year}-{n}")
            for meta, body in chunk:
                add_class(sec, meta, body)
    return c


def build_revelation():
    rows = [l.rstrip("\n").split("\t") for l in open(os.path.join(ROOT, "data", "precepts", "series.tsv"), encoding="utf-8")]
    head, rows = rows[0], [dict(zip(rows[0], r)) for r in rows[1:]]
    rows = sorted((r for r in rows if r["series"] == "revelation"), key=lambda r: float(r["order"]))
    c = olx.Course("CLREVELATION", "Revelation, Chapter by Chapter", kind="class", subtitle="Class series",
                   about="The class series on the book of Revelation, one class per chapter, with the whole "
                         "chapter to read alongside it.",
                   short="One class per chapter of Revelation, with the chapter text.")
    sec = c.section("Revelation", uid="rev")
    for n, r in enumerate(rows, 1):
        ch = int(float(r["order"]))  # 9.2 is a second class on chapter 9
        sub = sec.subsection(r["title"], uid=f"rev-{n:02d}")
        sub.unit("Watch the class", video=r["video"])
        text = chapter_text("revelation", ch)
        if text:
            sub.unit(f"Read Revelation {ch}", html=text)
    return c


def courses():
    out = [build_series(name, items) for name, items in grouped().items()]
    out.append(build_revelation())
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default=os.path.join(ROOT, "dist", "edx", "classes"))
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()
    if a.list:
        for name, items in grouped().items():
            print(f"{len(items):4d}  {code_for(name):28s} {name}")
        return
    for c in courses():
        path = os.path.join(a.out, f"{olx.slug(c.name)}.tar.gz")
        olx.write_tar(c.files(), path)
        print(f"{path}: {c.key}")


if __name__ == "__main__":
    main()
