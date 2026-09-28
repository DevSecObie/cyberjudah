#!/usr/bin/env python3
"""The moments the classes read aloud from a library book, found by matching the recordings'
words against the book's pages: data/library/<slug>/reads.json.

  python3 scripts/library/reads.py <slug> [<slug> ...]      # or --all

A reading is a run of six-word phrases from one page heard within three minutes of each
other. Phrases that are also in the King James text do not count (the classes read scripture
constantly), nor do phrases found on three or more pages of the book (running heads, stock
phrases). A run of ten or more phrases stands on its own; a shorter run (four to nine)
counts only when the class names the book (`mention` in archive_book.py) within twenty
minutes of it. Pages of an index, bibliography or contents are not searched.

Old printings set the long s, which the OCR reads as "f" ("thofe", "confider"); for those
books (`long_s`) each such word is repaired to the spelling the classes and the King James
text actually use before matching.
"""
import collections
import glob
import itertools
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from archive_book import BOOKS, ROOT  # noqa: E402

N = 6
TOKEN = re.compile(r"[a-z0-9]+")
KJV_NGRAMS = set()
VOCAB = set()
_TX = None


def words(s):
    return TOKEN.findall(s.lower().replace("’", "").replace("'", ""))


def transcripts():
    """Every recording, tokenised once: [(video, title, date, six-word phrase hashes, their seconds, segments)]."""
    global _TX
    if _TX is None:
        from array import array
        _TX = []
        for f in sorted(glob.glob(os.path.join(ROOT, "blog", "transcripts", "*.json"))):
            t = json.load(open(f, encoding="utf-8"))
            segs = [(s[0], s[1].lower()) for s in t.get("segments") or []]
            toks = [(w, s[0]) for s in segs for w in words(s[1])]
            if len(toks) < N:
                continue
            VOCAB.update(w for w, _ in toks)
            ws = [w for w, _ in toks]
            grams = array("q", (hash(" ".join(ws[i:i + N])) for i in range(len(ws) - N + 1)))
            times = array("f", (t for _, t in toks[:len(grams)]))
            _TX.append((os.path.basename(f)[:-5], t.get("title", ""), t.get("date"), grams, times, segs))
        for f in glob.glob(os.path.join(ROOT, "data", "bible", "*.json")):
            if f.endswith("index.json"):
                continue
            for ch in json.load(open(f, encoding="utf-8"))["chapters"].values():
                w = words(" ".join(ch))
                VOCAB.update(w)
                KJV_NGRAMS.update(hash(" ".join(w[i:i + N])) for i in range(len(w) - N + 1))
    return _TX


def repair_long_s(w):
    """'thofe' -> 'those', when 'thofe' is not a word the classes or the King James use and 'those' is."""
    if w in VOCAB or "f" not in w[:-1]:
        return w
    spots = [i for i, ch in enumerate(w[:-1]) if ch == "f"][:4]
    for k in range(1, len(spots) + 1):
        for combo in itertools.combinations(spots, k):
            v = "".join("s" if i in combo else ch for i, ch in enumerate(w))
            if v in VOCAB:
                return v
    return w


def ts(t):
    h, m, s = t // 3600, t % 3600 // 60, t % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def find(slug):
    b = BOOKS[slug]
    d = os.path.join(ROOT, "data", "library", slug)
    book = json.load(open(os.path.join(d, "book.json"), encoding="utf-8"))
    pages = []
    for f in sorted(os.listdir(d), key=lambda x: (len(x), x)):
        if f == "pages.json" or re.fullmatch(r"pages-v\d+\.json", f):
            pages += json.load(open(os.path.join(d, f), encoding="utf-8"))
    skip = set()
    for c in book["chapters"]:
        if re.search(r"\b(index|bibliography|contents|table of)\b", c["title"], re.I):
            skip.update((c["vol"], p) for p in range(c["page"], c["end"] + 1))
    tx = transcripts()
    # Six-word phrases of each page, by hash; the book's own repeated phrases and scripture dropped.
    index = collections.defaultdict(set)
    for k, p in enumerate(pages):
        if (p["vol"], p["page"]) in skip:
            continue
        w = words(p["text"])
        if b.get("long_s"):
            w = [repair_long_s(x) for x in w]
        for i in range(len(w) - N + 1):
            h = hash(" ".join(w[i:i + N]))
            if h not in KJV_NGRAMS:
                index[h].add(k)
    index = {h: next(iter(ks)) for h, ks in index.items() if len(ks) == 1}
    mention = re.compile(b["mention"], re.I)
    reads = []
    for video, title, date, grams, times, segs in tx:
        hits = collections.defaultdict(list)  # page index -> [seconds]
        for i, g in enumerate(grams):
            k = index.get(g)
            if k is not None:
                hits[k].append(times[i])
        if not hits:
            continue
        # When the class names the book: a mention may run over two caption lines.
        mention_times = [segs[j][0] for j in range(len(segs)) if mention.search(segs[j][1] + " " + (segs[j + 1][1] if j + 1 < len(segs) else ""))]
        found = []
        for k, times in hits.items():
            times.sort()
            grp = [times[0]]
            for x in times[1:] + [None]:
                if x is not None and x - grp[-1] < 180:
                    grp.append(x); continue
                strong = len(grp) >= 10
                near = any(abs(mt - grp[0]) <= 1200 for mt in mention_times)
                if len(grp) >= 4 and (strong or near):
                    found.append({"k": k, "t": int(grp[0]), "hits": len(grp), "times": tuple(grp)})
                if x is not None:
                    grp = [x]
        # The same phrases on two pages of the book (identical hit times) point at neither; a reading that runs on to the next page keeps both.
        by_times = collections.Counter(f["times"] for f in found)
        for f in found:
            if by_times[f["times"]] > 1:
                continue
            p = pages[f["k"]]
            reads.append({"video": video, "vol": p["vol"], "page": p["page"], "t": f["t"], "ts": ts(f["t"]), "hits": f["hits"]})
    reads.sort(key=lambda r: (r["video"], r["t"]))
    json.dump({"about": "Moments in the classes where this book was read aloud: the class's video, the volume and printed page, and the second it was read. Found by matching the recordings against the book's text (scripts/library/reads.py).", "reads": reads},
              open(os.path.join(d, "reads.json"), "w", encoding="utf-8"), indent=1)
    print(f"{slug}: {len(reads)} readings in {len({r['video'] for r in reads})} classes, {len({(r['vol'], r['page']) for r in reads})} pages")


if __name__ == "__main__":
    args = sys.argv[1:]
    for slug in (BOOKS if args == ["--all"] else args):
        find(slug)
