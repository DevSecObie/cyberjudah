#!/usr/bin/env python3
"""Every moment a class read a verse aloud, from the transcripts, into data/precepts/readings/:

  data/precepts/readings/<book slug>.json   {"<chapter>": {"<verse>": [[video, seconds, verse second], ...]}}
  data/precepts/readings/videos.json        {"<video>": {"title", "date", "teacher", "duration"}}

  python3 scripts/precepts/readings.py            # all transcripts (cached per transcript)
  python3 scripts/precepts/readings.py <id> ...   # just these, printing what was found

A reference the teacher calls for ("Isaiah 61 and verse 1") is only counted when the verse
was then read: most of the verse's own words appear in the captions over the next two
minutes. A single verse called for is followed on to the verses read after it, so a class
that opened at verse 1 and read to verse 9 is recorded on each of the nine. Mentions that
were not read (a screen listing, a passing "as it says in Romans 11") are left out.

`seconds` is where the reference was called for, so every verse of one reading shares it. The
verse second, when the captions show it, is where the verse itself starts being read: the first
caption, at or after the verse before it, that opens with the verse's first words. It is left
off when the captions don't show the verse's opening.
"""
import glob, json, os, re, sys, hashlib

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "scripts", "notes"))
import prep  # noqa: E402

OUT = os.path.join(ROOT, "data", "precepts", "readings")
CACHE = os.path.join(ROOT, ".cache", "readings")
STOP = set("the and that unto shall this with them they their thou thee thy for from was were have hath which what when then there his him her not all but our you your ye are into upon said saith lord god also even will unto".split())
WINDOW = 120       # seconds after a reference in which the verse must be read
MATCH = 0.55       # share of a verse's content words that must be heard
FOLLOW = 30        # how many verses past the one called for to keep following a reading
VERSION = "verse-seconds-1"  # cache tag: bump when the rows change shape
OPENING = 6        # how many of a verse's first words mark where it starts being read


def words(s):
    return [w for w in re.findall(r"[a-z]{3,}", s.lower()) if w not in STOP]


def read_score(verse_text, heard):
    ws = words(verse_text)
    if len(ws) < 3:
        return 1.0 if all(w in heard for w in ws) else 0.0
    return sum(1 for w in set(ws) if w in heard) / len(set(ws))


def tokens(s):
    return re.findall(r"[a-z]+", s.lower().replace("’", "'").replace("'", ""))


def timed_tokens(segs):
    """Every caption word with the second it was said at, spread evenly over its caption."""
    out = []
    for j, (sec, text) in enumerate(segs):
        ws = tokens(text)
        end = segs[j + 1][0] if j + 1 < len(segs) else sec + 3
        for k, w in enumerate(ws):
            out.append((sec + (end - sec) * k / max(len(ws), 1), w))
    return out


def in_order(opening, heard):
    """How many of the opening words are heard, in their order."""
    n, k = 0, 0
    for w in heard:
        if k < len(opening) and w == opening[k]:
            n += 1; k += 1
        elif k + 1 < len(opening) and w == opening[k + 1]:
            n += 1; k += 2
    return n


def verse_second(verse_text, stream, lo, hi):
    """The second the verse starts being read: the first place from `lo` to `hi` where the
    captions say the verse's opening words straight on, in order (one may be missed, the first
    among them). None when the captions don't show the opening."""
    opening = [w for w in tokens(verse_text) if len(w) > 1][:OPENING]
    if len(opening) < 2:
        return None
    need = len(opening) - 1 if len(opening) >= 4 else len(opening)
    for i, (sec, w) in enumerate(stream):
        if sec < lo: continue
        if sec > hi: break
        if w != opening[0] and w != opening[1]: continue
        start = 0 if w == opening[0] else 1
        rest = opening[start:]
        heard = [x for _, x in stream[i:i + len(rest) + 2]]
        # The words run on from here: the next word heard is the verse's next (or the one after).
        if len(heard) < 2 or heard[1] not in rest[1:3]: continue
        if in_order(rest, heard) >= need - start:
            return round(sec, 1)
    return None


