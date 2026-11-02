#!/usr/bin/env python3
"""Write the study-guide note of a class from its transcript, unattended.

    scripts/notes/auto.py                      # the newest class with a transcript and no note
    scripts/notes/auto.py --limit 2            # the two newest
    scripts/notes/auto.py --video CiL1d9RUSfE  # one class in particular
    scripts/notes/auto.py --plan               # list the queue and stop
    scripts/notes/auto.py --video ID --from-json draft.json   # render a saved draft, no model

The queue is every transcript in blog/transcripts with no note citing its video, newest first,
so the latest Sabbath's classes are written first and the backlog after them. For each class:

  1. prep.py condenses the captions and verifies every scripture reference it can find
  2. Claude reads the whole condensed class and returns the note as data: what the class
     is about, each passage opened with the points made on it, precepts, class questions,
     the closing charge (scripts/notes/README.md is the spec, and the prompt)
  3. lib.py renders the note, every verse pulled from data/bible, never from the model;
     a reference that does not resolve is dropped, not guessed
  4. check.py verifies every quoted verse, notes:fix links the timestamps and tags it,
     notes:lint checks the shape; a note that fails is not written

Needs ANTHROPIC_API_KEY. One note, one commit, done by the workflow.
"""
import argparse, glob, json, os, re, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "scripts", "notes"))
import prep  # noqa: E402
import lib  # noqa: E402
import class_order  # noqa: E402

MODEL = os.environ.get("NOTES_MODEL", "claude-opus-5")
FEED_DIR = {"classes": "blog", "captains": "captains"}
SERIES = {"classes": "IUIC in the ClassRoom", "captains": "15 Minutes w/ The Captains"}
SKIP_TITLES = re.compile(r"patient saints radio|power hour|\bpsr\b", re.I)
MIN_WORDS = 2500

# Video ids to hold out of the queue regardless of what GitHub says, each commented with the
# PR that justifies it. Remove the line once that PR lands.
HOLD = {
    "EBEwdiVcsTg": 41,  # copilot/add-class-notes-for-spiritual-uprising
}

SPEC = """You write the class notes of CyberJudah, a library of the King James Bible (with the Apocrypha) \
and the teaching given from it in the Sabbath classes of IUIC. You are given the captions of one class, \
condensed into timestamped paragraphs, and the scripture references already verified in it.

The note is a study guide, not a transcript. The transcript keeps every word; the note is what a student \
keeps: the concrete points that were made, and the breakdown of each scripture that was opened.

Return ONLY a JSON object with this shape (no prose around it):

{
  "teacher": "Captain Yahn" | null,          // only if he names himself as the one teaching; else null
  "about": "one or two sentences: what the class is about and why he taught it",
  "intro_ts": "4:05",                          // the timestamp of the teacher's first words
  "news": [ {"ts": "12:38", "clip": "what was played, in a line", "point": "the point it was played to make"} ],
  "passages": [
    {
      "ref": "Deuteronomy 32:7-9",             // KJV book name, chapter:verse or verse-range; only verses he actually read
      "ts": "18:01",                           // when it was opened
      "points": ["one concrete point he made on it, in his words but without the run-on", "..."],
      "precepts": [ {"ref": "Sirach 4:27", "note": "the one line he drew from it"} ]
    },
    {                                          // a book, article or clip read aloud, in its place among the passages
      "reading": "*History of the Jews* by Heinrich Graetz, p. 42",  // title, author, page, only as stated on air
      "ts": "42:20",
      "reader": "Captain Yahn" | null,         // who read it, when it was not the teacher and he is named
      "walk": [ {"read": ["the words read, verbatim"], "notes": ["what was said on that stretch"]} ]
    }
  ],
  "questions": [ {"q": "a question he put to the class", "a": "the answer he gave"} ],
  "closing": {"ts": "2:31:10", "text": "his charge to the class, in his words, kept to the point he closed on"},
  "announcements": ["an announcement or a reference given, one line each"]
}

Rules:
- Passages in the order they were opened. Three to six points a passage. A point says what the verse \
means, who it is about, what it corrects, or what to do with it; a point that re-reads the verse is not a point.
- Use only references the teacher opened. Prefer the verified list; add one only when the captions make \
the book, chapter and verse certain. Verses come from the Bible itself later; never write verse text.
- The teacher's words, cleaned of filler, stutters and caption errors, never your own commentary or praise.
- Greetings, roll calls, shout-outs, the sound check, the words of a thumbnail video, a story told for \
effect: at most a line, usually nothing.
- Every book, article or definition read aloud is a "reading" item in "passages", where it was read: \
the words read quoted verbatim, stretch by stretch, each followed by what was said on it. Never paraphrase \
a reading into points, and never shorten one.
- A clip in "news" is named, not transcribed. Leave a list empty when the class had none.
- Timestamps as m:ss or h:mm:ss, from the paragraph where it happened.
- Names as the library spells them: Bishop Nathanyel, Captain Yahn, Deacon Malachi. When unsure, the \
form the captions use most.
- Say nothing about captions, transcripts or what could not be heard."""


