"""Topic courses: The Law, the Encyclopedia and the Precepts.

    build_topics.py                  dist/edx/the-law.tar.gz, encyclopedia.tar.gz, precepts.tar.gz

    The Law          data/handbook.json     section per part (22), subsection per section,
                                            one unit with every law in it and its scripture
    Encyclopedia     docs/encyclopedia/     section per subject, subsection per book of the
                                            Bible, unit per passage with what was taught on it
    Precepts         data/precepts.json     section per letter, subsection per topic, the
                                            scriptures that go together on that topic, in full
"""
import argparse, collections, glob, html, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import olx  # noqa: E402
from build_course import ROOT, render  # noqa: E402

_BOOKS, _TEXT = None, {}


def verses(book, chapter, spec):
    """KJV text of e.g. ("Genesis", 2, "7-23") as (number, text) pairs; [] when not found."""
    global _BOOKS
    if _BOOKS is None:
        _BOOKS = {b["book"]: b["slug"] for b in json.load(open(os.path.join(ROOT, "data", "bible", "index.json")))}
    slug = _BOOKS.get(book)
    if not slug:
        return []
    if slug not in _TEXT:
        _TEXT[slug] = json.load(open(os.path.join(ROOT, "data", "bible", f"{slug}.json"), encoding="utf-8"))["chapters"]
    vs = _TEXT[slug].get(str(chapter)) or []
    want = []
    for part in str(spec or "").replace(" ", "").split(","):
        if not part:
            continue
        a, _, b = part.partition("-")
        if a.isdigit():
            want += range(int(a), int(b) + 1 if b.isdigit() else int(a) + 1)
    if not want:
        want = range(1, len(vs) + 1)
    return [(n, vs[n - 1]) for n in want if 0 < n <= len(vs)]


def ref_name(r):
    return f"{r['book']} {r['chapter']}" + (f":{r['verses']}" if r.get("verses") else "")


def passage(r):
    vs = verses(r["book"], r["chapter"], r.get("verses"))
    body = " ".join(f"<sup>{n}</sup> {html.escape(t, quote=False)}" for n, t in vs)
    return f"<p><strong>{html.escape(ref_name(r))}</strong></p>\n<blockquote><p>{body}</p></blockquote>" if body else \
           f"<p><strong>{html.escape(ref_name(r))}</strong></p>"


# ---------------------------------------------------------------- The Law

def build_law():
    h = json.load(open(os.path.join(ROOT, "data", "handbook.json"), encoding="utf-8"))
    total = sum(len(s["entries"]) for p in h["parts"] for s in p["sections"])
    c = olx.Course("LAW", "The Law", kind="topic", subtitle=f"{len(h['parts'])} parts · {total} laws",
                   about=(f"The laws, statutes and commandments of the Most High, gathered by subject into "
                          f"{len(h['parts'])} parts, each with the scripture it is written in."),
                   short="The commandments, statutes and judgments, by subject, with their scripture.")
    c.introduction(olx.intro_html(
        f"Welcome to The Law. This course sets out the laws, statutes and commandments of the Most High, "
        f"{total} in all, gathered by subject into {len(h['parts'])} parts, so you can learn what the law says "
        f"and where it is written.",
        [("Parts.", "Each section is one part of the law, beginning with the Ten Commandments."),
         ("The laws.", "Each subject lists its laws, numbered, each with its scripture reference."),
         ("The scripture.", "After the list, the scriptures behind those laws are printed in full."),
         ("Your progress.", "The Progress tab shows which parts you have finished.")]))
    for p in h["parts"]:
        sec = c.section(f"{p['n']}. {p['title']}", uid=f"law-{p['n']:02d}")
        for s in p["sections"]:
            sub = sec.subsection(f"{s['id']} {s['title']}", uid=f"law-{olx.slug(s['id'])}")
            rows = []
            for e in s["entries"]:
                cite = f' <em>({html.escape(e["citation"])})</em>' if e.get("citation") else ""
                rows.append(f"<li><strong>{s['id']}.{e['n']}</strong> {html.escape(e['text'], quote=False)}{cite}</li>")
            sub.unit(s["title"], html="<ul>\n" + "\n".join(rows) + "\n</ul>")
            # the scripture behind each law, in full, on its own page
            scripture = []
            for e in s["entries"]:
                for r in e.get("refs") or []:
                    scripture.append(passage(r))
            if scripture:
                sub.unit("The scripture", html="\n".join(dict.fromkeys(scripture)))
    return c


