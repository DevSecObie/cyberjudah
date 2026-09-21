#!/usr/bin/env python3
"""Build a reproducible analysis corpus from CyberJudah transcript records.

The transcript JSON files remain the evidence layer.  This script joins their metadata,
groups tiny caption cues into useful passages, produces original and normalized text,
extracts scripture references, and writes deterministic JSONL/GZIP outputs.
"""

import argparse
import csv
import gzip
import hashlib
import io
import json
import os
import re
import shutil
import sys
import unicodedata
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CORPUS_VERSION = "cj-corpus-v1"
SCHEMA_VERSION = 1
FEEDS = {
    "classes": ROOT / "blog",
    "captains": ROOT / "captains",
    "history": ROOT / "history",
}
SPACE = re.compile(r"\s+")
TAG = re.compile(r"\[\s*(music|applause|laughter|inaudible)\s*\]", re.I)
TOKEN = re.compile(r"\S+")


def json_line(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"


def iso_date(value):
    value = str(value or "").strip()
    if re.fullmatch(r"\d{8}", value):
        return f"{value[:4]}-{value[4:6]}-{value[6:]}"
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return value
    return None


def number(value, integer=False):
    try:
        parsed = float(value)
        return int(parsed) if integer else parsed
    except (TypeError, ValueError):
        return None


def metadata(feed_dir):
    """Read the headerless channel-meta.tsv, retaining the first useful value per id."""
    rows = {}
    path = feed_dir / "channel-meta.tsv"
    if not path.exists():
        return rows
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.reader(handle, delimiter="\t"):
            if len(row) < 4 or not row[0]:
                continue
            record = {
                "date": iso_date(row[1] if len(row) > 1 else None),
                "duration": number(row[2] if len(row) > 2 else None),
                "title": row[3].strip(),
                "views": number(row[4] if len(row) > 4 else None, integer=True),
            }
            if row[0] not in rows:
                rows[row[0]] = record
            else:
                for key, value in record.items():
                    if rows[row[0]].get(key) is None and value is not None:
                        rows[row[0]][key] = value
    return rows


def normalize_piece(text):
    """Light normalization only; do not repair grammar, spelling, or dialect."""
    text = unicodedata.normalize("NFC", str(text or ""))
    text = TAG.sub(lambda m: f"[{m.group(1).lower()}]", text)
    return SPACE.sub(" ", text).strip()


def overlap_words(left, right, minimum=4, maximum=30):
    """Exact, case-insensitive caption overlap; intentionally conservative."""
    a, b = left.split(), right.split()
    for size in range(min(maximum, len(a), len(b)), minimum - 1, -1):
        if [x.casefold() for x in a[-size:]] == [x.casefold() for x in b[:size]]:
            return size
    return 0


def normalized_with_offsets(cues):
    """Keep UTF-16 character offsets tied to original caption start seconds."""
    out, offsets = [], []
    previous = ""
    length = 0
    for seconds, raw in cues:
        text = normalize_piece(raw)
        if not text:
            continue
        overlap = overlap_words(previous, text) if previous else 0
        words = text.split()
        if overlap == len(words):
            continue
        text = " ".join(words[overlap:])
        if out:
            length += 1
        offsets.append([length, seconds])
        out.append(text)
        length += len(text.encode("utf-16-le")) // 2
        previous = (previous + " " + text).strip()
    return " ".join(out), offsets


def normalized_join(texts):
    return normalized_with_offsets((0, text) for text in texts)[0]


def make_chunks(segments, duration, target_words, max_words):
    """Group caption cues without splitting a cue or losing source boundaries."""
    chunks = []
    start = 0
    count = 0
    for index, segment in enumerate(segments):
        count += len(TOKEN.findall(str(segment[1])))
        next_gap = 0
        if index + 1 < len(segments):
            next_gap = max(0, float(segments[index + 1][0]) - float(segment[0]))
        if count >= max_words or (count >= target_words and next_gap >= 1.25):
            chunks.append((start, index + 1))
            start, count = index + 1, 0
    if start < len(segments):
        chunks.append((start, len(segments)))
    if len(chunks) > 1:
        a, b = chunks[-1]
        tail_words = sum(len(TOKEN.findall(str(x[1]))) for x in segments[a:b])
        if tail_words < max(40, target_words // 4):
            chunks[-2] = (chunks[-2][0], b)
            chunks.pop()
    return chunks


def scripture_extractor(enabled):
    if not enabled:
        return lambda _text: []
    sys.path.insert(0, str(ROOT / "scripts" / "notes"))
    import prep

    def extract(text):
        return [
            {
                "book": ref["book"],
                "chapter": ref["chapter"],
                "first_verse": ref["first"],
                "last_verse": ref["last"],
                "heard_as": ref["raw"],
            }
            for ref in prep.extract(text)
        ]

    return extract


def transcript_hash(record):
    payload = json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()


def open_deterministic_gzip(path):
    raw = path.open("wb")
    zipped = gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0)
    return io.TextIOWrapper(zipped, encoding="utf-8", newline="\n")


def build(args):
    out = Path(args.out).resolve()
    temporary = out.with_name(out.name + ".tmp")
    if temporary.exists():
        shutil.rmtree(temporary)
    temporary.mkdir(parents=True)

    extract_scriptures = scripture_extractor(not args.skip_scriptures)
    documents_path = temporary / "documents.jsonl"
    segments_path = temporary / "segments.jsonl.gz"
    quality_path = temporary / "quality.json"
    counters = Counter()
    issue_counts = Counter()
    issue_documents = []

    selected = args.feeds or list(FEEDS)
    remaining = args.limit
    with documents_path.open("w", encoding="utf-8", newline="\n") as documents, open_deterministic_gzip(segments_path) as segment_rows:
        for feed in selected:
            feed_dir = FEEDS[feed]
            meta = metadata(feed_dir)
            files = sorted((feed_dir / "transcripts").glob("*.json"))
            if remaining is not None:
                files = files[:remaining]
                remaining -= len(files)
            for path in files:
                with path.open(encoding="utf-8") as handle:
                    record = json.load(handle)
                video_id = record.get("videoId") or path.stem
                doc_id = f"youtube:{video_id}"
                auxiliary = meta.get(video_id, {})
                date = iso_date(record.get("date")) or auxiliary.get("date")
                date_source = "transcript" if iso_date(record.get("date")) else ("channel-meta" if date else None)
                title = record.get("title") or auxiliary.get("title") or video_id
                duration = number(record.get("duration"))
                if duration is None:
                    duration = auxiliary.get("duration")
                views = number(record.get("views"), integer=True)
                if views is None:
                    views = auxiliary.get("views")
                raw_segments = record.get("segments") or []
                valid_segments = []
                for source_index, item in enumerate(raw_segments):
                    if not isinstance(item, list) or len(item) < 2:
                        continue
                    try:
                        timestamp = float(item[0])
                    except (TypeError, ValueError):
                        continue
                    text = str(item[1] or "").strip()
                    if text:
                        valid_segments.append((timestamp, text, source_index))

                flags = []
                if not date:
                    flags.append("missing_date")
                if not valid_segments:
                    flags.append("empty_transcript")
                elif len(valid_segments) < 5:
                    flags.append("suspiciously_short")
                if any(valid_segments[i][0] > valid_segments[i + 1][0] for i in range(len(valid_segments) - 1)):
                    flags.append("non_monotonic_timestamps")
                for flag in flags:
                    issue_counts[flag] += 1
                if flags:
                    issue_documents.append({"doc_id": doc_id, "flags": flags, "title": title})

                doc = {
                    "schema_version": SCHEMA_VERSION,
                    "corpus_version": CORPUS_VERSION,
                    "doc_id": doc_id,
                    "video_id": video_id,
                    "feed": feed,
                    "file_name": str(path.relative_to(ROOT)),
                    "source_type": "lecture" if feed != "history" else "radio_program",
                    "source_platform": record.get("sourcePlatform", "youtube"),
                    "source_channel": record.get("sourceChannel"),
                    "source_url": f"https://www.youtube.com/watch?v={video_id}",
                    "title": title,
                    "clean_title": record.get("cleanTitle") or title,
                    "date": date,
                    "date_source": date_source,
                    "duration_seconds": duration,
                    "views": views,
                    "language": record.get("language", "en"),
                    "transcription_method": record.get("transcriptionMethod", "unknown"),
                    "transcription_style": "lightly_cleaned_verbatim",
                    "normalization_level": "light",
                    "has_timestamps": True,
                    "privacy_level": "internal",
                    "word_count": record.get("words") or sum(len(TOKEN.findall(x[1])) for x in valid_segments),
                    "caption_segment_count": len(valid_segments),
                    "content_sha256": transcript_hash(record),
                    "source_sha256": record.get("sourceSha256"),
                    "quality_flags": flags,
                }
                documents.write(json_line(doc))
                counters["documents"] += 1
                counters["caption_segments"] += len(valid_segments)
                counters["words"] += int(doc["word_count"] or 0)

                pairs = [(x[0], x[1]) for x in valid_segments]
                for segment_index, (first, stop) in enumerate(make_chunks(pairs, duration, args.target_words, args.max_words)):
                    source = valid_segments[first:stop]
                    original = " ".join(x[1] for x in source)
                    normalized, cue_offsets = normalized_with_offsets((x[0], x[1]) for x in source)
                    start_seconds = round(source[0][0], 2)
                    if stop < len(valid_segments):
                        end_seconds = round(valid_segments[stop][0], 2)
                    elif duration is not None:
                        end_seconds = round(float(duration), 2)
                    else:
                        end_seconds = round(source[-1][0], 2)
                    row = {
                        "schema_version": SCHEMA_VERSION,
                        "corpus_version": CORPUS_VERSION,
                        "segment_id": f"{doc_id}:{source[0][2]:06d}",
                        "doc_id": doc_id,
                        "segment_index": segment_index,
                        "source_segment_first": source[0][2],
                        "source_segment_last": source[-1][2],
                        "start_seconds": start_seconds,
                        "end_seconds": end_seconds,
                        "word_count": len(TOKEN.findall(normalized)),
                        "text_original": original,
                        "text_normalized": normalized,
                        "cue_offsets": cue_offsets,
                        "scripture_references": extract_scriptures(normalized),
                        "source_url": f"https://www.youtube.com/watch?v={video_id}&t={int(start_seconds)}s",
                    }
                    segment_rows.write(json_line(row))
                    counters["analysis_segments"] += 1
                    counters["scripture_references"] += len(row["scripture_references"])
            if remaining is not None and remaining <= 0:
                break

    quality = {
        "schema_version": SCHEMA_VERSION,
        "corpus_version": CORPUS_VERSION,
        "parameters": {
            "feeds": selected,
            "target_words": args.target_words,
            "max_words": args.max_words,
            "scripture_extraction": not args.skip_scriptures,
        },
        "counts": dict(sorted(counters.items())),
        "issue_counts": dict(sorted(issue_counts.items())),
        "issue_documents": issue_documents,
    }
    quality_path.write_text(json.dumps(quality, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    shutil.copyfile(Path(__file__).with_name("SCHEMA.md"), temporary / "README.md")
    if out.exists():
        shutil.rmtree(out)
    temporary.replace(out)
    print(f"corpus: {counters['documents']} documents -> {counters['analysis_segments']} analysis segments")
    print(f"words: {counters['words']} · scripture references: {counters['scripture_references']}")
    print(f"quality flags: {sum(issue_counts.values())} across {len(issue_documents)} documents")
    print(f"wrote {out}")


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default=str(ROOT / "dist" / "corpus"))
    parser.add_argument("--feeds", nargs="+", choices=sorted(FEEDS))
    parser.add_argument("--target-words", type=int, default=450)
    parser.add_argument("--max-words", type=int, default=650)
    parser.add_argument("--limit", type=int, help="build only the first N documents (tests/smoke runs)")
    parser.add_argument("--skip-scriptures", action="store_true", help="omit slower scripture extraction")
    args = parser.parse_args(argv)
    if args.target_words < 50 or args.max_words < args.target_words:
        parser.error("require 50 <= --target-words <= --max-words")
    return args


if __name__ == "__main__":
    build(parse_args())
