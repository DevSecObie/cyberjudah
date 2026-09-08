"""Check class and episode notes against the spec in README.md.

    lint.py                 every note
    lint.py <note.md> ...   just these
    lint.py --quiet         errors only, no warnings

`check.py` validates the quoted scripture, which is the part that must be exact. This checks
the shape around it: the frontmatter, the sections, the video mount, the nav line. Nothing did,
and the drift is what you would expect from that -- one note ended up with no nav line at all,
two with no closing section, and for a while every note in the repo carried a "Transcript" link
pointing at the page it was printed on.

Errors are things that are wrong: a missing section, a malformed tag list, a self-referential
link, a scripture link to a chapter that does not exist. Warnings are things that are merely
absent and need a human with the recording: no video id, no teacher, an estimated date.

Exits non-zero if there is an error, so it can gate a commit. Warnings never fail it.
"""
import os, re, sys, glob, json

ROOT = os.environ.get("CJ_ROOT") or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TITLES = ("Bishop", "Deacon", "Captain", "Elder", "Officer")
SERIES = {"blog": "IUIC in the ClassRoom", "captains": "15 Minutes w/ The Captains", "history": "Our Hidden History"}
INDEX = {"blog": "[Class Notes Index](/classes)", "captains": "[15 Minutes Index](/captains)", "history": "[Our Hidden History Index](/history)"}
# Structural: every note has these, and their absence means the note is malformed.
REQUIRED_SECTIONS = ["## Introduction", "## Scriptures Opened"]
# Expected, but a class can simply end -- two do. Whether the teacher gave closing words is a
# question for the recording, so this is not something to fail a commit over.
EXPECTED_SECTIONS = ["## In Closing"]
REQUIRED_KEYS = ["title", "slug", "date", "description", "tags"]

BOOKS = {e["slug"]: e for e in json.load(open(f"{ROOT}/data/bible/index.json"))}
_chapters = {}


def chapter_ids(slug):
    """The chapter numbers a book actually has, which is not 1..n for all of them: Greek
    Esther exists only as the Additions and is numbered 10 to 16."""
    if slug not in _chapters:
        _chapters[slug] = {int(k) for k in json.load(open(f"{ROOT}/data/bible/{slug}.json"))["chapters"]}
    return _chapters[slug]


def topics():
    p = f"{ROOT}/data/topics.tsv"
    if not os.path.exists(p):
        return set()
    return {l.split("\t")[0] for l in open(p, encoding="utf-8").read().split("\n")[1:] if l.strip()}


TOPICS = topics()


