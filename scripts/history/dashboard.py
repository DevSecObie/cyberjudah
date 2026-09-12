#!/usr/bin/env python3
"""Generate a live transcript backlog dashboard from transcriptAPI + repo state."""

import argparse
import json
import os
import re
import glob
from datetime import datetime, timezone
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

BASE_URL = "https://transcriptapi.com/api/v2"
API_KEY_ENV = ("TRANSCRIPTAPI_KEY", "TRANSCRIPT_API_KEY", "TRANSCRIPTAPI_API_KEY")


FEED_CONFIG = (
    ("captains", "iuiccaptains6939"),
    ("history", "ourhiddenhistoryradio1991"),
    ("classes", "IUICintheClassRoom"),
    ("classes", "iuicintheclassroom2"),
)


def api_key():
    for env in API_KEY_ENV:
        key = os.environ.get(env)
        if key:
            return key.strip()
    return None


def api_get(path, params, *, timeout=60):
    key = api_key()
    if not key:
        raise RuntimeError("missing_api_key")

    req = Request(
        f"{BASE_URL}{path}?{urlencode(params)}",
        headers={
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://transcriptapi.com/",
            "Origin": "https://transcriptapi.com",
        },
    )
    with urlopen(req, timeout=timeout) as r:
        return r.getcode(), json.load(r), dict(r.headers)


def listing_api(channel):
    rows = []
    continuation = None
    while True:
        params = {"continuation": continuation} if continuation else {"channel": channel}
        code, payload, _ = api_get("/youtube/channel/videos", params)
        if code != 200:
            raise RuntimeError(f"{channel}: listing failed {code} {payload.get('detail')}")

        c = payload.get("content", payload)
        if not isinstance(c, dict):
            break
        for item in c.get("results", []) or c.get("videos", []):
            vid = item.get("videoId") or item.get("video_id")
            if vid:
                rows.append(vid)
        if not c.get("has_more") or not c.get("continuation_token"):
            break
        continuation = c.get("continuation_token")

    return rows


def read_set(path):
    if not os.path.exists(path):
        return set()
    s = set()
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            vid = line.strip().split("\t", 1)[0]
            if vid and re.fullmatch(r"[\w-]{11}", vid):
                s.add(vid)
    return s


def build_entry(feed, channel):
    tdir = os.path.join(feed, "transcripts")
    done = set(glob.glob(os.path.join(tdir, "*.json")))
    done_ids = {os.path.basename(p)[:-5] for p in done}

    no_captions_ids = read_set(os.path.join(feed, "no-captions.tsv"))
    age_restricted_ids = read_set(os.path.join(feed, "age-restricted.tsv"))
    done_ids |= no_captions_ids
    done_ids |= age_restricted_ids

    videos = listing_api(channel)
    to_fetch = [vid for vid in videos if vid not in done_ids]
    in_vault = len(videos) - len(to_fetch)
    progress = (in_vault / len(videos) * 100.0) if videos else 100.0

    return {
        "channel": channel,
        "feed": feed,
        "videos": len(videos),
        "already_in_vault": in_vault,
        "to_fetch": len(to_fetch),
        "completed": len(videos) - len(to_fetch),
        "no_backlog": len(to_fetch) == 0,
        "no_captions": len(done_ids.intersection(no_captions_ids)),
        "age_restricted": len(done_ids.intersection(age_restricted_ids)),
        "progress_pct": round(progress, 2),
    }


def write_markdown(path, rows, now):
    lines = [
        "# Transcript Backlog Dashboard",
        "",
        f"Last checked: {now.isoformat()}",
        "",
        "| Feed | Channel | Videos | In Vault | To Fetch | Progress | No Caption/Age-Restricted |",
        "|---|---|---:|---:|---:|---:|---:|",
    ]
    for row in rows:
        blocked = row["no_captions"] + row["age_restricted"]
        progress = row["progress_pct"]
        lines.append(
            f"| {row['feed']} | {row['channel']} | {row['videos']} | "
            f"{row['already_in_vault']} | {row['to_fetch']} | {progress:.1f}% | {blocked} |"
        )
    lines.append("")
    lines.append("Dashboard is updated by the hourly transcript workflow.")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", required=True)
    ap.add_argument("--markdown", default=None)
    args = ap.parse_args()

    now = datetime.now(timezone.utc)
    rows = []
    errors = []

    for feed, channel in FEED_CONFIG:
        try:
            rows.append(build_entry(feed, channel))
        except Exception as e:
            errors.append({"feed": feed, "channel": channel, "error": str(e)})

    payload = {
        "generated_at": now.isoformat(),
        "feeds": rows,
        "errors": errors,
    }
    os.makedirs(os.path.dirname(args.json), exist_ok=True)
    with open(args.json, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, sort_keys=True)

    if args.markdown:
        write_markdown(args.markdown, rows, now)

    for row in rows:
        status = "OK" if row["to_fetch"] == 0 else "BACKLOG"
        print(f"[{row['feed']}:{row['channel']}] {row['videos']} videos | in vault={row['already_in_vault']} | to fetch={row['to_fetch']} | {status}")

    if errors:
        for item in errors:
            print(f"ERROR {item['feed']}:{item['channel']} {item['error']}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
