#!/usr/bin/env python3
"""Find the class each 4 Chapters a Day study-note bullet came from, where it can be found.

The study notes (docs/study/<book>/<chapter>.md) were written by hand, and their bullets carry
no class, teacher or moment. This looks for each bullet in what the classes said on the same
verses and records a source only when the wording plainly matches:

  1. the precept passes (data/precepts/classes/*.json): the class's breakdown of the verse
     (`sense`) and of each precept read with it (`why`), with the passage's teacher and moment;
  2. the transcripts, in the five minutes after a class read one of the verses
     (data/precepts/readings, scripts/precepts/readings.py).

A bullet's words are compared without the words of the verses it sits under (every bullet
repeats its verse) and without the small words. A source is kept only when at least
SHARE of the bullet's remaining words, and at least MIN_WORDS of them, are in one class's text.
Anything less is written as unsourced (null): a source is never guessed.

  data/study/sources.json   {"<study url>": {"<bullet key>": source or null}}
  source: {video, t, ts, title, date, teacher, url?, how: "pass" | "transcript", share}

The bullet key is the first 12 hex of sha1 of the bullet's markdown line (after "- "), which is how
engine/library.mjs finds it again.

  python3 scripts/study/sources.py            # all study notes
  python3 scripts/study/sources.py exodus/12  # one, printing what was found
"""
import glob, hashlib, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "scripts", "notes"))
import prep  # noqa: E402

OUT = os.path.join(ROOT, "data", "study", "sources.json")
SHARE = 0.6
MIN_WORDS = 6
AFTER = 300  # seconds of transcript after a reading that may hold the class's comment on it
STOP = set("the and that unto shall this with them they their thou thee thy for from was were have hath which what when then there his him her not all but our you your ye are into upon said saith lord god also even will is it of to in a an be by as on at so he she we us me my no or if do did does was been being one".split())
HEAD = re.compile(r"^\*\*\[([^\]]+)\]\(/bible/([a-z0-9-]+)/(\d+)(?:#v(\d+))?\)\*\*")
NAME = {e["slug"]: e["book"] for e in prep.IDX}


def words(s):
    return {w for w in re.findall(r"[a-z]{3,}", s.lower().replace("’", "'")) if w not in STOP}


def plain(md):
    """A bullet as the reader sees it: links and emphasis stripped, as engine/library.mjs plain()."""
    s = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", md)
    s = re.sub(r"[*_`]+", "", s)
    return re.sub(r"\s+", " ", s).strip()


def key(text):
    """The bullet's markdown as written, trimmed: engine/library.mjs hashes the same line."""
    return hashlib.sha1(text.strip().encode("utf-8")).hexdigest()[:12]


def hms(s):
    s = int(s); h, m, x = s // 3600, (s % 3600) // 60, s % 60
    return f"{h}:{m:02d}:{x:02d}" if h else f"{m}:{x:02d}"


def secs(ts):
    out = 0
    for x in str(ts or "").split(":"):
        out = out * 60 + int(x or 0)
    return out


def verses_of(spec, n):
    out = []
    for part in str(spec or "").split(","):
        if not part.strip(): continue
        a, _, b = part.partition("-")
        a = int(a); b = int(b) if b else a
        out.extend(v for v in range(a, b + 1) if 1 <= v <= n)
    return out or list(range(1, n + 1))


def parse_ref(label):
    m = re.match(r"^\s*(.+?)\s+(\d+)(?::([\d,\s\-]+))?\s*$", label or "")
    if not m: return None
    book = prep.resolve_book(m.group(1)) or m.group(1)
    return book, int(m.group(2)), (m.group(3) or "").replace(" ", "")


# ---------------------------------------------------------------- what the classes said
def load_passes():
    """(book, chapter, verse) -> [(words, source)] from every precept pass."""
    by = {}
    for f in glob.glob(os.path.join(ROOT, "data", "precepts", "classes", "*.json")):
        c = json.load(open(f, encoding="utf-8"))
        for p in c.get("passages", []):
            r = parse_ref(p.get("opened"))
            if not r or r[0] not in prep.SLUG: continue
            book, ch, vs = r
            body = prep.chapter(book, ch) or []
            src = {"video": c["video"], "t": secs(p.get("ts")), "ts": p.get("ts") or "", "title": c.get("title") or "", "date": c.get("date") or "", "teacher": p.get("teacher") or c.get("teacher") or "", "how": "pass"}
            for s in p.get("sense", []):
                for v in verses_of(s.get("at"), len(body)):
                    by.setdefault((book, ch, v), []).append((words(s.get("text", "")), src))
            for pr in p.get("precepts", []):
                for v in verses_of(pr.get("at"), len(body)):
                    by.setdefault((book, ch, v), []).append((words(pr.get("why", "")), src))
    return by


