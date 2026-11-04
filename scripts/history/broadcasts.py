"""Preserve actual YouTube broadcast starts, independently of upload timestamps."""
import argparse
import json
import os
import random
import re
import subprocess
import sys
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path

RELATIVE_PATH = "data/sources/class-broadcasts.json"
ROOT = Path(__file__).resolve().parents[2]
# yt-dlp reads this cookies file when it is set, so a lookup can pass YouTube's sign-in check
# ("confirm you're not a bot"), which YouTube puts in front of GitHub's runners.
COOKIES_ENV = "BROADCASTS_COOKIES"


def parse_broadcast(html, video, teaching_date):
    if not re.fullmatch(r"[\w-]{11}", video):
        return None
    try:
        day = date.fromisoformat(teaching_date).isoformat()
        for match in re.finditer(r'"playerMicroformatRenderer"\s*:\s*', html):
            data, _ = json.JSONDecoder().raw_decode(html[match.end():])
            if data.get("externalVideoId") != video:
                continue
            live = data.get("liveBroadcastDetails", {})
            if live.get("isLiveNow") or not live.get("endTimestamp"):
                continue
            start = datetime.fromisoformat(live["startTimestamp"])
            end = datetime.fromisoformat(live["endTimestamp"])
            if start.tzinfo is None or end.tzinfo is None or end < start:
                continue
            return {"date": day, "broadcastAt": start.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")}
    except (ValueError, KeyError, TypeError, AttributeError):
        return None
    return None


def page_problem(html, video):
    """Why parse_broadcast found no start on a fetched page, in a few words."""
    if "consent.youtube.com" in html or "confirm you’re not a bot" in html or "confirm you're not a bot" in html:
        return "YouTube showed a sign-in or consent check instead of the page"
    if '"playerMicroformatRenderer"' not in html:
        return "the page has no player data (blocked or changed)"
    if f'"externalVideoId":"{video}"' not in html.replace(" ", ""):
        return "the page's player data is for another video"
    if '"liveBroadcastDetails"' not in html:
        if '"isLiveContent":false' in html.replace(" ", ""):
            return "not a livestream"
        return "the page has no broadcast details"
    if re.search(r'"isLiveNow"\s*:\s*true', html):
        return "still live"
    if '"endTimestamp"' not in html:
        return "the broadcast has not ended"
    return "the broadcast times could not be read"


def fetch_page(video, teaching_date):
    """The start from the watch page, or None and the reason."""
    try:
        response = subprocess.run([
            "curl", "--fail", "--silent", "--show-error", "--location", "--max-time", "15",
            f"https://www.youtube.com/watch?v={video}",
        ], capture_output=True, text=True, timeout=20)
    except subprocess.TimeoutExpired:
        return None, "the watch page timed out"
    except (OSError, ValueError) as exc:
        return None, f"the watch page could not be fetched ({exc})"
    if response.returncode != 0:
        detail = (response.stderr or "").strip().splitlines()[-1:] or [f"curl exit {response.returncode}"]
        return None, f"the watch page was refused ({detail[0][:120]})"
    row = parse_broadcast(response.stdout, video, teaching_date)
    return row, None if row else page_problem(response.stdout, video)


def fetch_ytdlp(video, teaching_date):
    """The start from yt-dlp (YouTube's player API, the same liveBroadcastDetails), or None and the reason."""
    try:
        day = date.fromisoformat(teaching_date).isoformat()
    except (TypeError, ValueError):
        return None, "the class has no valid date"
    command = ["yt-dlp", "--skip-download", "--ignore-no-formats-error", "--no-warnings", "--ignore-config",
               "--print", "%(id)s %(live_status)s %(release_timestamp)s"]
    cookies = os.environ.get(COOKIES_ENV)
    if cookies and os.path.exists(cookies):
        command += ["--cookies", cookies]
    try:
        response = subprocess.run(command + ["--", video], capture_output=True, text=True, timeout=90)
    except subprocess.TimeoutExpired:
        return None, "yt-dlp timed out"
    except (OSError, ValueError) as exc:
        return None, f"yt-dlp could not run ({exc})"
    if response.returncode != 0:
        detail = (response.stderr or "").strip().splitlines()[-1:] or [f"exit {response.returncode}"]
        return None, f"yt-dlp failed ({detail[0][:160]})"
    parts = response.stdout.strip().split()
    if len(parts) != 3 or parts[0] != video:
        return None, "yt-dlp gave no answer for this video"
    if parts[1] != "was_live":
        return None, "not a finished livestream" if parts[1] in ("not_live", "is_live", "is_upcoming", "post_live") else "yt-dlp could not tell if it was live"
    try:
        start = datetime.fromtimestamp(int(parts[2]), timezone.utc)
    except (ValueError, OverflowError, OSError):
        return None, "yt-dlp gave no broadcast start"
    if abs((start.date() - date.fromisoformat(day)).days) > 1:
        return None, f"yt-dlp's broadcast start ({start.date()}) is not the class's date"
    return {"date": day, "broadcastAt": start.isoformat().replace("+00:00", "Z")}, None


# After this many lookups in a row that YouTube refused outright, a run stops asking: the
# rest would be refused too, and each costs a page fetch and a yt-dlp call.
REFUSED_LIMIT = 5
_refused_in_a_row = 0


def _refused(reason):
    return reason and ("refused" in reason or "sign-in" in reason or "no player data" in reason
                       or "not a bot" in reason or "could not be fetched" in reason
                       or "yt-dlp failed" in reason or "yt-dlp could not run" in reason)


def lookup(video, teaching_date):
    """The start from the watch page, then from yt-dlp; or None and why both missed."""
    global _refused_in_a_row
    if _refused_in_a_row >= REFUSED_LIMIT:
        return None, f"not tried: YouTube refused the last {REFUSED_LIMIT} lookups this run"
    row, page_reason = fetch_page(video, teaching_date)
    if row:
        _refused_in_a_row = 0
        return row, None
    if page_reason in ("not a livestream", "still live", "the broadcast has not ended"):
        _refused_in_a_row = 0
        return None, page_reason
    row, ytdlp_reason = fetch_ytdlp(video, teaching_date)
    if row:
        _refused_in_a_row = 0
        return row, None
    _refused_in_a_row = _refused_in_a_row + 1 if _refused(page_reason) and _refused(ytdlp_reason) else 0
    return None, f"{page_reason}; {ytdlp_reason}"


def record_broadcast(root, video, teaching_date, reasons=None):
    """A missing/blocked page must never prevent a transcript from being archived.

    Every lookup that finds no start says why, and `reasons` (a Counter) tallies them, so a
    blocked page shows up in the log instead of passing quietly."""
    if not re.fullmatch(r"[\w-]{11}", video):
        return False
    file = Path(root) / RELATIVE_PATH
    rows = json.loads(file.read_text()) if file.exists() else {}
    if video in rows:
        return False
    row, reason = lookup(video, teaching_date)
    if row is None:
        print(f"{video}: broadcast start not recorded: {reason}", flush=True)
        if reasons is not None:
            reasons[reason] += 1
        return False
    rows[video] = row
    file.parent.mkdir(parents=True, exist_ok=True)
    temporary = file.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(dict(sorted(rows.items())), indent=2) + "\n")
    temporary.replace(file)
    return True



