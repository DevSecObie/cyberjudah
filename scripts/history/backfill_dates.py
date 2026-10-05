#!/usr/bin/env python3
"""Backfill the `date` field of transcripts the harvester filed with none.

    python3 scripts/history/backfill_dates.py --feed classes [--limit 200] [--dry-run]

Before harvest.py's TranscriptAPI listing/date fix, every classes/captains/history
transcript ingested through --backend transcriptapi got `"date": null`, because the
channel listing it read the date from never carries one (see harvest.py's
video_publish_date). This walks the existing backlog and asks each undated video for
its own publish date the same way the fixed harvester now does going forward.

Never invents a date: a video whose publish date can't be read from
/youtube/video/metadata is left exactly as it was, and recorded in
<feed>/no-publish-date.tsv so it can be listed rather than silently skipped.
"""
import argparse
import glob
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ingest import FEEDS, episode_slug
from harvest import append_once, video_publish_date

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--feed", required=True, choices=sorted(FEEDS))
    ap.add_argument("--limit", type=int, default=100000)
    ap.add_argument("--dry-run", action="store_true", help="look up dates but write nothing")
    ap.add_argument("--sleep", type=float, default=0.2, help="pause between videos")
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

    dated = still_undated = 0
    for p, rec in todo:
        date = video_publish_date(rec["videoId"])
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
        time.sleep(a.sleep)

    left = len(undated) - len(todo)
    print(
        f"done: {dated} dated, {still_undated} still undated, {left} not attempted this run",
        flush=True,
    )


if __name__ == "__main__":
    main()