# ---------------------------------------------------------------- Encyclopedia

HEAD = re.compile(r"^\*\*\[([^\]]+)\]\([^)]+\)\*\*")


def build_encyclopedia():
    paths = sorted(glob.glob(os.path.join(ROOT, "docs", "encyclopedia", "*.md")))
    c = olx.Course("ENCYCLOPEDIA", "Encyclopedia", kind="topic", subtitle=f"{len(paths)} subjects",
                   about=("The great subjects of scripture, followed through the Bible book by book: every "
                          "passage on the subject with what was taught on it in the classes."),
                   short="Subjects of scripture followed book by book, with the teaching on each passage.")
    c.introduction(olx.intro_html(
        f"Welcome to the Encyclopedia. This course follows {len(paths)} great subjects of scripture, such as "
        "the Sabbath, the covenant and the feasts, through the Bible book by book.",
        [("Subjects.", "Each section is one subject."),
         ("Book by book.", "Within a subject, each book of the Bible where it appears is a lesson."),
         ("Passages.", "Each passage is its own page with what was taught on it in the classes.")]))
    for n, path in enumerate(paths, 1):
        meta, body = read_note_path(path)
        sec = c.section(meta.get("title", os.path.basename(path)[:-3]), uid=f"enc-{n:02d}")
        lines = body.splitlines()
        intro = []
        i = 0
        while i < len(lines) and not lines[i].startswith("## "):
            intro.append(lines[i])
            i += 1
        book, units = None, collections.OrderedDict()
        cur = None
        for line in lines[i:]:
            if line.startswith("## "):
                book = line[3:].strip()
                units[book] = []
                cur = None
            elif HEAD.match(line):
                cur = [HEAD.match(line).group(1), []]
                units[book].append(cur)
            elif cur is not None:
                cur[1].append(line)
        first = True
        for book, items in units.items():
            sub = sec.subsection(book, uid=f"enc-{n:02d}-{olx.slug(book)}")
            if first and any(l.strip() for l in intro):
                sub.unit("Introduction", html=render(intro))
                first = False
            for title, ls in items:
                sub.unit(title, html=render(ls))
    return c


def read_note_path(path):
    text = open(path, encoding="utf-8").read()
    meta, body = {}, text
    if text.startswith("---"):
        head, body = text[3:].split("\n---", 1)
        for line in head.strip().splitlines():
            k, _, v = line.partition(":")
            meta[k.strip()] = v.strip().strip('"')
    return meta, body.strip("\n")


# ---------------------------------------------------------------- Precepts

def build_precepts():
    topics = json.load(open(os.path.join(ROOT, "data", "precepts.json"), encoding="utf-8"))["topics"]
    c = olx.Course("PRECEPTS", "Precepts", kind="topic", subtitle=f"{len(topics)} topics",
                   about=(f"Precept upon precept: {len(topics)} topics, each with the scriptures that go "
                          "together on it, printed in full so they can be read side by side."),
                   short="Topic by topic, the scriptures that go together, in full.")
    by_letter = collections.OrderedDict()
    for t in sorted(topics, key=lambda t: t["title"].lower()):
        by_letter.setdefault(t["title"][0].upper(), []).append(t)
    c.introduction(olx.intro_html(
        f"Welcome to Precepts. Precept upon precept: this course gathers {len(topics)} topics, each with the "
        "scriptures that go together on it, so you can read them side by side and let scripture explain scripture.",
        [("A to Z.", "The topics run in alphabetical order, one section per letter."),
         ("The scriptures.", "Each topic prints its scriptures in full in the King James Version, with the "
                             "key scriptures first.")]))
    for letter, ts in by_letter.items():
        sec = c.section(letter, uid=f"pre-{olx.slug(letter) if letter.isalnum() else 'other'}")
        for t in ts:
            sub = sec.subsection(t["title"], uid=f"pre-{olx.slug(t['slug'])}")
            key = [r for r in t["refs"] if r.get("key")]
            rest = [r for r in t["refs"] if not r.get("key")]
            sub.unit(t["title"], html="\n".join(passage(r) for r in key + rest))
    return c


def courses():
    return [build_law(), build_encyclopedia(), build_precepts()]


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default=os.path.join(ROOT, "dist", "edx"))
    a = ap.parse_args()
    for c in courses():
        path = os.path.join(a.out, f"{olx.slug(c.name)}.tar.gz")
        olx.write_tar(c.files(), path)
        print(f"{path}: {c.key}")


if __name__ == "__main__":
    main()
