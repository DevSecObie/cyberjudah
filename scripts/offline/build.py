"""The offline library: the King James Bible (1611 order, with the Apocrypha) and every class's study
notes, for devices with no internet and little power.

  python3 scripts/offline/build.py [OUT]          # default OUT: dist/offline

writes three editions from data/ (nothing is fetched):

  OUT/html/   plain web pages, no scripts, small enough for feature phones and old browsers. Open
              index.html from a phone's storage or an SD card, or serve the folder from a camp hub.
  OUT/text/   plain text, one file per book, for the smallest devices.
  OUT/cyberjudah.zim
              the same pages as one file for Kiwix (Android, iPhone, Windows, Mac, Linux, and the
              kiwix-serve hub on a Raspberry Pi), with search. Needs `pip install libzim`; skipped
              without it.

Under each verse are the class notes on it: the class's own breakdown of the verse, and each
precept read to explain it with why. A verse read as a precept links back to the verse it explained.
"""
import datetime
import glob
import html
import json
import os
import re
import shutil
import struct
import sys
import zlib

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "scripts", "precepts"))
import classes as P  # noqa: E402  (reference parsing shared with the precept check)

# 1611 order: the Old Testament, the Apocrypha, then the New Testament, with the names AGENTS.md uses.
APOCRYPHA = ["1-esdras", "2-esdras", "tobit", "judith", "esther-greek", "wisdom-of-solomon", "sirach", "baruch",
             "epistle-of-jeremiah", "song-of-the-three-children", "susanna", "bel-and-the-dragon",
             "prayer-of-manasseh", "1-maccabees", "2-maccabees"]
NAMES = {"esther-greek": "Rest of Esther", "sirach": "Ecclesiasticus", "epistle-of-jeremiah": "Epistle of Jeremiah",
         "song-of-the-three-children": "Song of the Three Holy Children", "susanna": "History of Susanna",
         "prayer-of-manasseh": "Prayer of Manasses", "wisdom-of-solomon": "Wisdom of Solomon"}
CSS = """body{font:17px/1.5 Georgia,serif;max-width:40em;margin:0 auto;padding:.6em;color:#111;background:#fff}
a{color:#7a1f00}h1{font-size:1.3em}h2{font-size:1.1em;margin-top:1.4em}nav{font-size:.9em;margin:.4em 0}
.v{margin:.5em 0}.n{font-size:.8em;vertical-align:super;font-weight:bold}.note{margin:.3em 0 .8em .8em;padding-left:.6em;border-left:3px solid #c9a227;font-size:.93em}
.src{font-size:.82em;color:#555}ul.grid{list-style:none;padding:0}ul.grid li{display:inline-block;margin:.2em .5em .2em 0}
@media (prefers-color-scheme:dark){body{background:#111;color:#eee}a{color:#f0b37e}.src{color:#aaa}}"""


def esc(s):
    return html.escape(str(s), quote=True)


def paras(text):
    return "".join(f"<p>{esc(p)}</p>" for p in str(text).split("\n\n") if p.strip())


