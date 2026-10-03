#!/usr/bin/env python3
"""The Sabbath classes that have finished streaming and have no transcript yet.

    python3 scripts/history/live_watch.py --channel IUICintheClassRoom [--cookies FILE] [--since-hours 36]

Prints one video id per line, oldest first. A class is picked up once YouTube reports it
`was_live` (the stream has ended and the recording is complete); one still live, upcoming or
`post_live` (ended, recording still processing) is left for the next run of the watch. This
does not wait for captions: YouTube puts them up hours after a stream ends, and the watch
transcribes the audio itself with WhisperX (audio_fallback.py --engine whisperx).

With --github-output the ids are also written to $GITHUB_OUTPUT, as `videos=<id,id>` and as a
JSON list in `matrix=` for a job matrix.
"""

import argparse
import glob
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from audio_fallback import ROOT, ytdlp
from ingest import FEEDS

MIN_SECONDS = 600  # anything shorter is a clip or an announcement, not a class


def recent_streams(channel, cookies, depth):
    """The newest `depth` ids on the channel's streams tab, newest first."""
    args = ["--flat-playlist", "--ignore-errors", "--playlist-end", str(depth), "--print", "%(id)s"]
    if cookies:
        args = ["--cookies", cookies] + args
    result = ytdlp(args + [f"https://www.youtube.com/@{channel}/streams"])
    return [line.strip() for line in result.stdout.splitlines() if re.fullmatch(r"[\w-]{11}", line.strip())]


def info(video_id, cookies):
    args = ["--dump-json", "--skip-download", "--no-warnings", "--extractor-args", "youtube:player_client=mweb"]
    if cookies:
        args = ["--cookies", cookies] + args
    result = ytdlp(args + [f"https://www.youtube.com/watch?v={video_id}"])
    if result.returncode != 0 or not result.stdout.strip():
        print(f"{video_id}: no metadata: {result.stderr.strip()[-300:]}", file=sys.stderr)
        return None
    return json.loads(result.stdout.splitlines()[0])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--channel", default="IUICintheClassRoom")
    ap.add_argument("--feed", default="classes", choices=sorted(FEEDS))
    ap.add_argument("--cookies", default=None)
    ap.add_argument("--since-hours", type=float, default=36, help="Only streams that started within this many hours")
    ap.add_argument("--depth", type=int, default=12, help="How many of the newest streams to look at")
    ap.add_argument("--github-output", action="store_true")
    a = ap.parse_args()

    done = {os.path.basename(p)[:-5] for p in glob.glob(os.path.join(ROOT, FEEDS[a.feed], "transcripts", "*.json"))}
    cutoff = time.time() - a.since_hours * 3600
    ready = []
    for video_id in recent_streams(a.channel, a.cookies, a.depth):
        if video_id in done:
            continue
        meta = info(video_id, a.cookies)
        if not meta:
            continue
        status = meta.get("live_status")
        started = meta.get("release_timestamp") or meta.get("timestamp")
        title = meta.get("title", "")
        if started and started < cutoff:
            continue
        if status != "was_live":
            print(f"{video_id}: {status or 'unknown'}, not finished yet: {title}", file=sys.stderr)
            continue
        if (meta.get("duration") or 0) < MIN_SECONDS:
            print(f"{video_id}: under ten minutes, skipped: {title}", file=sys.stderr)
            continue
        print(f"{video_id}: finished, {round((meta.get('duration') or 0) / 60)} min: {title}", file=sys.stderr)
        ready.append((started or 0, video_id))

    ids = [video_id for _, video_id in sorted(ready)]
    for video_id in ids:
        print(video_id)
    if a.github_output and os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as handle:
            handle.write(f"videos={','.join(ids)}\n")
            handle.write(f"matrix={json.dumps(ids)}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
