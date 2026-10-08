#!/usr/bin/env python3
"""Match the class outlines in the sabbath-classes-images R2 bucket to the YouTube classes.

    python3 scripts/r2/match.py            # writes data/sources/r2-classes.tsv
    python3 scripts/r2/match.py --dates    # also prints id<TAB>date for backfill_meta.py --from-tsv

The files under text/ are the text of each class's PDF outline: its title, teacher and date,
then the scriptures in the order they were read, each with a line of what was drawn from it.
They are matched by what they contain, not by their names:

  1. the scriptures: every verified reference in the outline against every verified reference
     read in each transcript, weighted by how rare the verse is across all the classes;
  2. the outline's own words (names, places, topics, the articles and videos shown), with
     scripture vocabulary removed, against the words spoken in the class;
  3. title and date only as support, never alone, except for outlines with no readable text.

Spanish outlines are matched through their English original (the same teacher's outline with
the same scriptures) or, failing that, by their scriptures.

The bucket's text is read live and cached in a temporary folder; none of it is written into
the repository. Needs R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (and R2_ENDPOINT,
R2_BUCKET_NAME if they differ from r2.py's defaults).
"""

import argparse
import collections
import datetime
import difflib
import glob
import hashlib
import json
import math
import os
import random
import re
import sys
import tempfile
import urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "scripts" / "corpus"))
sys.path.append(str(ROOT / "scripts" / "notes"))  # appended: scripts/notes/queue.py would shadow the stdlib
import prep  # noqa: E402
import sources  # noqa: E402

OUT = ROOT / "data" / "sources" / "r2-classes.tsv"
CACHE = Path(os.environ.get("R2_CACHE") or Path(tempfile.gettempdir()) / "r2-text")

# ---------------------------------------------------------------- reading the bucket

def fetch_all():
    """{key: local path} for every text file in the bucket, downloading what is not cached."""
    import r2
    from concurrent.futures import ThreadPoolExecutor
    CACHE.mkdir(parents=True, exist_ok=True)
    keys = [k for k, _, _ in r2.listall("text/") if k.endswith(".txt")]

    def get(key):
        path = CACHE / (hashlib.sha1(key.encode()).hexdigest()[:16] + ".txt")
        if not path.exists() or not path.stat().st_size:
            with r2.req(f"/{r2.BUCKET}/" + urllib.parse.quote(key, safe="/-_.~"), {}) as r:
                path.write_bytes(r.read())
        return key, path

    with ThreadPoolExecutor(16) as pool:
        return dict(pool.map(get, keys))


ES_BOOKS = {
    "génesis": "Genesis", "genesis": "Genesis", "éxodo": "Exodus", "exodo": "Exodus", "levítico": "Leviticus",
    "levitico": "Leviticus", "números": "Numbers", "numeros": "Numbers", "deuteronomio": "Deuteronomy",
    "josué": "Joshua", "josue": "Joshua", "jueces": "Judges", "rut": "Ruth", "reyes": "Kings", "crónicas": "Chronicles",
    "cronicas": "Chronicles", "nehemías": "Nehemiah", "nehemias": "Nehemiah", "ester": "Esther", "salmos": "Psalms",
    "salmo": "Psalms", "proverbios": "Proverbs", "eclesiastés": "Ecclesiastes", "eclesiastes": "Ecclesiastes",
    "eclesiástico": "Ecclesiasticus", "eclesiastico": "Ecclesiasticus", "sirácida": "Ecclesiasticus", "isaías": "Isaiah",
    "isaias": "Isaiah", "jeremías": "Jeremiah", "jeremias": "Jeremiah", "lamentaciones": "Lamentations",
    "ezequiel": "Ezekiel", "oseas": "Hosea", "amós": "Amos", "abdías": "Obadiah", "abdias": "Obadiah", "jonás": "Jonah",
    "jonas": "Jonah", "miqueas": "Micah", "nahúm": "Nahum", "habacuc": "Habakkuk", "sofonías": "Zephaniah",
    "sofonias": "Zephaniah", "hageo": "Haggai", "zacarías": "Zechariah", "zacarias": "Zechariah", "malaquías": "Malachi",
    "malaquias": "Malachi", "mateo": "Matthew", "marcos": "Mark", "lucas": "Luke", "juan": "John", "hechos": "Acts",
    "romanos": "Romans", "corintios": "Corinthians", "gálatas": "Galatians", "galatas": "Galatians", "efesios": "Ephesians",
    "filipenses": "Philippians", "colosenses": "Colossians", "tesalonicenses": "Thessalonians", "timoteo": "Timothy",
    "tito": "Titus", "filemón": "Philemon", "hebreos": "Hebrews", "santiago": "James", "pedro": "Peter", "judas": "Jude",
    "apocalipsis": "Revelation", "revelación": "Revelation", "tobías": "Tobit", "judit": "Judith",
    "sabiduría": "Wisdom", "baruc": "Baruch", "macabeos": "Maccabees", "susana": "Susanna",
}
ES_RE = re.compile(r"\b(" + "|".join(sorted(map(re.escape, ES_BOOKS), key=len, reverse=True)) + r")\b", re.I)
ES_WORDS = re.compile(r"\b(que|los|las|del|para|una|por|como|nuestro|pueblo|dios|son)\b")
EN_WORDS = re.compile(r"\b(the|and|that|our|people|god|are|with|for)\b")