def readings_of(t):
    """[(book, chapter, verse, seconds)] for one transcript."""
    segs = [(s[0], prep.tidy(s[1])) for s in t["segments"]]
    if not segs:
        return []
    # One string, with the second each character was said at.
    text, starts = [], []
    pos = 0
    for sec, s in segs:
        text.append(s); starts.append((pos, sec)); pos += len(s) + 1
    text = " ".join(text)
    def sec_at(i):
        lo, hi = 0, len(starts) - 1
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if starts[mid][0] <= i: lo = mid
            else: hi = mid - 1
        return starts[lo][1]
    # Words heard, by second, for the reading check.
    heard_at = [(sec, set(words(s))) for sec, s in segs]
    stream = timed_tokens(segs)
    def heard(a, b):
        out = set()
        for sec, ws in heard_at:
            if a <= sec <= b: out |= ws
        return out
    refs = []
    for pat in prep.PATTERNS:
        for m in pat.finditer(text):
            book = prep.resolve_book(m.group(1))
            if not book: continue
            ch, a = prep._n(m.group(2)), prep._n(m.group(3))
            b = prep._n(m.group(4)) if m.lastindex and m.lastindex >= 4 and m.group(4) else None
            if not ch or not a: continue
            refs.append((m.start(), book, ch, a, b))
    refs.sort()
    out, seen = [], set()
    for at, book, ch, a, b in refs:
        body = prep.chapter(book, ch)
        if body is None or a > len(body): continue
        sec = sec_at(at)
        hw = heard(sec, sec + WINDOW)
        last = min(b or a, len(body))
        # The verses called for, then on past them while the reading continues; each verse's own
        # second is looked for after the one before it.
        v, misses, cursor = a, 0, sec - 5
        while v <= len(body) and v <= last + FOLLOW:
            score = read_score(body[v - 1], hw)
            if score >= MATCH:
                key = (book, ch, v)
                at_verse = verse_second(body[v - 1], stream, cursor, sec + WINDOW + 30)
                if at_verse is not None: cursor = at_verse
                if key not in seen or all(abs(sec - s) > 600 for (bk, c, vv, s, _) in out if (bk, c, vv) == key):
                    out.append((book, ch, v, int(sec), at_verse)); seen.add(key)
                misses = 0
            else:
                misses += 1
                if v > last and misses >= 2: break
                if v > last + 1 and misses >= 1 and score < 0.2: break
            v += 1
    return out


def one(path, force=False):
    t = json.load(open(path))
    vid = t["videoId"]
    os.makedirs(CACHE, exist_ok=True)
    tag = (t.get("sourceSha256") or hashlib.sha1(open(path, "rb").read()).hexdigest()) + VERSION
    cp = os.path.join(CACHE, f"{vid}.json")
    if not force and os.path.exists(cp):
        c = json.load(open(cp))
        if c.get("tag") == tag:
            # A cached teacher was named before data/names.tsv changed; give today's spelling.
            meta = c["meta"]
            if meta.get("teacher"): meta["teacher"] = prep.official_name(meta["teacher"])
            return c["rows"], meta
    rows = readings_of(t)
    text = " ".join(s[1] for s in t["segments"][:400])
    who, _ = prep.teacher_of(text)
    meta = {"title": t.get("cleanTitle") or t.get("title") or "", "date": t.get("date") or "", "teacher": who or "", "duration": t.get("duration") or 0}
    json.dump({"tag": tag, "rows": rows, "meta": meta}, open(cp, "w"))
    return rows, meta


def main(argv):
    files = [os.path.join(ROOT, "blog", "transcripts", f"{a}.json") for a in argv] if argv else sorted(glob.glob(os.path.join(ROOT, "blog", "transcripts", "*.json")))
    books, videos = {}, {}
    n = 0
    for i, f in enumerate(files):
        try:
            rows, meta = one(f, force=bool(argv))
        except Exception as e:  # a broken transcript should not stop the rest
            print(f"  {os.path.basename(f)}: {e}", file=sys.stderr); continue
        vid = os.path.basename(f)[:-5]
        if argv:
            for b, c, v, s, at in rows: print(f"{vid} {s:>6}s  {b} {c}:{v}  read at {at}")
        if not rows: continue
        videos[vid] = meta
        for b, c, v, s, at in rows:
            row = [vid, s] if at is None else [vid, s, at]
            books.setdefault(prep.SLUG[b], {}).setdefault(str(c), {}).setdefault(str(v), []).append(row)
            n += 1
        if (i + 1) % 500 == 0: print(f"  {i + 1}/{len(files)} transcripts, {n} readings", file=sys.stderr)
    if argv: return
    os.makedirs(OUT, exist_ok=True)
    for slug, chs in books.items():
        for c in chs.values():
            for v in c.values(): v.sort(key=lambda r: (videos[r[0]]["date"] or "0000"), reverse=True)
        json.dump(chs, open(os.path.join(OUT, f"{slug}.json"), "w"), separators=(",", ":"))
    json.dump(videos, open(os.path.join(OUT, "videos.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{n} readings of {sum(len(v) for chs in books.values() for v in chs.values())} verses in {len(books)} books, from {len(videos)} classes")


if __name__ == "__main__":
    main(sys.argv[1:])
