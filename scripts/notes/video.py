"""Attach a recording to a note that has none.

    video.py                          notes with no recording, and a search link for each
    video.py set <slug> <url-or-id>   attach one, and link its timestamps

Twelve notes carry timestamps against every scripture opened but no video id, so the player is
absent and 324 timestamps are plain text. The ids were never captured: they are not in the
frontmatter, not in the git history of those files, and there is no orphan thumbnail in
static/img to recover one from. They have to come from the channel.

`set` accepts either a full YouTube URL or a bare id and does the three things that go
together: writes the mount, upgrades the nav line from the index-only form to one that links
the recording, and links every timestamp in the note to its second. Nothing here guesses an
id -- a wrong one would point hundreds of timestamps at the wrong class, which is worse than
no link at all.
"""
import os, re, sys, glob, subprocess, urllib.parse

ROOT = os.environ.get("CJ_ROOT") or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FEEDS = {"blog": ("classes", "Class Notes Index", "Watch the full session"),
         "captains": ("captains", "15 Minutes Index", "Watch the full episode")}
ID = re.compile(r"^[\w-]{11}$")
STAMP = re.compile(r"\*\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]\*")


def notes():
    for feed in FEEDS:
        for path in sorted(glob.glob(os.path.join(ROOT, feed, "*", "*.md"))):
            text = open(path, encoding="utf-8").read()
            if not text.startswith("---\n"):
                continue
            end = text.index("\n---\n", 4)
            head = text[4:end].split("\n")
            get = lambda k: next((re.sub(r'^%s:\s*"?(.*?)"?\s*$' % k, r"\1", l) for l in head if l.startswith(k + ":")), "")
            body = text[end + 5:]
            yield dict(path=path, feed=feed, slug=get("slug"), title=get("title"), date=get("date"),
                       text=text, body=body,
                       vid=(re.search(r'data-video-id="([\w-]{11})"', body) or [None, None])[1]
                       if re.search(r'data-video-id="([\w-]{11})"', body) else None)


def parse_id(s):
    """A bare id, or any of the URL shapes YouTube hands out."""
    s = s.strip()
    if ID.match(s):
        return s
    u = urllib.parse.urlparse(s)
    if u.netloc.endswith("youtu.be"):
        cand = u.path.lstrip("/")
    elif "youtube" in u.netloc:
        q = urllib.parse.parse_qs(u.query).get("v")
        cand = q[0] if q else u.path.rsplit("/", 1)[-1]
    else:
        return None
    return cand if ID.match(cand) else None


def cmd_list(argv):
    rows = [n for n in notes() if not n["vid"]]
    total = 0
    print(f"{len(rows)} notes with no recording\n")
    for n in rows:
        stamps = len(STAMP.findall(n["body"]))
        total += stamps
        q = urllib.parse.quote_plus(f'IUIC "{n["title"]}"')
        print(f"  {n['date']}  {n['title'][:52]:54} {stamps:3} timestamps")
        print(f"      {n['slug']}")
        print(f"      https://www.youtube.com/results?search_query={q}")
    print(f"\n{total} timestamps waiting on an id")
    print("Attach one with: scripts/notes/video.py set <slug> <url>")
    return 0


def cmd_set(argv):
    if len(argv) < 2:
        print("usage: video.py set <slug-or-fragment> <youtube-url-or-id>", file=sys.stderr)
        return 1
    frag, raw = argv[0], argv[1]
    vid = parse_id(raw)
    if not vid:
        print(f"not a YouTube id or URL: {raw!r}", file=sys.stderr)
        return 1
    hits = [n for n in notes() if frag == n["slug"] or frag in n["slug"]]
    if len(hits) != 1:
        print(f"{len(hits)} notes match {frag!r}" + (":" if hits else ""), file=sys.stderr)
        for h in hits[:10]:
            print("   " + h["slug"], file=sys.stderr)
        return 1
    n = hits[0]
    route, index, watch = FEEDS[n["feed"]]
    text = n["text"]

    mount = f'<div class="class-video-mount" data-video-id="{vid}"></div>'
    if n["vid"]:
        text = re.sub(r'<div class="class-video-mount" data-video-id="[\w-]{11}"></div>', mount, text)
    else:
        # Directly after the truncate marker, where every note with a recording carries it.
        if "<!-- truncate -->" not in text:
            print(f"{n['slug']}: no <!-- truncate --> marker to place the mount after", file=sys.stderr)
            return 1
        text = text.replace("<!-- truncate -->\n", f"<!-- truncate -->\n\n{mount}\n", 1)

    # The nav line on these notes is index-only, because there was nothing to link to.
    url = f"https://www.youtube.com/watch?v={vid}"
    nav_old = f"[{index}](/{route})"
    nav_new = f"{nav_old} · [{watch} on YouTube ↗]({url})"
    # [ \t]*$ rather than \s*$: in multiline mode \s* happily eats the newline after the
    # match, and the file loses its trailing newline.
    text = re.sub(r"^\[%s\]\(/%s\)[ \t]*$" % (re.escape(index), route), nav_new.replace("\\", "\\\\"), text, flags=re.M)

    open(n["path"], "w", encoding="utf-8").write(text)
    print(f"{n['slug']} -> {vid}")

    # The timestamps become links now that there is something to link into.
    r = subprocess.run(["node", os.path.join(ROOT, "scripts", "link-timestamps.mjs")],
                       cwd=ROOT, capture_output=True, text=True)
    print("  " + (r.stderr or r.stdout).strip())
    return 0


if __name__ == "__main__":
    argv = sys.argv[1:]
    sys.exit(cmd_set(argv[1:]) if argv[:1] == ["set"] else cmd_list(argv))