def spanish_books(text):
    text = re.sub(r"\b([1-3])\s*(?:º|°|ª|er|ro|do|ra)\b", r"\1", text)
    return ES_RE.sub(lambda m: ES_BOOKS[m.group(1).lower()], text)


MONTHS = "jan feb mar apr may jun jul aug sep oct nov dec".split()
DATES = [
    (r"(?<!\d)(\d{1,2})[._ /-](\d{1,2})[._ /-](20\d{2})(?!\d)", "mdY"),
    (r"(?<!\d)(20\d{2})[._ /-](\d{1,2})[._ /-](\d{1,2})(?!\d)", "Ymd"),
    (r"(?<!\d)(\d{1,2})[._ /-](\d{1,2})[._ /-](\d{2})(?!\d)", "mdy"),
    (r"(?<!\d)(\d{2})(\d{2})(\d{2})(?!\d)", "mdy"),
    (r"(?<!\d)(\d{2})(\d{2})(20\d{2})(?!\d)", "mdY"),
]


def dates_in(s):
    """The dates written in a file name or title (as the files write them, month first)."""
    found = []
    m = re.search(r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})", s, re.I)
    if m:
        found.append((int(m.group(3)), MONTHS.index(m.group(1).lower()) + 1, int(m.group(2))))
    for pattern, order in DATES:
        for m in re.finditer(pattern, s):
            a, b, c = (int(x) for x in m.groups())
            found.append((a, b, c) if order == "Ymd" else (c if order == "mdY" else 2000 + c, a, b))
    good = []
    for y, mo, d in found:
        try:
            day = datetime.date(y, mo, d)
        except ValueError:
            continue
        if datetime.date(2010, 1, 1) <= day <= datetime.date.today() + datetime.timedelta(days=1):
            good.append(day.isoformat())
    return list(dict.fromkeys(good))


def refs_in(text):
    out = []
    for r in prep.extract(text):
        ok, _ = prep.verify(r)
        if ok:
            out.append((r["book"], r["chapter"], r["first"], r["last"] or r["first"]))
    return out


def read_outline(key, path=None, raw=None):
    """An outline's fields, scriptures and text, from its cached file or its raw text."""
    raw = raw if raw is not None else path.read_text(encoding="utf-8", errors="replace")
    head = raw[:1500]
    field = lambda name: (re.search(rf"^{name}: (.*)$", head, re.M) or [None, ""])[1].strip()
    body = raw[raw.find("--- Page 1"):] if "--- Page 1" in raw else raw
    body = re.sub(r"\[IMAGE CONTENT[^\n]*\n(?:[ \t]+[^\n]*\n)*", "", body)
    flat = re.sub(r"\s+", " ", re.sub(r"https?://\S+", "", body))
    parts = key.split("/")
    lang = parts[-2]
    es, en = len(ES_WORDS.findall(flat.lower())), len(EN_WORDS.findall(flat.lower()))
    if field("Language").lower().startswith("span") or es > 1.5 * en + 5:
        lang = "es"
    elif lang == "es" and en > 1.5 * es + 5:
        lang = "en"
    title = field("Title") or parts[-1][:-4]
    return {
        "key": key, "rank": parts[1], "name": parts[2] if parts[1] != "Unorganized" else "", "lang": lang,
        "title": title, "dates": dates_in(parts[-1]) or dates_in(title),
        "refs": refs_in(spanish_books(flat) if lang == "es" else flat), "text": flat, "words": len(flat.split()),
    }


