#!/usr/bin/env python3
"""Which classes are scheduled or live right now on the main class channels.

    YOUTUBE_API_KEY=... python3 scripts/history/upcoming.py

Reads each channel's newest uploads (playlistItems.list, 1 quota unit a channel), then their
live details in one videos.list call (1 unit), and writes data/sources/live-classes.json:
{video: {channel, title, status: "upcoming" | "live", scheduledStart, actualStart}}. A class
that has ended, or never was live, is not listed. The file only changes when the list does.
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RELATIVE_PATH = "data/sources/live-classes.json"
CHANNELS_PATH = "data/sources/iuic-channels.tsv"
# The channels the hourly and weekly harvests follow for new classes.
HANDLES = ("IUICintheClassRoom", "iuicintheclassroom2", "IUICRaleigh", "IUIC.ATLANTA.CLASSROOM")
API = "https://www.googleapis.com/youtube/v3/"


def channel_ids(root, handles=HANDLES):
    """{handle: channel id} from iuic-channels.tsv."""
    ids = {}
    for line in (Path(root) / CHANNELS_PATH).read_text(encoding="utf-8").splitlines():
        cells = line.split("\t")
        if len(cells) > 2 and cells[1] in handles and cells[2].startswith("UC"):
            ids.setdefault(cells[1], cells[2])
    return ids


def get(url):
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.load(response)


def live_classes(channels, key, fetch=get, per_channel=10):
    """{video: row} for videos scheduled or live now on `channels` ({handle: channel id})."""
    titles, owner = {}, {}
    for handle, channel in channels.items():
        data = fetch(API + "playlistItems?" + urllib.parse.urlencode({
            "part": "snippet", "playlistId": "UU" + channel[2:], "maxResults": per_channel, "key": key,
            "fields": "items(snippet(title,resourceId/videoId))"}))
        for item in data.get("items", []):
            snippet = item.get("snippet") or {}
            video = (snippet.get("resourceId") or {}).get("videoId")
            if video:
                titles[video], owner[video] = snippet.get("title", ""), handle
    rows = {}
    ids = sorted(titles)
    for start in range(0, len(ids), 50):
        data = fetch(API + "videos?" + urllib.parse.urlencode({
            "part": "snippet,liveStreamingDetails", "id": ",".join(ids[start:start + 50]), "key": key,
            "fields": "items(id,snippet/liveBroadcastContent,liveStreamingDetails(scheduledStartTime,actualStartTime,actualEndTime))"}))
        for item in data.get("items", []):
            status = (item.get("snippet") or {}).get("liveBroadcastContent")
            details = item.get("liveStreamingDetails") or {}
            if status not in ("upcoming", "live") or details.get("actualEndTime"):
                continue
            rows[item["id"]] = {"channel": owner[item["id"]], "title": titles[item["id"]], "status": status,
                                "scheduledStart": details.get("scheduledStartTime", ""),
                                "actualStart": details.get("actualStartTime", "")}
    return dict(sorted(rows.items()))


def write(root, rows):
    """Write the list when it changed; return True when it did."""
    file = Path(root) / RELATIVE_PATH
    text = json.dumps(rows, indent=2, ensure_ascii=False) + "\n"
    if file.exists() and file.read_text(encoding="utf-8") == text:
        return False
    file.parent.mkdir(parents=True, exist_ok=True)
    temporary = file.with_suffix(".json.tmp")
    temporary.write_text(text, encoding="utf-8")
    temporary.replace(file)
    return True


def main():
    key = os.environ.get("YOUTUBE_API_KEY")
    if not key:
        print("YOUTUBE_API_KEY is not set", file=sys.stderr)
        return 1
    rows = live_classes(channel_ids(ROOT), key)
    changed = write(ROOT, rows)
    print(f"{len(rows)} classes scheduled or live" + (" (changed)" if changed else ""))
    for video, row in rows.items():
        print(f"  {row['status']:8} {video}  {row['channel']}  {row['title'][:70]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
