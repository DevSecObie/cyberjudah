#!/usr/bin/env python3
"""Download missing YouTube audio in CI and transcribe it with faster-whisper.

This is the fallback for videos that have no caption track or cannot be returned by
TranscriptAPI. Audio and intermediary files live only in HARVEST_RAW_DIR and are
deleted after each video is ingested.
"""

import argparse
import base64
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.request
from types import SimpleNamespace


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


def transcribe_workers_ai(wav_path, account, token, model="@cf/openai/whisper-large-v3-turbo", chunk_seconds=600):
    """Transcribe with Workers AI's Whisper on Cloudflare's GPUs instead of the runner's CPU:
    the audio is cut into ten-minute MP3 pieces with ffmpeg, each sent as base64, and the
    pieces' segments are offset back onto the recording's clock."""
    work = wav_path + ".pieces"
    os.makedirs(work, exist_ok=True)
    run(["ffmpeg", "-loglevel", "error", "-y", "-i", wav_path, "-ac", "1", "-ar", "16000", "-b:a", "48k", "-f", "segment", "-segment_time", str(chunk_seconds), os.path.join(work, "%04d.mp3")])
    segments = []
    for index, piece in enumerate(sorted(glob.glob(os.path.join(work, "*.mp3")))):
        with open(piece, "rb") as handle:
            audio = base64.b64encode(handle.read()).decode("ascii")
        body = json.dumps({"audio": audio, "task": "transcribe", "language": "en"}).encode("utf-8")
        request = urllib.request.Request(
            f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{model}",
            data=body, method="POST",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        result = None
        for attempt in range(3):
            try:
                with urllib.request.urlopen(request, timeout=600) as response:
                    result = json.load(response).get("result") or {}
                break
            except Exception as error:  # noqa: BLE001 - retried, then reported by the caller
                if attempt == 2:
                    raise RuntimeError(f"Workers AI whisper failed on piece {index}: {error}") from error
        offset = index * chunk_seconds
        for seg in result.get("segments") or []:
            text = (seg.get("text") or "").strip()
            if text:
                segments.append(SimpleNamespace(start=offset + float(seg.get("start", 0)), end=offset + float(seg.get("end", 0)), text=text))
        if not result.get("segments") and result.get("text"):
            segments.append(SimpleNamespace(start=offset, end=offset + chunk_seconds, text=result["text"].strip()))
    shutil.rmtree(work, ignore_errors=True)
    return segments


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--feed", default="classes", choices=sorted(FEEDS))
    parser.add_argument("--channel", required=True)
    parser.add_argument("--cookies", required=True)
    parser.add_argument("--limit", type=int, default=2)
    parser.add_argument("--model", default="small.en")
    parser.add_argument("--tabs", default="videos,streams")
    parser.add_argument("--engine", default=os.environ.get("TRANSCRIBE_ENGINE", "faster-whisper"), choices=["faster-whisper", "workers-ai"],
                        help="workers-ai sends the audio to Cloudflare's Whisper (needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN)")
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

    raw_dir = os.environ.get("HARVEST_RAW_DIR", "/tmp/youtube-audio-fallback")
    os.makedirs(raw_dir, exist_ok=True)
    cf_account, cf_token = os.environ.get("CLOUDFLARE_ACCOUNT_ID"), os.environ.get("CLOUDFLARE_API_TOKEN")
    if args.engine == "workers-ai" and not (cf_account and cf_token):
        sys.exit("workers-ai needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN")
    model = None
    if args.engine == "faster-whisper":
        from faster_whisper import WhisperModel
        model = WhisperModel(args.model, device="cpu", compute_type="int8", cpu_threads=max(1, os.cpu_count() or 2))
    method = f"faster-whisper:{args.model}" if model else "workers-ai:whisper-large-v3-turbo"
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
        if model:
            segments, _ = model.transcribe(
                audio_files[0],
                language="en",
                beam_size=1,
                best_of=1,
                vad_filter=True,
                condition_on_previous_text=True,
            )
        else:
            try:
                segments = transcribe_workers_ai(audio_files[0], cf_account, cf_token)
            except RuntimeError as error:
                failed += 1
                print(f"{video_id}: {error}")
                for path in glob.glob(prefix + ".*"):
                    os.remove(path)
                continue
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
            f"--transcription-method={method}",
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