RANKS = {"bishop": "Bishop", "obispo": "Bishop", "deacon": "Deacon", "diacono": "Deacon", "diácono": "Deacon", "deacono": "Deacon",
         "captain": "Captain", "capitan": "Captain", "capitán": "Captain", "officer": "Officer", "oficial": "Officer"}
TEACHER = re.compile(r"\b(bishop|obispo|deacon|deacono|di[aá]cono|captain|capit[aá]n|officer|oficial)[\s_\-]*([A-Z][a-zA-Z]+)", re.I)
NOT_NAMES = {"sabbath", "class", "morning", "evening", "noon", "afternoon", "the", "and"}


def fetch(key):
    """One outline straight from the bucket, read in memory and never saved."""
    import r2
    with r2.req(f"/{r2.BUCKET}/" + urllib.parse.quote(key, safe="/-_.~"), {}) as r:
        return read_outline(key, raw=r.read().decode("utf-8", errors="replace"))


KNOWN = {}   # the teachers the bucket files outlines under: lowercase -> their spelling


def known_teachers(outlines):
    for o in outlines.values():
        if o["rank"] != "Unorganized":
            KNOWN[o["name"].lower()] = o["name"].capitalize() if o["name"].isupper() else o["name"]


def teacher_of(o):
    """Who the bucket files the outline under, or, for the unorganized files, who it names:
    in its title, or on its first page if that is a known teacher's name."""
    if o["rank"] != "Unorganized":
        name = o["name"].capitalize() if o["name"].isupper() else o["name"]
        return f"{o['rank']} {name}"
    for n, s in enumerate((o["title"], o["key"].split("/")[-1], o["text"][:800])):
        for m in TEACHER.finditer(s):
            name = proper_name(m.group(2), titled=n < 2)
            if name:
                return f"{RANKS[m.group(1).lower()]} {name}"
    return ""


def proper_name(word, titled=False):
    """A teacher's name: as the bucket spells it, a name from the Bible, or a near spelling of a
    teacher the bucket files outlines under ("Yawasop" -> "Yawasap"). A name in a title or file
    name is taken as given; on the page, an ordinary word after a title ("Bishop asks") is not."""
    w = word.lower()
    if w in NOT_NAMES or len(w) < 3:
        return None
    if w in KNOWN:
        return KNOWN[w]
    if w in bible_names():
        return word.capitalize()
    close = difflib.get_close_matches(w, KNOWN, n=1, cutoff=.8)
    if close:
        return KNOWN[close[0]]
    return word.capitalize() if titled and word[0].isupper() else None


_NAMES = set()


def bible_names():
    """Words the King James text only ever writes capitalized: its proper names."""
    if not _NAMES:
        upper, lower = set(), set()
        for f in glob.glob(str(ROOT / "data" / "bible" / "*.json")):
            if not f.endswith("index.json"):
                for ch in json.load(open(f, encoding="utf-8"))["chapters"].values():
                    for v in ch:
                        for x in re.findall(r"[A-Za-z]+", v):
                            (upper if x[0].isupper() else lower).add(x.lower())
        _NAMES.update(upper - lower)
    return _NAMES


def session_of(o):
    s = (o["title"] + " " + o["key"]).lower()
    for word in ("morning", "noon", "afternoon", "evening"):
        if word in s:
            return word.capitalize()
    return ""

# ---------------------------------------------------------------- the YouTube side

def catalog():
    notes = sources.notes()
    out = {}
    for feed, folder in sources.FEEDS.items():
        meta = sources.channel_meta(folder)
        for path in sources.transcript_files(feed):
            record, problem = sources.read_transcript(path)
            if problem:
                continue
            vid = str(record.get("videoId") or path.stem)
            m = meta.get(vid, {})
            out[vid] = {
                "feed": feed, "path": str(path), "title": record.get("title") or m.get("title") or "",
                "date": sources.iso_date(record.get("date")) or m.get("date") or notes.get(vid, {}).get("date"),
                "duration": record.get("duration") or m.get("duration") or 0,
            }
    return out


