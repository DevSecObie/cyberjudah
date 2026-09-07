#!/usr/bin/env python3
"""What is still unwritten, and when it aired.

    queue.py covered
    queue.py plan <listing.json>... [--series NAME] [--title-contains STR]
                                    [--min-minutes 10] [--as-of YYYY-MM-DD] [--limit N]

`covered` prints every video id already written up, read out of the data-video-id in the
notes. That set is the whole memory of the pipeline: a video is done when a note cites it.

`plan` takes listings saved from the transcript API -- any of list_channel_videos,
search_channel_videos or get_channel_latest_videos, in any mixture -- and prints the ones
not yet covered, newest first, as TSV: date, video id, minutes, title.

The date is the part worth having a script for. The RSS listing carries an exact timestamp;
the search listing carries only "Streamed 16 hours ago", which has to be resolved against
the day the listing was taken, not the day the note is written. Getting that wrong dates a
Sabbath class to the Sunday. Where a video appears in more than one listing the exact date
wins; where only a relative age is known the date is marked ~ so it can be checked.

Nothing here touches the network. Save the API responses to disk, point this at them, and
it will tell you what to work on next.
"""
import json, os, re, sys, glob
from datetime import date, datetime, timedelta, timezone

ROOT = os.environ.get("CJ_ROOT") or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def covered():
    """Every video id any note already cites."""
    ids = set()
    for p in glob.glob(f"{ROOT}/blog/*/*.md") + glob.glob(f"{ROOT}/captains/*/*.md"):
        ids.update(re.findall(r'data-video-id="([\w-]{11})"', open(p, encoding="utf-8").read()))
    return ids

def seconds(text):
    """"2:52:08" -> 10328. None for Upcoming, LIVE, or anything not a duration."""
    if not text or not re.fullmatch(r"[\d:]+", text.strip()):
        return None
    s = 0
    for part in text.strip().split(":"):
        s = s * 60 + int(part)
    return s

REL = re.compile(r"(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago", re.I)
DAYS = {"second": 1 / 86400, "minute": 1 / 1440, "hour": 1 / 24, "day": 1,
        "week": 7, "month": 30.44, "year": 365.25}

def when(row, as_of):
    """(date, exact). Prefers a real timestamp; falls back to resolving "16 hours ago"."""
    iso = row.get("published") or row.get("publishedAt")
    if iso:
        try:
            return datetime.fromisoformat(iso.replace("Z", "+00:00")).date(), True
        except ValueError:
            pass
    m = REL.search(row.get("publishedTimeText") or "")
    if m:
        return as_of - timedelta(days=round(int(m.group(1)) * DAYS[m.group(2).lower()])), False
    return None, False

def rows_of(payload):
    """The video rows out of whichever listing shape this is."""
    c = payload.get("content", payload)
    if isinstance(c, str):
        return []
    out = c.get("results") or c.get("videos") or []
    return [r for r in out if isinstance(r, dict) and r.get("videoId")]

def load(paths):
    """Merge every listing, keeping the best-known date for each video."""
    best = {}
    for p in paths:
        try:
            payload = json.load(open(p, encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            print(f"  ! skipping {os.path.basename(p)}: {e}", file=sys.stderr)
            continue
        for r in rows_of(payload):
            vid = r["videoId"]
            prev = best.get(vid)
            # A row carrying an exact timestamp beats one carrying only a relative age.
            if prev is None or (not prev.get("_exact") and (r.get("published") or r.get("publishedAt"))):
                best[vid] = dict(r)
    return best

def main(argv):
    if not argv:
        print(__doc__); return 2
    cmd, args = argv[0], argv[1:]

    if cmd == "covered":
        for v in sorted(covered()):
            print(v)
        return 0

    if cmd != "plan":
        print(__doc__); return 2

    def opt(name, default=None):
        return args[args.index(name) + 1] if name in args else default
    paths = [a for a in args if not a.startswith("--") and not _is_optval(args, a)]
    as_of = date.fromisoformat(opt("--as-of")) if opt("--as-of") else datetime.now(timezone.utc).date()
    min_s = float(opt("--min-minutes", 10)) * 60
    needle = (opt("--title-contains") or "").lower()
    limit = int(opt("--limit", 0) or 0)

    done = covered()
    todo = []
    skipped = {"covered": 0, "short": 0, "no duration": 0, "title": 0}
    for vid, r in load(paths).items():
        title = r.get("title", "")
        if needle and needle not in title.lower():
            skipped["title"] += 1; continue
        if vid in done:
            skipped["covered"] += 1; continue
        secs = seconds(r.get("lengthText") or r.get("length_text") or "")
        if secs is None:
            skipped["no duration"] += 1; continue      # premiere, live, or upcoming
        if secs < min_s:
            skipped["short"] += 1; continue
        d, exact = when(r, as_of)
        todo.append((d or date.min, exact, vid, secs, title))

    todo.sort(key=lambda t: t[0], reverse=True)
    if limit:
        todo = todo[:limit]
    for d, exact, vid, secs, title in todo:
        stamp = ("" if exact else "~") + (d.isoformat() if d != date.min else "unknown")
        print(f"{stamp}\t{vid}\t{secs // 60}m\t{title}")
    note = ", ".join(f"{v} {k}" for k, v in skipped.items() if v)
    print(f"\n{len(todo)} to write" + (f"  ·  skipped: {note}" if note else ""), file=sys.stderr)
    return 0

def _is_optval(args, a):
    """True if `a` is the value belonging to a --flag rather than a path."""
    i = args.index(a)
    return i > 0 and args[i - 1].startswith("--")

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
