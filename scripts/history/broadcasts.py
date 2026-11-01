"""Preserve actual YouTube broadcast starts, independently of upload timestamps."""
import json
import re
import subprocess
from datetime import date, datetime, timezone
from pathlib import Path

RELATIVE_PATH = "data/sources/class-broadcasts.json"


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


def record_broadcast(root, video, teaching_date):
    """A missing/blocked page must never prevent a transcript from being archived."""
    if not re.fullmatch(r"[\w-]{11}", video):
        return False
    file = Path(root) / RELATIVE_PATH
    rows = json.loads(file.read_text()) if file.exists() else {}
    if video in rows:
        return False
    try:
        response = subprocess.run([
            "curl", "--fail", "--silent", "--show-error", "--location", "--max-time", "15",
            f"https://www.youtube.com/watch?v={video}",
        ], capture_output=True, text=True, timeout=20)
        row = parse_broadcast(response.stdout, video, teaching_date) if response.returncode == 0 else None
    except (OSError, ValueError, subprocess.TimeoutExpired):
        row = None
    if row is None:
        print(f"{video}: broadcast start unconfirmed; keeping existing order", flush=True)
        return False
    rows[video] = row
    file.parent.mkdir(parents=True, exist_ok=True)
    temporary = file.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(dict(sorted(rows.items())), indent=2) + "\n")
    temporary.replace(file)
    return True



def backfill(root, tdir, since, tries=20):
    """Record the broadcast start of dated class transcripts that have none yet.

    A transcript archived undated gets its date later, by hand, so the harvest's own
    record_broadcast call skipped it, and the class lists fell back to title order within
    its day. Only transcripts dated on or after `since` are tried, newest first, and at most
    `tries` pages a run: an upload that was never live has no start and is never recorded."""
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
    recorded = []
    for day, video in sorted(dated, reverse=True)[:tries]:
        if record_broadcast(root, video, day):
            recorded.append(video)
    return recorded