WORD = re.compile(r"[a-z][a-z']{3,}")


def spoken(path):
    t = json.load(open(path, encoding="utf-8"))
    return " ".join(s[1] for s in t.get("segments", []))


def transcript_refs(item):
    vid, path = item
    return vid, refs_in(spoken(path))

# ---------------------------------------------------------------- scoring

STOP = set("the a an of and to in on is for with by from class sabbath morning evening afternoon noon bishop deacon "
           "captain officer part pt compressed docx pdf ep episode iuic en es de la el los las y con".split())


def tokens(s):
    return {w for w in re.findall(r"[a-z0-9]+", s.lower()) if w not in STOP and len(w) > 2 and not w.isdigit()}


def verses(refs):
    return {(b, c, v) for b, c, f, l in refs for v in range(f, min(l, f + 3) + 1)}


def chapters(refs):
    return {(b, c) for b, c, _, _ in refs}


class Matcher:
    def __init__(self, cat, yrefs):
        self.cat, self.n = cat, len(yrefs)
        self.yv = {i: verses(r) for i, r in yrefs.items()}
        self.yc = {i: chapters(r) for i, r in yrefs.items()}
        self.dfv = collections.Counter(k for s in self.yv.values() for k in s)
        self.dfc = collections.Counter(k for s in self.yc.values() for k in s)
        self.inv = collections.defaultdict(set)
        for i, s in self.yv.items():
            for k in s:
                self.inv[k].add(i)
        self.titles = {i: tokens(c["title"]) for i, c in cat.items()}
        self.by_date = collections.defaultdict(list)
        for i, c in cat.items():
            if c["date"]:
                self.by_date[c["date"]].append(i)
        self._words = {}
        random.seed(0)
        self.df = collections.Counter()
        for i in random.sample(sorted(cat), min(1500, len(cat))):
            self.df.update(self.words(i))
        self.kjv = set()
        for f in glob.glob(str(ROOT / "data" / "bible" / "*.json")):
            if not f.endswith("index.json"):
                for ch in json.load(open(f, encoding="utf-8"))["chapters"].values():
                    for v in ch:
                        self.kjv.update(WORD.findall(v.lower()))

    def iv(self, k): return math.log(self.n / (1 + self.dfv[k]))
    def ic(self, k): return math.log(self.n / (1 + self.dfc[k]))

    def words(self, i):
        if i not in self._words:
            self._words[i] = set(WORD.findall(spoken(self.cat[i]["path"]).lower()))
        return self._words[i]

    def candidates(self, o):
        rv = verses(o["refs"])
        by_refs = collections.Counter()
        for x in rv:
            if self.dfv[x] < 800:
                for i in self.inv[x]:
                    by_refs[i] += self.iv(x)
        out = {i for i, _ in sorted(by_refs.items(), key=lambda x: (-round(x[1], 6), x[0]))[:60]}
        tt = tokens(o["title"] + " " + o["key"].split("/")[-1])
        if len(tt) >= 2:
            ranked = sorted(((-len(tt & t) / max(1, min(len(tt), len(t))), i) for i, t in self.titles.items()
                             if t and len(tt & t) >= 2))
            out |= {i for _, i in ranked[:8]}
        for d in o["dates"]:
            day = datetime.date.fromisoformat(d)
            for offset in range(-1, 8):
                out |= set(self.by_date.get((day + datetime.timedelta(offset)).isoformat(), []))
        return out

    def score(self, o, i):
        rv, rc = verses(o["refs"]), chapters(o["refs"])
        wr = sum(map(self.iv, rv)) or 1
        wrc = sum(map(self.ic, rc)) or 1
        sv = sum(map(self.iv, rv & self.yv[i]))
        sc = sum(map(self.ic, rc & self.yc[i]))
        wy = sum(map(self.iv, self.yv[i])) or 1
        wyc = sum(map(self.ic, self.yc[i])) or 1
        s = 0.5 * sv / math.sqrt(wr * wy) + 0.3 * sc / math.sqrt(wrc * wyc) + 0.2 * sv / wr
        tt, ti = tokens(o["title"] + " " + o["key"].split("/")[-1]), self.titles[i]
        tsim = len(tt & ti) / max(1, min(len(tt), len(ti))) if tt and ti else 0
        dd = None
        if o["dates"] and self.cat[i]["date"]:
            dd = min(((datetime.date.fromisoformat(self.cat[i]["date"]) - datetime.date.fromisoformat(x)).days
                      for x in o["dates"]), key=abs)
        w = None
        if o["lang"] == "en":
            own = {x for x in WORD.findall(o["text"].lower()) if x not in self.kjv and self.df[x] < 300}
            if own:
                weight = {x: math.log(1500 / (1 + self.df[x])) for x in own}
                w = sum(weight[x] for x in own if x in self.words(i)) / sum(weight.values())
        rank = s + (w if w is not None else 0.3 * s) + 0.1 * tsim + (0.1 if dd is not None and 0 <= dd <= 7 else 0)
        return {"id": i, "s": round(s, 3), "w": None if w is None else round(w, 3), "tsim": round(tsim, 2), "dd": dd,
                "rank": round(rank, 3)}


