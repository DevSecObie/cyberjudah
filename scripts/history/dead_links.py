#!/usr/bin/env python3
"""List class videos YouTube no longer serves (deleted, private or blocked).

    YOUTUBE_API_KEY=... python3 scripts/history/dead_links.py

Every transcript's video is checked with the YouTube Data API (videos.list, part=status,
50 videos a request, about 340 units of the free daily quota for the whole library). A
video the API doesn't return, or reports as private or failed upload, goes into
data/sources/unavailable-videos.json with the day it was first seen missing. A video that
comes back is taken off the list. Nothing is hidden: the list is for a person to review.
"""
import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RELATIVE_PATH = "data/sources/unavailable-videos.json"
FEEDS = {"classes": "blog", "captains": "captains", "history": "history"}


def library(root):
    """{video: {feed, title}} for every transcript."""
    videos = {}
    for feed, folder in FEEDS.items():
        for path in sorted((Path(root) / folder / "transcripts").glob("*.json")):
            try:
                record = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            video = str(record.get("videoId") or path.stem)
            videos.setdefault(video, {"feed": feed, "title": record.get("cleanTitle") or record.get("title") or ""})
    return videos


def statuses(video_ids, key, fetch=None):
    """{video: reason it can't be watched} for the videos YouTube doesn't serve."""
    def get(url):
        with urllib.request.urlopen(url, timeout=30) as response:
            return json.load(response)
    fetch = fetch or get
    missing = {}
    for start in range(0, len(video_ids), 50):
        chunk = video_ids[start:start + 50]
        data = fetch("https://www.googleapis.com/youtube/v3/videos?" + urllib.parse.urlencode({
            "part": "status", "id": ",".join(chunk), "key": key,
            "fields": "items(id,status(uploadStatus,privacyStatus))"}))
        returned = {}
        for item in data.get("items", []):
            returned[item["id"]] = item.get("status") or {}
        for video in chunk:
            status = returned.get(video)
            if status is None:
                missing[video] = "deleted or private"
            elif status.get("privacyStatus") == "private":
                missing[video] = "private"
            elif status.get("uploadStatus") in ("failed", "rejected", "deleted"):
                missing[video] = f"upload {status['uploadStatus']}"
    return missing


def update(root, videos, missing, today=None):
    """Write the list; return (added, removed)."""
    today = today or date.today().isoformat()
    file = Path(root) / RELATIVE_PATH
    old = json.loads(file.read_text()) if file.exists() else {}
    new = {}
    for video, reason in missing.items():
        info = videos.get(video, {})
        new[video] = {"feed": info.get("feed", ""), "title": info.get("title", ""), "reason": reason,
                      "since": old.get(video, {}).get("since", today)}
    added = sorted(set(new) - set(old))
    removed = sorted(set(old) - set(new))
    file.parent.mkdir(parents=True, exist_ok=True)
    temporary = file.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(dict(sorted(new.items())), indent=2, ensure_ascii=False) + "\n")
    temporary.replace(file)
    return added, removed


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.parse_args(argv)
    key = os.environ.get("YOUTUBE_API_KEY")
    if not key:
        print("YOUTUBE_API_KEY is not set", file=sys.stderr)
        return 1
    videos = library(ROOT)
    missing = statuses(sorted(videos), key)
    added, removed = update(ROOT, videos, missing)
    print(f"checked {len(videos)} videos: {len(missing)} unavailable ({len(added)} new, {len(removed)} back)")
    for video in added:
        print(f"  new: {video}  {missing[video]}  {videos[video]['title'][:80]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
