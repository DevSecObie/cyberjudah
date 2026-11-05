#!/usr/bin/env python3
"""Backfill the `date` field of transcripts the harvester filed with none.

    python3 scripts/history/backfill_dates.py --feed classes [--limit 200] [--dry-run] [--source youtube]

Before harvest.py's TranscriptAPI listing/date fix, every classes/captains/history
transcript ingested through --backend transcriptapi got `"date": null`, because the
channel listing it read the date from never carries one (see harvest.py's
video_publish_date). This walks the existing backlog and asks each undated video for
its own publish date the same way the fixed harvester now does going forward.

--source youtube reads the same publish date from the official YouTube Data API
(videos.list, 50 videos a request, YOUTUBE_API_KEY), which costs no TranscriptAPI credits.
Its UTC timestamp is given as the date in YouTube's own time zone (Pacific), the date
/youtube/video/metadata's publishDate carries, so both sources agree.

Never invents a date: a video whose publish date can't be read is left exactly as it
was, and recorded in <feed>/no-publish-date.tsv so it can be listed rather than
silently skipped.
"""
import argparse
import glob
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ingest import FEEDS, episode_slug
from harvest import append_once, video_publish_date

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PACIFIC = ZoneInfo("America/Los_Angeles")


def pacific_date(published_at):
    """YYYY-MM-DD of a YouTube API timestamp (2020-05-25T12:00:11Z) in YouTube's time zone."""
    try:
        return datetime.fromisoformat(published_at.replace("Z", "+00:00")).astimezone(PACIFIC).strftime("%Y-%m-%d")
    except (AttributeError, ValueError):
        return None


def youtube_api_dates(video_ids, key, fetch=None):
    """{video: date} from the YouTube Data API, 50 videos a request; a video it doesn't return is left out."""
    def get(url):
        with urllib.request.urlopen(url, timeout=30) as r:
            return json.load(r)
    fetch = fetch or get
    out = {}
    for i in range(0, len(video_ids), 50):
        ids = ",".join(video_ids[i:i + 50])
        data = fetch("https://www.googleapis.com/youtube/v3/videos?" + urllib.parse.urlencode({"part": "snippet", "id": ids, "key": key, "fields": "items(id,snippet/publishedAt)"}))
        for item in data.get("items", []):
            d = pacific_date(item.get("snippet", {}).get("publishedAt"))
            if d:
                out[item["id"]] = d
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--feed", required=True, choices=sorted(FEEDS))
    ap.add_argument("--limit", type=int, default=100000)
    ap.add_argument("--dry-run", action="store_true", help="look up dates but write nothing")
    ap.add_argument("--sleep", type=float, default=0.2, help="pause between videos")
    ap.add_argument("--source", choices=("transcriptapi", "youtube"), default="transcriptapi", help="where the publish date is read")
    a = ap.parse_args()

    fdir = os.path.join(ROOT, FEEDS[a.feed])
    tdir = os.path.join(fdir, "transcripts")
    no_date = os.path.join(fdir, "no-publish-date.tsv")

    undated = []
    for p in sorted(glob.glob(os.path.join(tdir, "*.json"))):
        with open(p, encoding="utf-8") as fh:
            rec = json.load(fh)
        if not rec.get("date"):
            undated.append((p, rec))

    todo = undated[: a.limit]
    print(f"{a.feed}: {len(undated)} transcripts with no date, checking {len(todo)}", flush=True)

    found = None
    if a.source == "youtube":
        key = os.environ.get("YOUTUBE_API_KEY", "")
        if not key:
            sys.exit("Set YOUTUBE_API_KEY to read dates from the YouTube Data API.")
        found = youtube_api_dates([rec["videoId"] for _, rec in todo], key)

    dated = still_undated = 0
    for p, rec in todo:
        date = found.get(rec["videoId"]) if found is not None else video_publish_date(rec["videoId"])
        if date:
            dated += 1
            rec["date"] = date
            rec["slug"] = episode_slug(rec["title"], rec.get("episode"), date)
            if not a.dry_run:
                with open(p, "w", encoding="utf-8") as fh:
                    json.dump(rec, fh, ensure_ascii=False, separators=(",", ":"))
            print(f"{rec['videoId']}: dated {date} ({rec['title'][:60]})", flush=True)
        else:
            still_undated += 1
            if not a.dry_run:
                append_once(no_date, rec["videoId"], rec["title"])
            print(f"{rec['videoId']}: still undated ({rec['title'][:60]})", flush=True)
        if found is None:
            time.sleep(a.sleep)

    left = len(undated) - len(todo)
    print(
        f"done: {dated} dated, {still_undated} still undated, {left} not attempted this run",
        flush=True,
    )


if __name__ == "__main__":
    main()