def near(f): return f["dd"] is not None and -1 <= f["dd"] <= 7


def acceptable(o, f):
    s, w, t = f["s"], f["w"], f["tsim"]
    if o["lang"] == "en" and w is not None:
        return (s >= .3 and w >= .25) or w >= .4 or (s >= .6 and w >= .15) or (s >= .45 and (t >= .6 or near(f)))
    return s >= .6 or (s >= .4 and (t >= .6 or near(f)))


def confirmed(o, f):
    s, w, t = f["s"], f["w"], f["tsim"]
    if o["lang"] == "en" and w is not None:
        return ((s >= .45 and (w >= .25 or t >= .6 or near(f))) or (s >= .6 and w >= .15) or s >= .65
                or (s >= .3 and w >= .35 and (t >= .6 or near(f))))
    return (s >= .5 and (t >= .6 or near(f))) or s >= .65


def numbers(s):
    return set(re.findall(r"\b\d{1,3}\b", re.sub(r"\d{1,2}[._/-]\d{1,2}[._/-]\d{2,4}|\d{6,8}", "", s)))


def jaccard(a, b): return len(a & b) / max(1, len(a | b))


def decide(m, outlines, yrefs):
    def same_class(a, b):  # one class uploaded twice
        ca, cb = m.cat[a], m.cat[b]
        ta, tb = m.titles[a], m.titles[b]
        return (jaccard(verses(yrefs[a]), verses(yrefs[b])) >= .35
                or (ca["title"].lower().strip(" ?!.") == cb["title"].lower().strip(" ?!.")
                    and abs((ca["duration"] or 0) - (cb["duration"] or 0)) < 1800)
                or (ca["date"] and ca["date"] == cb["date"] and ta and tb  # one class in two parts, uploaded the same day
                    and len(ta & tb) / min(len(ta), len(tb)) >= .8))

    result = {}
    for key, o in outlines.items():
        scored = sorted((m.score(o, i) for i in m.candidates(o)), key=lambda f: (-f["rank"], f["id"]))
        good = [f for f in scored if acceptable(o, f)]
        best = scored[0] if scored else None
        if good:
            top = good[0]
            twins = [f["id"] for f in good[1:] if same_class(top["id"], f["id"])]
            others = [f for f in good[1:] if f["id"] not in twins and f["rank"] >= top["rank"] - .15]
            if near(top) and not any(near(f) for f in others):   # the outline's date settles it
                others = []
            others = [f["id"] for f in others]
            status = ("ambiguous" if others else "match" if confirmed(o, top)
                      else "probable" if top["tsim"] >= .5 or near(top) else "none")
            result[key] = {"status": status, "how": "text", "f": top, "twins": twins, "others": others}
        elif len(o["refs"]) < 3 and o["words"] < 1500:   # an outline with no readable text: name and date only
            want = numbers(o["title"])
            named = [f for f in scored if f["tsim"] >= .8 and (near(f) or not o["dates"])
                     and numbers(m.cat[f["id"]]["title"]) == want]
            if named and (len(named) == 1 or same_class(named[0]["id"], named[1]["id"]) or near(named[0])):
                result[key] = {"status": "match", "how": "name", "f": named[0], "twins": [], "others": []}
            else:
                result[key] = {"status": "none", "how": "no text", "f": best, "twins": [], "others": []}
        else:
            result[key] = {"status": "none", "how": "text", "f": best, "twins": [], "others": []}
        if result[key]["status"] == "none" and result[key]["how"] == "text" and good:
            result[key]["how"] = "text (weak)"
    # Spanish outlines: through the English original, the same teacher's outline of the same scriptures.
    english = [k for k, o in outlines.items() if o["lang"] == "en"]
    for key, o in outlines.items():
        if o["lang"] != "es":
            continue
        mine, best = verses(o["refs"]), (0, None)
        for e in english:
            if outlines[e]["rank"] == o["rank"] and (not o["name"] or outlines[e]["name"] == o["name"]):
                j = jaccard(mine, verses(outlines[e]["refs"]))
                if j > best[0]:
                    best = (j, e)
        if best[0] >= .5:
            result[key]["original"] = best[1]
            if result[key]["status"] != "match" and result[best[1]]["status"] == "match":
                result[key] = dict(result[best[1]], how="through " + best[1].split("/")[-1], original=best[1])
    return result