def lint(path):
    """Returns (errors, warnings) as lists of strings."""
    E, W = [], []
    rel = os.path.relpath(path, ROOT)
    feed = "blog" if rel.startswith("blog") else "history" if rel.startswith("history") else "captains"
    text = open(path, encoding="utf-8").read()

    # ---- frontmatter ----
    if not text.startswith("---\n") or "\n---\n" not in text:
        return [f"{rel}: no frontmatter"], W
    end = text.index("\n---\n", 4)
    head, body = text[4:end].split("\n"), text[end + 5:]

    seen = {}
    for line in head:
        if ":" not in line or line.startswith((" ", "-")):
            continue
        k = line.split(":", 1)[0]
        seen.setdefault(k, []).append(line.split(":", 1)[1].strip())
    # A text merge of two branches that both added a key leaves two of it, which is a
    # duplicate YAML mapping key and fails the build with a stack trace rather than a message.
    for k, vals in seen.items():
        if len(vals) > 1:
            E.append(f"{rel}: duplicate frontmatter key `{k}` ({len(vals)}x) -- this fails the build")
    for k in REQUIRED_KEYS:
        if k not in seen:
            E.append(f"{rel}: frontmatter has no `{k}`")

    unq = lambda v: v[1:-1] if len(v) > 1 and v[0] == v[-1] == '"' else v
    slug = unq(seen.get("slug", [""])[0])
    date = unq(seen.get("date", [""])[0])

    if slug and not slug.startswith(f"{date[:4]}/"):
        E.append(f"{rel}: slug {slug!r} does not start with the year of date {date!r}")
    if slug and os.path.basename(path)[:-3] != f"{date}-{slug.split('/')[-1]}":
        W.append(f"{rel}: filename does not match `<date>-<slug>`")

    # ---- Our Hidden History: the note's slug is the transcript's, so the page keeps its address ----
    if feed == "history":
        vid_m = re.search(r'data-video-id="([^"]*)"', body)
        tpath = f"{ROOT}/history/transcripts/{vid_m.group(1)}.json" if vid_m else None
        if not tpath or not os.path.exists(tpath):
            E.append(f"{rel}: no transcript in history/transcripts for this video id; ingest it first")
        else:
            tslug = json.load(open(tpath)).get("slug")
            if tslug and slug != tslug:
                E.append(f"{rel}: slug {slug!r} must be the transcript's {tslug!r}")

    # ---- tags ----
    raw = seen.get("tags", ["[]"])[0]
    tags = re.findall(r'"((?:[^"\\]|\\.)*)"', raw)
    if not tags:
        E.append(f"{rel}: `tags` is empty or not a list of quoted strings")
    else:
        if tags[0] != SERIES[feed]:
            E.append(f"{rel}: first tag is {tags[0]!r}, expected the series {SERIES[feed]!r}")
        for t in tags[1:]:
            if TOPICS and t not in TOPICS:
                E.append(f"{rel}: tag {t!r} is not a slug in data/topics.tsv")
        if len(set(tags)) != len(tags):
            E.append(f"{rel}: repeated tag")

    # ---- teacher ----
    if "teacher" in seen:
        who = unq(seen["teacher"][0])
        if not who:
            # An empty `teacher:` is the placeholder waiting for a hand edit off the recording.
            # It is deliberate, so it warns like a missing name rather than failing the deploy.
            W.append(f"{rel}: `teacher` is an empty placeholder -- fill it in from the recording")
        elif not who.startswith(TITLES):
            E.append(f"{rel}: teacher {who!r} has no rank title; the browse chips group by it")
    else:
        W.append(f"{rel}: no teacher recorded")

    # ---- body furniture ----
    if '<p class="taught">' not in body:
        E.append(f'{rel}: no <p class="taught"> line')
    elif "(date estimated)" in body:
        W.append(f"{rel}: date is estimated")
    if "<!-- truncate -->" not in body:
        E.append(f"{rel}: no <!-- truncate --> marker; the feed would show the whole note")
    if '<span class="opens">' not in body:
        W.append(f"{rel}: no `Opens` line -- run `npm run notes:fix`")

    for s in (["## Introduction", "## Readings and Scriptures"] if feed == "history" else REQUIRED_SECTIONS):
        if s not in body:
            E.append(f"{rel}: no `{s}` section")
    for s in EXPECTED_SECTIONS:
        if s not in body:
            W.append(f"{rel}: no `{s}` section -- check the recording; some classes just end")

    # ---- the recording ----
    vid = re.search(r'data-video-id="([^"]*)"', body)
    stamps = re.findall(r"\*\[(?:\[)?(\d{1,2}:\d{2}(?::\d{2})?)", body)
    if not vid:
        W.append(f"{rel}: no video id -- the player is absent and {len(stamps)} timestamps stay plain text")
    elif not re.fullmatch(r"[\w-]{11}", vid.group(1)):
        E.append(f"{rel}: video id {vid.group(1)!r} is not 11 characters")
    else:
        unlinked = len(re.findall(r"\*\[\d{1,2}:\d{2}(?::\d{2})?\]\*", body))
        if unlinked:
            W.append(f"{rel}: {unlinked} timestamps not linked to the recording -- run `npm run notes:fix`")

    # ---- the nav line ----
    nav = re.search(r"^\[(?:Class Notes|15 Minutes|Our Hidden History) Index\]\([^)]*\).*$", body, re.M)
    if not nav:
        E.append(f"{rel}: no nav line at the end of the note")
    else:
        line = nav.group(0)
        if not line.startswith(INDEX[feed]):
            E.append(f"{rel}: nav line should start with {INDEX[feed]}")
        # The bug this file exists to prevent: for months every note linked "the full session"
        # to the page the link was printed on.
        for target in re.findall(r"\]\((/[^)]*)\)", line):
            if slug and target.rstrip("/").endswith(slug):
                E.append(f"{rel}: nav line links to this same page ({target})")

    # ---- scripture links ----
    for bslug, ch in re.findall(r"\]\(/bible/([a-z0-9-]+)/(\d+)", body):
        if bslug not in BOOKS:
            E.append(f"{rel}: link to unknown book /bible/{bslug}")
        elif int(ch) not in chapter_ids(bslug):
            have = sorted(chapter_ids(bslug))
            E.append(f"{rel}: /bible/{bslug}/{ch} -- {BOOKS[bslug]['book']} has {have[0]}-{have[-1]}")

    return E, W


def main(argv):
    quiet = "--quiet" in argv
    paths = [a for a in argv if not a.startswith("-")]
    if not paths:
        paths = sorted(glob.glob(f"{ROOT}/blog/*/*.md")) + sorted(glob.glob(f"{ROOT}/captains/*/*.md")) + sorted(glob.glob(f"{ROOT}/history/notes/*/*.md"))
    errors = warnings = 0
    for p in paths:
        E, W = lint(p)
        errors += len(E)
        warnings += len(W)
        for m in E:
            print("error: " + m)
        if not quiet:
            for m in W:
                print("warn:  " + m)
    print(f"\n{len(paths)} notes · {errors} errors · {warnings} warnings")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