_transcripts = {}
def transcript(video):
    if video not in _transcripts:
        t = None
        for d in ("blog", "captains", "history"):
            p = os.path.join(ROOT, d, "transcripts", f"{video}.json")
            if os.path.exists(p):
                t = json.load(open(p, encoding="utf-8")); break
        _transcripts[video] = t
    return _transcripts[video]


def heard_after(book, ch, v, readings, videos):
    """[(words, source)] of what was said in the five minutes after each reading of the verse."""
    out = []
    for row in readings.get(str(ch), {}).get(str(v), []):
        video, t = row[0], row[1]
        at = row[2] if len(row) > 2 and row[2] is not None else t
        tr = transcript(video)
        if not tr: continue
        said = " ".join(s[1] for s in tr["segments"] if at - 10 <= s[0] <= at + AFTER)
        meta = videos.get(video, {})
        out.append((words(said), {"video": video, "t": int(at), "ts": hms(at), "title": meta.get("title") or "", "date": meta.get("date") or "", "teacher": meta.get("teacher") or "", "how": "transcript"}))
    return out


# ---------------------------------------------------------------- the study notes
def bullets(path):
    """[(passage label, book, chapter, verses, bullet text)] in a study note."""
    out, opened = [], None
    for raw in open(path, encoding="utf-8"):
        raw = raw.rstrip("\n")
        h = HEAD.match(raw)
        if h:
            book = NAME.get(h.group(2))
            lm = re.search(r":([\d,\-]+)$", h.group(1).strip())
            opened = (h.group(1).strip(), book, int(h.group(3)), lm.group(1) if lm else (h.group(4) or "")) if book else None
            continue
        if opened and raw.startswith("- "):
            out.append((*opened, raw[2:]))
        elif raw.startswith("#"):
            opened = None
    return out


def source_of(text, book, ch, spec, passes, readings, videos):
    body = prep.chapter(book, ch) or []
    vs = verses_of(spec, len(body))
    mine = words(plain(text)) - set().union(*(words(body[v - 1]) for v in vs if v <= len(body)))
    if len(mine) < MIN_WORDS: return None
    best, score = None, 0.0
    for v in vs:
        for ws, src in passes.get((book, ch, v), []) + heard_after(book, ch, v, readings, videos):
            shared = len(mine & ws)
            share = shared / len(mine)
            if shared >= MIN_WORDS and share >= SHARE and share > score:
                best, score = src, share
    return {**best, "share": round(score, 2)} if best else None


def main(argv):
    files = [os.path.join(ROOT, "docs", "study", f"{a}.md") for a in argv] or sorted(glob.glob(os.path.join(ROOT, "docs", "study", "*", "*.md")))
    passes = load_passes()
    videos = json.load(open(os.path.join(ROOT, "data", "precepts", "readings", "videos.json"), encoding="utf-8"))
    notes = {}
    for d in ("blog", "captains"):
        for f in glob.glob(os.path.join(ROOT, d, "*", "*.md")):
            m = re.search(r'data-video-id="([\w-]{11})"', open(f, encoding="utf-8").read())
            if m: notes[m.group(1)] = f
    out = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) and argv else {}
    total = found = 0
    readings_cache = {}
    for f in files:
        url = "/study/" + os.path.relpath(f, os.path.join(ROOT, "docs", "study"))[:-3]
        rows = {}
        for label, book, ch, spec, text in bullets(f):
            slug = prep.SLUG[book]
            if slug not in readings_cache:
                p = os.path.join(ROOT, "data", "precepts", "readings", f"{slug}.json")
                readings_cache[slug] = json.load(open(p)) if os.path.exists(p) else {}
            src = source_of(text, book, ch, spec, passes, readings_cache[slug], videos)
            rows[key(text)] = src
            total += 1; found += bool(src)
            if argv:
                where = "UNSOURCED" if not src else f"{src['title']} at {src['ts']} ({src['teacher'] or 'teacher unknown'}, {src['how']} {src['share']})"
                print(f"{label}: {where}\n  - {plain(text)[:140]}")
        out[url] = rows
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(dict(sorted(out.items())), open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0, separators=(",", ":"))
    print(f"{found} of {total} study-note bullets sourced to a class; {total - found} marked unsourced", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1:])