REVIEWED = ROOT / "data" / "sources" / "r2-reviewed.tsv"


def apply_reviewed(m, outlines, result):
    """Matches decided by reading the outline against the class (data/sources/r2-reviewed.tsv)
    replace what the scores say. An empty video means the class has no YouTube copy."""
    if not REVIEWED.exists():
        return
    for line in REVIEWED.read_text(encoding="utf-8").splitlines():
        cells = line.split("\t")
        if len(cells) < 4 or not cells[0].startswith("text/") or cells[0] not in outlines:
            continue
        key, video, twins = cells[0], cells[1], [t for t in cells[2].split(",") if t]
        if video:
            result[key] = {"status": "match", "how": "reviewed", "f": m.score(outlines[key], video),
                           "twins": twins, "others": []}
        else:
            result[key] = {"status": "none", "how": "reviewed", "f": None, "twins": twins, "others": []}


TEACHERS = ROOT / "data" / "sources" / "r2-class-teachers.tsv"


def write_teachers(outlines, result, cat):
    """data/sources/r2-class-teachers.tsv: who taught each matched class, for auto.prepare
    (after the admin corrections in data/sources/class-teachers.tsv).

    A match by the outline's text decides. An earlier match by title is kept only where the
    outline has no text to check it against. A class filed under two teachers is left out."""
    old = {}
    if TEACHERS.exists():
        for line in TEACHERS.read_text(encoding="utf-8").splitlines():
            cells = line.split("\t")
            if len(cells) == 8 and cells[7].startswith("text/"):
                old[cells[7]] = cells
    rows = {}
    for key, o in outlines.items():
        r, teacher = result[key], teacher_of(outlines[key])
        if not teacher:
            continue
        if r["status"] == "match":
            f = r["f"]
            rows[key] = [cat[f["id"]]["date"] or "", (o["dates"] or [""])[0], f["id"], teacher, session_of(o), o["lang"],
                         str(round(f["s"] + (f["w"] or 0), 2)), key]
        elif r["status"] == "probable" and r["f"]["tsim"] >= .65:   # the same title, partly confirmed by the text
            f = r["f"]
            rows[key] = [cat[f["id"]]["date"] or "", (o["dates"] or [""])[0], f["id"], teacher, session_of(o), o["lang"],
                         str(round(f["s"] + (f["w"] or 0), 2)), key]
        elif key in old and r["status"] == "none" and r["how"] != "reviewed" and len(o["refs"]) < 3:   # no scriptures to check the title match by
            rows[key] = old[key]
    by_video = collections.defaultdict(set)
    for key, cells in rows.items():
        by_video[cells[2]].add((cells[3], outlines[key]["rank"] != "Unorganized"))
    def settled(cells):   # one teacher, or one that the bucket files the outline under
        names = {n for n, _ in by_video[cells[2]]}
        filed = {n for n, f in by_video[cells[2]] if f}
        return len(names) == 1 or (len(filed) == 1 and cells[3] in filed)
    keep = sorted((c for c in rows.values() if settled(c)), key=lambda c: (c[0] or c[1] or "9999", c[2], c[7]))
    head = ("# Who taught each class, from the class outlines in the sabbath-classes-images R2 bucket (filed by rank\n"
            "# and teacher). Matched to the YouTube class by the outline's scriptures and words (scripts/r2/match.py);\n"
            "# a class filed under two teachers is left out. Supplementary: a class's own words win. file_date is the\n"
            "# date written in the R2 file name; score is the outline's scripture + word match.\n")
    TEACHERS.write_text(head + "\t".join(["date", "file_date", "video", "teacher", "session", "lang", "score", "r2_key"])
                        + "\n" + "".join("\t".join(c) + "\n" for c in keep), encoding="utf-8")
    print(f"{len({c[2] for c in keep})} classes with a teacher ({len(keep)} outlines); "
          f"{len(rows) - len(keep)} left out (two teachers)", file=sys.stderr)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dates", action="store_true", help="print id<TAB>date for undated classes a matched outline dates")
    args = ap.parse_args()

    files = fetch_all()
    outlines = {k: read_outline(k, p) for k, p in sorted(files.items())}
    known_teachers(outlines)
    cat = catalog()
    import multiprocessing  # here, not at the top: auto.py imports this module with scripts/notes first on the path
    with multiprocessing.Pool() as pool:
        yrefs = dict(pool.map(transcript_refs, [(i, c["path"]) for i, c in cat.items()], chunksize=50))
    m = Matcher(cat, yrefs)
    result = decide(m, outlines, yrefs)
    apply_reviewed(m, outlines, result)

    header = ("# Every class outline in the sabbath-classes-images R2 bucket (text/), and the YouTube class it is.\n"
              "# Written by scripts/r2/match.py, which matches by the outline's scriptures and words against what was\n"
              "# read and said in each class. status: match | probable | ambiguous | none (no YouTube copy found).\n"
              "# scripture and words are the two text scores (0-1); twins are other uploads of the same class.\n")
    cols = ["r2_key", "status", "video", "how", "rank", "teacher", "file_date", "lang", "title", "scripture", "words",
            "twins", "others", "original"]
    lines = [header + "\t".join(cols)]
    for key, o in outlines.items():
        r, f = result[key], result[key]["f"] or {}
        video = f.get("id", "") if r["status"] != "none" else ""
        teacher = teacher_of(o)
        clean = lambda s: str(s if s is not None else "").replace("\t", " ").replace("\n", " ")
        lines.append("\t".join(clean(x) for x in [
            key, r["status"], video, r["how"], teacher.split(" ")[0] if teacher else "", teacher,
            (o["dates"] or [""])[0], o["lang"], o["title"], f.get("s", "") if video else "", f.get("w", "") if video else "",
            ",".join(r["twins"]), ",".join(r["others"]), r.get("original", "")]))
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    counts = collections.Counter(r["status"] for r in result.values())
    print(f"{len(outlines)} outlines: " + ", ".join(f"{n} {s}" for s, n in counts.most_common()), file=sys.stderr)
    write_teachers(outlines, result, cat)

    if args.dates:
        found = collections.defaultdict(set)
        for key, o in outlines.items():
            r = result[key]
            sabbath = "sabbath" in (o["title"] + key).lower()
            for d in o["dates"][:1]:
                if r["status"] == "match" and not cat[r["f"]["id"]]["date"]:
                    if sabbath and datetime.date.fromisoformat(d).weekday() != 5:
                        print(f"skipped {r['f']['id']}: a Sabbath class dated {d}, not a Saturday", file=sys.stderr)
                        continue
                    found[r["f"]["id"]].add(d)
        for vid, ds in sorted(found.items()):
            if len(ds) == 1:
                print(f"{vid}\t{ds.pop()}")
            else:
                print(f"skipped {vid}: outlines disagree on the date {sorted(ds)}", file=sys.stderr)


if __name__ == "__main__":
    main()