def mmss(s):
    s = int(s); h, rem = divmod(s, 3600); m, sec = divmod(rem, 60)
    return f"{h}:{m:02d}:{sec:02d}" if h else f"{m}:{sec:02d}"


def _key(title, date):
    return (date or "", re.sub(r"[^a-z0-9]+", " ", (title or "").lower()).strip())


def noted():
    """The videos the notes cite, and the (date, title) of every note for the notes with no mount."""
    ids, keys = set(), set()
    for f in glob.glob(f"{ROOT}/blog/**/*.md", recursive=True) + glob.glob(f"{ROOT}/captains/**/*.md", recursive=True):
        try: txt = open(f, encoding="utf-8").read()
        except OSError: continue
        for m in re.finditer(r'data-video-id="([\w-]{11})"', txt): ids.add(m.group(1))
        title = re.search(r'^title:\s*"?(.*?)"?\s*$', txt, re.M)
        date = re.search(r'^date:\s*"?(\d{4}-\d{2}-\d{2})', txt, re.M)
        if title and date: keys.add(_key(title.group(1), date.group(1)))
    return ids, keys


def open_pr_note_paths():
    """note path (repo-relative) -> PR number, for every file an open pull request already changes.
    None when GitHub could not be listed, so callers skip nothing extra rather than fail."""
    try:
        r = subprocess.run(["gh", "pr", "list", "--state", "open", "--json", "number,files", "--limit", "200"],
                            cwd=ROOT, text=True, capture_output=True, timeout=30)
        if r.returncode != 0: raise RuntimeError((r.stderr or r.stdout).strip()[-300:] or "gh exited nonzero")
        prs = json.loads(r.stdout)
        paths = {}
        for pr in prs:
            for f in pr.get("files", []):
                paths.setdefault(f["path"], pr["number"])
        return paths
    except Exception as e:
        print(f"warning: could not list open PRs ({e}); --plan will not skip notes already in a PR this run", flush=True)
        return None


def queue(feed, precepts=False):
    """Transcripts with no note, newest first: the latest Sabbath first, then the backlog.
    A class on the HOLD list, or whose note path is already in an open PR's files, is left out.
    With precepts, the queue for precept passes: a blog note does not count as done (a class with a
    note can still lack its precept pass), and an open PR counts when it has the class's precept file."""
    ids, keys = (set(), set()) if precepts else noted()
    pr_paths = open_pr_note_paths()
    rows = []
    for f in glob.glob(f"{ROOT}/{FEED_DIR[feed]}/transcripts/*.json"):
        try: t = json.load(open(f, encoding="utf-8"))
        except (OSError, ValueError): continue
        if t.get("feed") != feed or t["videoId"] in ids or not t.get("date"): continue
        if _key(t.get("cleanTitle") or t.get("title"), t["date"]) in keys or _key(t.get("title"), t["date"]) in keys: continue
        if SKIP_TITLES.search(t.get("title", "")) or (t.get("words") or 0) < MIN_WORDS: continue
        if t["videoId"] in HOLD:
            print(f"skipped {t['videoId']} — note in open PR #{HOLD[t['videoId']]}", flush=True)
            continue
        if pr_paths is not None:
            rel = f"data/precepts/classes/{t['videoId']}.json" if precepts else os.path.relpath(note_path(t, feed), ROOT)
            if rel in pr_paths:
                print(f"skipped {t['videoId']} — note in open PR #{pr_paths[rel]}", flush=True)
                continue
        rows.append(t)
    rows.sort(key=lambda t: (t["date"], t.get("views") or 0), reverse=True)
    return rows


def raw_lines(t):
    return "\n".join(f"[{s[0]}s] {s[1]}" for s in t["segments"] if s[0] >= (t.get("start") or 0) - 60)