def page(title, body, up=""):
    return (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{esc(title)}</title><link rel="stylesheet" href="{up}style.css"></head><body>{body}</body></html>')


def books():
    index = {b["slug"]: b for b in P.INDEX}
    ot = [b["slug"] for b in P.INDEX[:39]]
    nt = [b["slug"] for b in P.INDEX[39:66]]
    order = ot + [s for s in APOCRYPHA if s in index] + nt
    return [(s, NAMES.get(s, index[s]["book"]), index[s]["chapters"]) for s in order]


def load_classes():
    out = []
    for f in sorted(glob.glob(os.path.join(P.DIR, "*.json"))):
        d = json.load(open(f, encoding="utf-8"))
        out.append(d)
    out.sort(key=lambda d: (d.get("date") or "", d["video"]), reverse=True)
    return out


def notes_by_verse(cls):
    """(slug, chapter, verse) -> notes on that verse; and precept verses -> where they were read."""
    on, read = {}, {}
    for d in cls:
        for p in d["passages"]:
            opened = P.parse(p["opened"])
            if not opened:
                continue
            slug, ch, vs = opened
            who = p.get("teacher") or d.get("teacher") or ""
            src = {"video": d["video"], "title": d["title"], "date": d.get("date", ""), "who": who, "ts": p.get("ts", ""), "opened": p["opened"]}
            for s in p.get("sense", []):
                for v in P.at_verses(s["at"], opened) or []:
                    on.setdefault((slug, ch, v), []).append({**src, "kind": "sense", "text": s["text"]})
            for q in p.get("precepts", []):
                at = P.at_verses(q["at"], opened) or []
                for v in at[:1]:
                    on.setdefault((slug, ch, v), []).append({**src, "kind": "precept", "ref": q["ref"], "text": q["why"]})
                pr = P.parse(q["ref"])
                if pr and at:
                    for v in pr[2]:
                        read.setdefault((pr[0], pr[1], v), []).append({**src, "to": (slug, ch, at[0])})
    return on, read


def ref_link(slug, ch, v, names, up):
    return f'<a href="{up}c/{slug}-{ch}.html#v{v}">{esc(names[slug])} {ch}:{v}</a>'


def source_line(n, up):
    bits = [f'<a href="{up}class/{n["video"]}.html">{esc(n["title"])}</a>']
    if n["date"]:
        bits.append(esc(n["date"]))
    if n["who"]:
        bits.append(esc(n["who"]))
    if n["ts"]:
        bits.append(f"at {esc(n['ts'])}")
    return f'<div class="src">{" · ".join(bits)}</div>'


def build_html(out, bks, cls, on, read):
    names = {s: n for s, n, _ in bks}
    os.makedirs(os.path.join(out, "b"), exist_ok=True)
    os.makedirs(os.path.join(out, "c"), exist_ok=True)
    os.makedirs(os.path.join(out, "class"), exist_ok=True)
    with open(os.path.join(out, "style.css"), "w", encoding="utf-8") as f:
        f.write(CSS)
    pages = []  # (path, title) for the ZIM
    groups = [("Old Testament", bks[:39]), ("Apocrypha", bks[39:-27]), ("New Testament", bks[-27:])]
    body = ["<h1>CyberJudah</h1><p>The King James Bible (1611, with the Apocrypha), with what the classes taught on each verse. Works without internet.</p>",
            f'<nav><a href="classes.html">Classes ({len(cls)})</a> · <a href="glossary.html">Glossary</a></nav>']
    for label, group in groups:
        body.append(f"<h2>{label}</h2><ul class=grid>" + "".join(f'<li><a href="b/{s}.html">{esc(n)}</a></li>' for s, n, _ in group) + "</ul>")
    write(out, "index.html", page("CyberJudah", "".join(body)), pages, "CyberJudah")
    for i, (slug, name, n) in enumerate(bks):
        chs = P.chapters(slug)
        nums = sorted(int(k) for k in chs)
        noted = {c for (s, c, _) in on if s == slug}
        items = "".join(f'<li><a href="../c/{slug}-{c}.html">{c}{"*" if c in noted else ""}</a></li>' for c in nums)
        write(out, f"b/{slug}.html", page(name, f'<nav><a href="../index.html">Books</a></nav><h1>{esc(name)}</h1><ul class=grid>{items}</ul><p class=src>* has class notes</p>', "../"), pages, name)
        for j, c in enumerate(nums):
            verses = chs[str(c)]
            prev = f'<a href="{slug}-{nums[j - 1]}.html">‹ {nums[j - 1]}</a>' if j > 0 else ""
            nxt = f'<a href="{slug}-{nums[j + 1]}.html">{nums[j + 1]} ›</a>' if j + 1 < len(nums) else ""
            nav = f'<nav><a href="../index.html">Books</a> · <a href="../b/{slug}.html">{esc(name)}</a> {prev} {nxt}</nav>'
            rows = []
            for v, text in enumerate(verses, 1):
                rows.append(f'<div class=v id="v{v}"><span class=n>{v}</span> {esc(text)}</div>')
                for nt in on.get((slug, c, v), []):
                    head = f"<b>Read with it: {esc(nt['ref'])}</b>" if nt["kind"] == "precept" else ""
                    rows.append(f'<div class=note>{head}{paras(nt["text"])}{source_line(nt, "../")}</div>')
                for r in read.get((slug, c, v), [])[:6]:
                    rows.append(f'<div class="note src">Read in “{esc(r["title"])}” to explain {ref_link(*r["to"], names, "../")}</div>')
            write(out, f"c/{slug}-{c}.html", page(f"{name} {c}", f"{nav}<h1>{esc(name)} {c}</h1>{''.join(rows)}{nav}", "../"), pages, f"{name} {c}")
    rows = []
    for d in cls:
        rows.append(f'<li><a href="class/{d["video"]}.html">{esc(d["title"])}</a> <span class=src>{esc(d.get("date", ""))}</span></li>')
        body = [f'<nav><a href="../index.html">Books</a> · <a href="../classes.html">Classes</a></nav><h1>{esc(d["title"])}</h1>',
                f'<p class=src>{esc(d.get("date", ""))}{" · " + esc(d["teacher"]) if d.get("teacher") else ""} · youtube.com/watch?v={esc(d["video"])}</p>']
        for p in d["passages"]:
            opened = P.parse(p["opened"])
            link = ref_link(opened[0], opened[1], opened[2][0], names, "../") if opened else esc(p["opened"])
            body.append(f'<h2>{esc(p["opened"])}</h2><p class=src>{link}{" · " + esc(p["teacher"]) if p.get("teacher") else ""}{" · at " + esc(p["ts"]) if p.get("ts") else ""}</p>')
            for s in p.get("sense", []):
                body.append(f'<div class=note><b>Verse {esc(s["at"])}</b>{paras(s["text"])}</div>')
            for q in p.get("precepts", []):
                body.append(f'<div class=note><b>{esc(q["ref"])} (verse {esc(q["at"])})</b>{paras(q["why"])}</div>')
        write(out, f"class/{d['video']}.html", page(d["title"], "".join(body), "../"), pages, d["title"])
    write(out, "classes.html", page("Classes", f'<nav><a href="index.html">Books</a></nav><h1>Classes</h1><ul>{"".join(rows)}</ul>'), pages, "Classes")
    g = json.load(open(os.path.join(ROOT, "data", "glossary.json"), encoding="utf-8"))
    entries = sorted(g.get("entries", []), key=lambda e: e["term"].lower())
    body = [f'<nav><a href="index.html">Books</a></nav><h1>Glossary</h1><p>{esc(g.get("about", ""))}</p>']
    for e in entries:
        aka = f' <span class=src>({esc(", ".join(e.get("aliases", [])))})</span>' if e.get("aliases") else ""
        body.append(f'<h2 id="{esc(e["slug"])}">{esc(e["term"])}{aka}</h2>{paras(e.get("definition", ""))}')
    write(out, "glossary.html", page("Glossary", "".join(body)), pages, "Glossary")
    return pages


def write(out, path, text, pages, title):
    with open(os.path.join(out, path), "w", encoding="utf-8") as f:
        f.write(text)
    pages.append((path, title))


def build_text(out, bks, on):
    os.makedirs(out, exist_ok=True)
    for i, (slug, name, n) in enumerate(bks, 1):
        lines = [name.upper(), ""]
        for c in sorted(int(k) for k in P.chapters(slug)):
            lines.append(f"{name} {c}")
            for v, text in enumerate(P.chapters(slug)[str(c)], 1):
                lines.append(f"{c}:{v} {text}")
                for nt in on.get((slug, c, v), []):
                    head = f"  [Read with it: {nt['ref']}] " if nt["kind"] == "precept" else "  [Note] "
                    lines.append(head + " ".join(str(nt["text"]).split()) + f" ({nt['title']}, {nt['date']})")
            lines.append("")
        with open(os.path.join(out, f"{i:02d}-{slug}.txt"), "w", encoding="utf-8") as f:
            f.write("\n".join(lines))


def png(w, h, rgb):
    raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def build_zim(path, html_dir, pages):
    try:
        from libzim.writer import Creator, Item, StringProvider, FileProvider, Hint
    except ImportError:
        print("libzim not installed: skipping the Kiwix file (pip install libzim)")
        return False

    class Page(Item):
        def __init__(self, p, title, mime):
            super().__init__()
            self.p, self.t, self.m = p, title, mime
        def get_path(self): return self.p
        def get_title(self): return self.t
        def get_mimetype(self): return self.m
        def get_contentprovider(self): return FileProvider(os.path.join(html_dir, self.p))
        def get_hints(self): return {Hint.FRONT_ARTICLE: self.m == "text/html"}

    if os.path.exists(path):
        os.remove(path)
    with Creator(path).config_indexing(True, "eng").config_clustersize(2048) as z:
        z.set_mainpath("index.html")
        z.add_illustration(48, png(48, 48, (122, 31, 0)))
        for k, v in {"Name": "cyberjudah_en_all", "Title": "CyberJudah", "Language": "eng", "Creator": "CyberJudah",
                     "Publisher": "CyberJudah", "Date": datetime.date.today().isoformat(), "Tags": "bible;kjv;apocrypha",
                     "Description": "The KJV 1611 with the Apocrypha, and the class study notes on each verse."}.items():
            z.add_metadata(k, v)
        z.add_item(Page("style.css", "", "text/css"))
        for p, title in pages:
            z.add_item(Page(p, title, "text/html"))
    return True


def main():
    out = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "dist", "offline"))
    if os.path.isdir(out):
        shutil.rmtree(out)
    bks, cls = books(), load_classes()
    on, read = notes_by_verse(cls)
    pages = build_html(os.path.join(out, "html"), bks, cls, on, read)
    build_text(os.path.join(out, "text"), bks, on)
    zim = build_zim(os.path.join(out, "cyberjudah.zim"), os.path.join(out, "html"), pages)
    size = lambda p: sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(p) for f in fs) if os.path.isdir(p) else os.path.getsize(p)
    print(f"{len(bks)} books, {len(cls)} classes, {sum(len(v) for v in on.values())} verse notes")
    print(f"html: {len(pages)} pages, {size(os.path.join(out, 'html')) / 1e6:.1f} MB")
    print(f"text: {size(os.path.join(out, 'text')) / 1e6:.1f} MB")
    if zim:
        print(f"zim: {size(os.path.join(out, 'cyberjudah.zim')) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
