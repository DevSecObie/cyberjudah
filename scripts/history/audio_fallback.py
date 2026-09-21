#!/usr/bin/env python3
"""Download missing YouTube audio in CI and transcribe it with faster-whisper.

This is the fallback for videos that have no caption track or cannot be returned by
TranscriptAPI. Audio and intermediary files live only in HARVEST_RAW_DIR and are
deleted after each video is ingested.
"""

import argparse
import glob
import json
import os
import re
import shutil
import subprocess
import sys


ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ingest import FEEDS


def run(cmd):
    return subprocess.run(cmd, text=True, capture_output=True)


def ytdlp(args):
    base = ["yt-dlp"] if shutil.which("yt-dlp") else [sys.executable, "-m", "yt_dlp"]
    return run(base + args)


def list_channel(channel, tabs, cookies):
    seen = set()
    rows = []
    for tab in tabs:
        result = ytdlp([
            "--cookies", cookies,
            "--flat-playlist",
            "--ignore-errors",
            "--print", "%(id)s\t%(duration)s\t%(title)s",
            f"https://www.youtube.com/@{channel}/{tab}",
        ])
        for line in result.stdout.splitlines():
            parts = line.split("\t", 2)
            if len(parts) == 3 and re.fullmatch(r"[\w-]{11}", parts[0]) and parts[0] not in seen:
                seen.add(parts[0])
                rows.append(tuple(parts))
    return rows


def metadata(path, fallback_title, duration_hint):
    if not os.path.exists(path):
        return fallback_title, None, None, None
    with open(path, encoding="utf-8") as handle:
        info = json.load(handle)
    upload_date = info.get("upload_date")
    date = None
    if upload_date and re.fullmatch(r"\d{8}", upload_date):
        date = f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:]}"
    duration = info.get("duration")
    if duration is None and duration_hint not in ("", "NA", "None"):
        try:
            duration = float(duration_hint)
        except ValueError:
            pass
    return info.get("title") or fallback_title, date, duration, info.get("view_count")


def write_transcript(path, segments):
    payload = {
        "transcript": [
            {
                "start": round(segment.start, 2),
                "duration": round(segment.end - segment.start, 2),
                "text": segment.text.strip(),
            }
            for segment in segments
            if segment.text.strip()
        ]
    }
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--feed", default="classes", choices=sorted(FEEDS))
    parser.add_argument("--channel", required=True)
    parser.add_argument("--cookies", required=True)
    parser.add_argument("--limit", type=int, default=2)
    parser.add_argument("--model", default="small.en")
    parser.add_argument("--tabs", default="videos,streams")
    args = parser.parse_args()

    feed_dir = os.path.join(ROOT, FEEDS[args.feed])
    transcript_dir = os.path.join(feed_dir, "transcripts")
    meta_path = os.path.join(feed_dir, "channel-meta.tsv")
    os.makedirs(transcript_dir, exist_ok=True)

    rows = list_channel(args.channel, [x.strip() for x in args.tabs.split(",") if x.strip()], args.cookies)
    done = {os.path.basename(path)[:-5] for path in glob.glob(os.path.join(transcript_dir, "*.json"))}
    todo = [row for row in rows if row[0] not in done][: args.limit]
    print(f"audio fallback {args.channel}: {len(rows)} listed, {len(done.intersection({r[0] for r in rows}))} transcripts, {len(todo)} selected")
    if not todo:
        return 0

    from faster_whisper import WhisperModel

    raw_dir = os.environ.get("HARVEST_RAW_DIR", "/tmp/youtube-audio-fallback")
    os.makedirs(raw_dir, exist_ok=True)
    model = WhisperModel(args.model, device="cpu", compute_type="int8", cpu_threads=max(1, os.cpu_count() or 2))
    archived = failed = 0

    for video_id, duration_hint, fallback_title in todo:
        prefix = os.path.join(raw_dir, video_id)
        result = ytdlp([
            "--cookies", args.cookies,
            "--js-runtimes", "node",
            "--extractor-args", "youtube:player_client=mweb",
            "--sleep-requests", "5",
            "--retries", "10",
            "--fragment-retries", "10",
            "--write-info-json",
            "--extract-audio",
            "--audio-format", "wav",
            "--audio-quality", "0",
            "--format", "bestaudio/best",
            "--output", prefix + ".%(ext)s",
            f"https://www.youtube.com/watch?v={video_id}",
        ])
        audio_files = glob.glob(prefix + ".wav")
        info_path = prefix + ".info.json"
        if result.returncode != 0 or not audio_files:
            failed += 1
            print(f"{video_id}: audio download failed: {result.stderr.strip()[-500:]}")
            for path in glob.glob(prefix + ".*"):
                os.remove(path)
            continue

        title, date, duration, views = metadata(info_path, fallback_title, duration_hint)
        segments, _ = model.transcribe(
            audio_files[0],
            language="en",
            beam_size=1,
            best_of=1,
            vad_filter=True,
            condition_on_previous_text=True,
        )
        transcript_path = prefix + ".transcript.json"
        write_transcript(transcript_path, segments)
        command = [
            sys.executable,
            os.path.join(ROOT, "scripts", "history", "ingest.py"),
            transcript_path,
            f"--id={video_id}",
            f"--title={title}",
            f"--feed={args.feed}",
            f"--source-channel={args.channel}",
            f"--transcription-method=faster-whisper:{args.model}",
        ]
        if date:
            command.append(f"--date={date}")
        if duration is not None:
            command.append(f"--duration={duration}")
        if views is not None:
            command.append(f"--views={views}")
        ingest = run(command)
        if ingest.returncode == 0:
            archived += 1
            with open(meta_path, "a", encoding="utf-8") as handle:
                handle.write(f"{video_id}\t{date or ''}\t{duration or ''}\t{title}\t{views or ''}\n")
            print(ingest.stdout.strip())
        else:
            failed += 1
            print(f"{video_id}: ingest failed: {ingest.stderr.strip()[-500:]}")
        for path in glob.glob(prefix + ".*"):
            os.remove(path)

    print(f"audio fallback done: {archived} archived, {failed} failed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