def filed_teacher(video):
    """Who taught a class when the class never names its teacher: an admin correction in
    data/sources/class-teachers.tsv first, then who the sabbath-classes-images transcripts
    are filed under (data/sources/r2-class-teachers.tsv)."""
    for name, vcol, tcol in (("class-teachers.tsv", 0, 1), ("r2-class-teachers.tsv", 2, 3)):
        path = os.path.join(ROOT, "data", "sources", name)
        if not os.path.exists(path): continue
        for line in open(path, encoding="utf-8"):
            cols = line.rstrip("\n").split("\t")
            if len(cols) > max(vcol, tcol) and cols[vcol] == video and cols[tcol]: return cols[tcol]
    return ""


def outline(video):
    """The class's own outline from the sabbath-classes-images R2 bucket, read live and never
    saved: {key, status, teacher, title, date, refs, text}, or None when the class has no matched
    outline (data/sources/r2-classes.tsv) or the R2 keys are not set. Supplementary: use it to
    settle a reference, a word or a name the captions garble; the class's own words still win."""
    path = os.path.join(ROOT, "data", "sources", "r2-classes.tsv")
    if not os.path.exists(path) or not os.environ.get("R2_ACCESS_KEY_ID"): return None
    rows = []
    for line in open(path, encoding="utf-8"):
        c = line.rstrip("\n").split("\t")
        if len(c) > 11 and c[1] in ("match", "probable") and (c[2] == video or video in c[11].split(",")):
            rows.append(c)
    if not rows: return None
    rows.sort(key=lambda c: (c[1] != "match", c[7] != "en"))   # a confirmed English outline first
    sys.path.insert(0, os.path.join(ROOT, "scripts", "r2"))
    import match
    o = match.fetch(rows[0][0])
    return {"key": rows[0][0], "status": rows[0][1], "teacher": rows[0][5], "title": o["title"],
            "date": rows[0][6], "refs": [f"{b} {c}:{f}" + (f"-{l}" if l != f else "") for b, c, f, l in o["refs"]],
            "text": o["text"]}


def prepare(t):
    paras, _ = prep.condense(raw_lines(t))
    text = "\n\n".join(paras)
    refs = []
    for r in prep.extract(text):
        good, detail = prep.verify(r)
        if good and detail not in refs: refs.append(detail)
    who, _ = prep.teacher_of(text[:12000])
    return text, refs, who or filed_teacher(t.get("videoId", ""))


def ask_model(t, text, refs, who):
    import anthropic
    client = anthropic.Anthropic()
    user = (f"Class: {t['title']}\nDate: {t['date']}\nTeacher, if he named himself: {who or 'not stated'}\n\n"
            f"Verified references, in the order called for:\n" + ("\n".join(f"- {r}" for r in refs) or "- (none found)") +
            f"\n\nThe class, condensed with timestamps:\n\n{text}")
    for attempt in range(2):
        with client.messages.stream(model=MODEL, max_tokens=32000, thinking={"type": "adaptive"}, system=SPEC,
                                    messages=[{"role": "user", "content": user}]) as stream:
            out = "".join(stream.text_stream)
        m = re.search(r"\{.*\}", out, re.S)
        try:
            return json.loads(m.group(0) if m else out)
        except ValueError:
            if attempt: raise
            time.sleep(5)


def _precepts(items):
    """The precepts that resolve, as lib.P renders them under the bullet before them; '' if none."""
    good = []
    for p in items or []:
        try: lib.parse(p["ref"]); good.append((p["ref"], p["note"].strip()))
        except SystemExit as e: print(f"  dropped precept {p.get('ref')!r}: {e}", flush=True)
    return lib.P(good) if good else ""


def _norm(text):
    return " ".join(re.sub(r"[^a-z ]", " ", text.lower().replace("\u2019", "'").replace("'", "")).split())


def _verses_of(point, book, ch, vs):
    """The verse (or run of verses) a point opens on, from the verse words before its first colon."""
    if not isinstance(point, str) or ": " not in point[:240]:
        return None
    phrase = _norm(point.split(": ", 1)[0])
    if len(phrase.split()) < 2:
        return None
    body = lib.chapters(book)[str(ch)]
    text = {v: _norm(body[v - 1]) for v in vs}
    for size in range(1, len(vs) + 1):
        for k in range(len(vs) - size + 1):
            run = vs[k:k + size]
            if phrase in " ".join(text[v] for v in run):
                return (run[0], run[-1])
    return None


def _span(a, b):
    return str(a) if a == b else f"{a}-{b}"