def backfill(root, tdir, since, tries=20, reasons=None):
    """Record the broadcast start of dated class transcripts that have none yet.

    A transcript archived undated gets its date later, by hand, so the harvest's own
    record_broadcast call skipped it, and the class lists fell back to title order within
    its day. Only transcripts dated on or after `since` are tried, at most `tries` pages a
    run: an upload that was never live has no start and is never recorded."""
    file = Path(root) / RELATIVE_PATH
    rows = json.loads(file.read_text()) if file.exists() else {}
    dated = []
    for path in Path(tdir).glob("*.json"):
        if path.stem in rows:
            continue
        try:
            day = json.loads(path.read_text()).get("date")
        except (OSError, ValueError):
            continue
        if isinstance(day, str) and day >= since:
            dated.append((day, path.stem))
    # The newest half of the tries go to the newest classes; the rest to a random draw of the
    # older ones, so uploads that never went live cannot starve older classes of a try.
    dated.sort(reverse=True)
    newest = tries // 2
    picked = dated[:newest] + random.sample(dated[newest:], min(tries - newest, len(dated[newest:])))
    recorded = []
    reasons = Counter() if reasons is None else reasons
    for day, video in picked:
        if record_broadcast(root, video, day, reasons):
            recorded.append(video)
    if reasons:
        print(f"broadcast starts: {len(recorded)} of {len(picked)} backfilled; not recorded this run:", flush=True)
        for reason, count in reasons.most_common():
            print(f"  {count:5d}  {reason}", flush=True)
    return recorded


def main(argv=None):
    ap = argparse.ArgumentParser(description="Record the broadcast start of dated classes that have none yet.")
    ap.add_argument("--since", default="2000-01-01", help="only classes dated on or after this day")
    ap.add_argument("--tries", type=int, default=200, help="pages to look up this run")
    ap.add_argument("--transcripts", default=str(ROOT / "blog" / "transcripts"))
    ap.add_argument("--fail-if-none", action="store_true",
                    help="exit 1 when classes were tried and none was recorded, so a blocked run shows red")
    a = ap.parse_args(argv)
    reasons = Counter()
    recorded = backfill(ROOT, a.transcripts, a.since, a.tries, reasons)
    print(f"recorded {len(recorded)} broadcast starts", flush=True)
    return 1 if a.fail_if_none and reasons and not recorded else 0


if __name__ == "__main__":
    sys.exit(main())