def block(ref, ts, points, precepts):
    """A passage walked the way it was read: each verse, or the verses read straight through,
    quoted, then what he said on it, in the order he said it.

    A point that opens with the words of a verse ("Lay siege against it: ...") goes under that
    verse; a point that does not stays with the verse before it. A verse that drew no word of its
    own is quoted with the next one, read straight through. A point may be a precept ({"ref",
    "note"}): it nests under the bullet before it, where the class brought it in. Precepts given
    in "precepts" nest under the last point, as before. A bad reference is dropped, not guessed."""
    try:
        book, ch, vs, spec = lib.parse(ref)
        lib.quote(book, ch, vs)
    except SystemExit as e:
        print(f"  dropped {ref!r}: {e}", flush=True); return None
    head = f"**[{book} {ch}:{spec}](/bible/{lib.SLUG[book]}/{ch}#v{vs[0]})**" + (f"  *[{ts}]*" if ts else "")
    steps = []  # [(first, last) or None, [points]]
    for p in list(points) + list(precepts or []):
        at = _verses_of(p, book, ch, vs)
        if at and (not steps or steps[-1][0] != at):
            steps.append([at, [p]])
        elif steps:
            steps[-1][1].append(p)
        else:
            steps.append([None, [p]])
    if not any(at for at, _ in steps):
        steps = [[(vs[0], vs[-1]), [p for _, items in steps for p in items]]]
    parts, quoted = [head], set()
    for at, items in steps:
        if at:
            a, b = at
            # verses read before this one and not yet quoted were read straight through to it
            while a - 1 in vs and a - 1 not in quoted and a - 1 > max(quoted, default=vs[0] - 1):
                a -= 1
            parts.append(lib.quote(book, ch, [v for v in vs if a <= v <= b]))
            quoted.update(range(a, b + 1))
        run = []
        for p in items:
            if isinstance(p, dict):
                run.append(p); continue
            if run: parts.append(_precepts(run).rstrip("\n")); run = []
            if p.strip(): parts.append(f"- {p.strip()}")
        if run: parts.append(_precepts(run).rstrip("\n"))
    rest = [v for v in vs if v not in quoted and v > max(quoted, default=0)]
    if rest:
        parts.append(lib.quote(book, ch, rest))
    left = [v for v in vs if v not in quoted and v not in rest]
    if left:
        # verses that drew nothing and sit between ones that did: quote them where they fall
        print(f"  {ref}: verses {left} drew no comment", flush=True)
    return "\n\n".join(x for x in parts if x) + "\n"


def render(t, d, feed):
    series = SERIES[feed]
    title = t.get("cleanTitle") or t["title"]
    vid, date, slug = t["videoId"], t["date"], t["slug"]
    teacher = (d.get("teacher") or "").strip()
    fm = [f'title: "{title.replace(chr(34), chr(39))}"', f'slug: "{slug}"', f'date: "{date}"']
    if teacher: fm.append(f'teacher: "{teacher}"')
    fm += [f'description: "{series} · {date}"', f'tags: ["{series}"]']
    out = ["---", *fm, "---", "", f'<p class="taught">{series} · {date}</p>', "", "<!-- truncate -->", "",
           f'<div class="class-video-mount" data-video-id="{vid}"></div>', "", "## Introduction", ""]
    out.append(f"*[{d.get('intro_ts') or mmss(t.get('start') or 0)}]* {d.get('about', '').strip()}")
    out.append("")
    if d.get("news"):
        out += ["## In The News", ""]
        for n in d["news"]:
            out.append(f"- *[{n.get('ts', '')}]* **{n.get('clip', '').strip()}** — {n.get('point', '').strip()}")
        out.append("")
    out += ["## Scriptures Opened", ""]
    kept = 0
    for p in d.get("passages", []):
        if p.get("reading"):
            walk = [([x.strip() for x in w.get("read", []) if x.strip()], [x.strip() for x in w.get("notes", []) if x.strip()])
                    for w in p.get("walk", [])]
            if any(r for r, _ in walk): out += [lib.R(p["reading"].strip(), p.get("ts"), walk, reader=p.get("reader")), ""]
            continue
        if p.get("said"):
            # teaching that opened no scripture, in its place in the class
            label = f"**{p['label'].strip()}** — " if p.get("label") else ""
            out += [f"*[{p.get('ts', '')}]* {label}{p['said'].strip()}", ""]
            continue
        s = block(p.get("ref", ""), p.get("ts"), [x if isinstance(x, dict) else x.strip() for x in p.get("points", [])
                                                 if isinstance(x, dict) or x.strip()], p.get("precepts"))
        if s: out += [s, ""]; kept += 1
    if not kept: raise SystemExit("no passage resolved; the note is not written")
    if d.get("questions"):
        out += ["## Class Questions", ""]
        for q in d["questions"]:
            out.append(f"- **{q.get('q', '').strip()}** {q.get('a', '').strip()}")
        out.append("")
    if d.get("closing", {}).get("text"):
        out += ["## In Closing", "", f"*[{d['closing'].get('ts', '')}]* {d['closing']['text'].strip()}", ""]
    if d.get("announcements"):
        out += ["## Announcements & References", ""] + [f"- {a.strip()}" for a in d["announcements"]] + [""]
    index = "[Class Notes Index](/classes)" if feed == "classes" else "[15 Minutes Index](/captains)"
    out += ["---", "", f"{index} · [Watch the full session on YouTube ↗](https://www.youtube.com/watch?v={vid})", ""]
    # The note follows the class: each news item goes where the class played it (class_order.py).
    return class_order.reorder("\n".join(out))


def note_path(t, feed):
    """blog/<year>/<date>-<slug>.md, the slug already starting with the date, as every note is filed."""
    year, rest = t["slug"].split("/", 1)
    return f"{ROOT}/{FEED_DIR[feed]}/{year}/{t['date']}-{rest}.md"


def sh(cmd, **kw):
    r = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True, **kw)
    return r.returncode, (r.stdout + r.stderr).strip()


def gate(path):
    """check.py, notes:fix, notes:lint. Returns the failure, or None."""
    code, out = sh(["python3", "scripts/notes/check.py", path])
    if code != 0 or "0 mismatches" not in out and "mismatch" in out: return f"check.py: {out[-600:]}"
    code, out = sh(["npm", "run", "notes:fix", "--silent"])
    if code != 0: return f"notes:fix: {out[-600:]}"
    code, out = sh(["npm", "run", "notes:lint", "--silent"])
    if code != 0: return f"notes:lint: {out[-800:]}"
    return None


def write_one(t, feed, from_json=None):
    print(f"== {t['date']} {t['videoId']} {t['title']}", flush=True)
    text, refs, who = prepare(t)
    print(f"  {len(text)} chars condensed, {len(refs)} references verified, teacher {who or 'not stated'}", flush=True)
    d = json.load(open(from_json, encoding="utf-8")) if from_json else ask_model(t, text, refs, who)
    md = render(t, d, feed)
    path = note_path(t, feed)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "w", encoding="utf-8").write(md)
    fail = gate(path)
    if fail:
        os.remove(path)
        sh(["git", "checkout", "--", "src/data", "blog", "captains"])
        print(f"  NOT written: {fail}", flush=True)
        return False
    words = len(re.sub(r"<[^>]+>", " ", md).split())
    print(f"  wrote {os.path.relpath(path, ROOT)}: {words} words, {len(d.get('passages', []))} passages", flush=True)
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--feed", default="classes", choices=sorted(FEED_DIR))
    ap.add_argument("--limit", type=int, default=1)
    ap.add_argument("--video")
    ap.add_argument("--plan", action="store_true")
    ap.add_argument("--from-json")
    ap.add_argument("--commit", action="store_true", help="commit each note as it is written")
    a = ap.parse_args()
    rows = queue(a.feed)
    if a.video:
        rows = [t for t in rows if t["videoId"] == a.video] or [json.load(open(f"{ROOT}/{FEED_DIR[a.feed]}/transcripts/{a.video}.json"))]
    if a.plan or not rows:
        print(f"{len(rows)} classes with a transcript and no note" + (":" if rows else "."))
        for t in rows[:40]: print(f"  {t['date']}  {t['videoId']}  {t.get('words', 0):>6} words  {t['title']}")
        return 0
    done = 0
    for t in rows[: a.limit]:
        if write_one(t, a.feed, a.from_json):
            done += 1
            if a.commit:
                paths = [p for p in (FEED_DIR[a.feed], "blog", "captains", "site/src/data", "src/data") if os.path.isdir(f"{ROOT}/{p}")]
                sh(["git", "add", "-A", "--", *dict.fromkeys(paths)])
                code, out = sh(["git", "commit", "-q", "-m", f"notes: {t.get('cleanTitle') or t['title']} ({t['date']})\n\nWritten from the transcript by scripts/notes/auto.py; every verse checked against data/bible.\n\nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"])
                if code != 0: print(f"  commit failed: {out[-300:]}", flush=True)
    print(f"done: {done} of {min(a.limit, len(rows))} written", flush=True)
    return 0 if done or not rows else 1


if __name__ == "__main__":
    sys.exit(main())
