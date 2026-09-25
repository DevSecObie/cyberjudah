#!/usr/bin/env python3
"""Build a reproducible analysis corpus from CyberJudah transcript records.

The transcript JSON files remain the evidence layer and are never modified. This script
joins their metadata, detects where the speakers begin, groups caption cues into passages,
keeps the original text beside a lightly normalized text, detects language, extracts
scripture references, validates every record against the data dictionary (schema.py), and
writes deterministic outputs. SCHEMA.md is the contract.
"""

import argparse
import csv
import gzip
import hashlib
import heapq
import io
import json
import multiprocessing
import os
import re
import shutil
import subprocess
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import language  # noqa: E402
import schema  # noqa: E402
import sources  # noqa: E402
import textnorm  # noqa: E402
from sources import FEEDS, ROOT, iso_date, number  # noqa: E402,F401  (re-exported for callers)
from textnorm import normalize_piece, normalized_join, normalized_with_offsets, overlap_words  # noqa: E402,F401

CORPUS_VERSION = "cj-corpus-v2"
SCHEMA_VERSION = schema.SCHEMA_VERSION
CREATED_BY = "scripts/corpus/build.py"
TOKEN = re.compile(r"\S+")
REBROADCAST = re.compile(r"previously aired|re-?broadcast|re-?upload|\brerun\b|\bencore\b", re.I)
MIN_SPEECH_WORDS = 30
TURN_GAP_SECONDS = 1.25


class CorpusError(Exception):
    pass


def json_line(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"


def sha256_text(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def transcript_hash(record):
    payload = json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return sha256_text(payload)


def clock(seconds):
    seconds = int(max(0, seconds))
    return f"{seconds // 3600:02d}:{seconds % 3600 // 60:02d}:{seconds % 60:02d}"


def cue_words(text):
    return len([t for t in TOKEN.findall(str(text)) if not t.startswith(">>")])


def make_chunks(cues, duration=None, target_words=450, max_words=650):
    """Group caption cues into passages without splitting a cue.

    `cues` holds (seconds, text) or (seconds, text, ...) items. A passage closes at the
    maximum size, or once it reaches the target at a natural break: a pause of at least
    1.25 seconds or a marked speaker change. A short final passage joins its predecessor.
    Returns (first, stop) index pairs.
    """
    chunks = []
    start = count = 0
    for index, cue in enumerate(cues):
        count += cue_words(cue[1])
        natural_break = True
        if index + 1 < len(cues):
            following = cues[index + 1]
            gap = max(0.0, float(following[0]) - float(cue[0]))
            natural_break = gap >= TURN_GAP_SECONDS or str(following[1]).lstrip().startswith(">>")
        if count >= max_words or (count >= target_words and natural_break):
            chunks.append((start, index + 1))
            start, count = index + 1, 0
    if start < len(cues):
        chunks.append((start, len(cues)))
    if len(chunks) > 1:
        a, b = chunks[-1]
        tail_words = sum(cue_words(x[1]) for x in cues[a:b])
        if tail_words < max(40, target_words // 4):
            chunks[-2] = (chunks[-2][0], b)
            chunks.pop()
    return chunks


def scripture_extractor(enabled):
    if not enabled:
        return lambda _text: []
    sys.path.insert(0, str(ROOT / "scripts" / "notes"))
    import prep

    def verified(ref):
        try:
            return bool(prep.verify(ref)[0])
        except Exception:  # an unknown book or missing chapter data is simply unverified
            return False

    def extract(text):
        return [
            {
                "book": ref["book"],
                "chapter": ref["chapter"],
                "first_verse": ref["first"],
                "last_verse": ref["last"],
                "heard_as": ref["raw"],
                "verified": verified(ref),
            }
            for ref in prep.extract(text)
        ]

    return extract


def speech_start(record, cues, duration, flags):
    """(index of the first speech cue, seconds, source).

    The transcript's `start` is trusted unless it would discard most of the recording.
    """
    if not cues:
        return 0, 0.0, "none"
    start = number(record.get("start"))
    if start is None:
        return 0, cues[0][0], "none"
    first = next((i for i, cue in enumerate(cues) if cue[0] >= start), len(cues))
    total = sum(cue_words(c[1]) for c in cues) or 1
    before = sum(cue_words(c[1]) for c in cues[:first])
    too_late = duration is not None and duration > 0 and start > duration * 0.5
    if before / total > 0.5 or too_late or first == len(cues):
        flags.append("speech_start_suspect")
        return 0, cues[0][0], "ignored"
    return first, (cues[first][0] if first < len(cues) else start), "transcript"


def build_document(path, feed, meta, notes, extract, hits, target_words, max_words):
    """(document, passages) for one transcript file, or raise CorpusError(reason)."""
    record, problem = sources.read_transcript(path)
    if problem:
        raise CorpusError(problem)

    video_id = str(record.get("videoId") or path.stem)
    doc_id = f"youtube:{video_id}"
    auxiliary = meta.get(video_id, {})
    note = notes.get(video_id)
    flags = []

    date, date_source = iso_date(record.get("date")), "transcript"
    if not date and auxiliary.get("date"):
        date, date_source = auxiliary["date"], "channel-meta"
    if not date and note and note["date"]:
        date, date_source = note["date"], "note"
    if not date:
        date_source = None
        flags.append("missing_date")

    title = str(record.get("title") or auxiliary.get("title") or video_id).strip()
    duration = number(record.get("duration"))
    if duration is None:
        duration = auxiliary.get("duration")
    if duration is None:
        flags.append("missing_duration")
    views = number(record.get("views"), integer=True)
    if views is None:
        views = auxiliary.get("views")
    episode = record.get("episode") if isinstance(record.get("episode"), int) and not isinstance(record.get("episode"), bool) else None

    cues, dropped = sources.valid_cues(record)
    if dropped:
        flags.append("dropped_captions")
    if not cues:
        flags.append("empty_transcript")
    elif len(cues) < 5:
        flags.append("suspiciously_short")
    if any(cues[i][0] > cues[i + 1][0] for i in range(len(cues) - 1)):
        flags.append("non_monotonic_timestamps")
    if "transcriptionMethod" not in record:
        flags.append("missing_provenance")
    if REBROADCAST.search(title):
        flags.append("rebroadcast")

    first_speech, start_seconds, start_source = speech_start(record, cues, duration, flags)

    passages = []
    doc_tags = Counter()
    speaker_turns = 0
    language_words = Counter()
    speech_texts = []
    regions = (("pre_speech", 0, first_speech), ("speech", first_speech, len(cues)))
    for region, lo, hi in regions:
        region_cues = cues[lo:hi]
        for a, b in make_chunks(region_cues, duration, target_words, max_words):
            source = region_cues[a:b]
            tags = Counter()
            normalized, offsets, changes, removed = textnorm.normalize_cues(((c[0], c[1]) for c in source), hits, tags)
            # A marker opening the passage is the boundary it was cut at, not a change inside it.
            if source[0][1].lstrip().startswith(">>") and changes:
                changes -= 1
            end_index = lo + b
            if end_index < len(cues):
                end_seconds = cues[end_index][0]
            elif duration is not None and duration >= source[-1][0]:
                end_seconds = duration
            else:
                end_seconds = source[-1][0]
            begin = round(source[0][0], 2)
            end = round(max(end_seconds, source[0][0]), 2)
            words = len(textnorm.speech_words(normalized))
            code, confidence = language.detect(normalized)
            if region == "speech":
                speech_texts.append(normalized)
                if code != "und":
                    language_words[code] += words
            doc_tags.update(tags)
            speaker_turns += changes
            passages.append({
                "schema_version": SCHEMA_VERSION,
                "corpus_version": CORPUS_VERSION,
                "segment_id": f"{doc_id}:{source[0][2]:06d}",
                "doc_id": doc_id,
                "segment_index": len(passages),
                "region": region,
                "source_segment_first": source[0][2],
                "source_segment_last": source[-1][2],
                "start_seconds": begin,
                "end_seconds": end,
                "start_time": clock(begin),
                "end_time": clock(end),
                "speaker_id": None,
                "speaker_changes": changes,
                "word_count": words,
                "text_original": " ".join(c[1] for c in source),
                "text_normalized": normalized,
                "cue_offsets": offsets,
                "caption_overlap_removed_words": removed,
                "non_speech_tags": dict(sorted(tags.items())),
                "language": code,
                "language_confidence": confidence,
                "scripture_references": extract(normalized) if region == "speech" else [],
                "source_url": f"https://www.youtube.com/watch?v={video_id}&t={int(begin)}s",
                "notes": None,
            })

    speech_words = sum(p["word_count"] for p in passages if p["region"] == "speech")
    pre_words = sum(p["word_count"] for p in passages if p["region"] == "pre_speech")
    if cues and speech_words < MIN_SPEECH_WORDS:
        flags.append("no_speech_content")

    determined = sum(language_words.values())
    if determined:
        detected, top = language_words.most_common(1)[0]
        detected_confidence = round(top / determined, 3)
        if len(language_words) > 1 and language_words.most_common(2)[1][1] / determined >= 0.1:
            flags.append("mixed_language")
    else:
        detected, detected_confidence = "und", 0.0
        if speech_words >= MIN_SPEECH_WORDS:
            flags.append("language_undetermined")
    declared = record.get("language") if isinstance(record.get("language"), str) else None
    if declared and detected != "und" and detected != declared:
        flags.append("language_declared_mismatch")

    doc = {
        "schema_version": SCHEMA_VERSION,
        "corpus_version": CORPUS_VERSION,
        "normalization_version": textnorm.NORMALIZATION_VERSION,
        "doc_id": doc_id,
        "video_id": video_id,
        "feed": feed,
        "file_name": sources.relative(path),
        "source_type": "radio_program" if feed == "history" else "lecture",
        "source_platform": str(record.get("sourcePlatform") or "youtube"),
        "source_channel": record.get("sourceChannel") if isinstance(record.get("sourceChannel"), str) else None,
        "source_url": f"https://www.youtube.com/watch?v={video_id}",
        "title": title,
        "clean_title": str(record.get("cleanTitle") or title),
        "episode": episode,
        "date": date,
        "date_source": date_source,
        "duration_seconds": duration,
        "views": views,
        "language": detected if detected != "und" else (declared or "und"),
        "language_declared": declared,
        "language_detected": detected,
        "language_confidence": detected_confidence,
        "languages": {code: round(n / determined, 3) for code, n in sorted(language_words.items())},
        "language_variety": None,
        "location": None,
        "num_speakers": None,
        "speaker_ids": [],
        "speaker_labels": "none",
        "speaker_turns_marked": speaker_turns,
        "domain": "religious_education",
        "topic_tags": note["tags"] if note else [],
        "note_path": note["path"] if note else None,
        "has_timestamps": True,
        "timestamp_unit": "seconds",
        "transcription_method": str(record.get("transcriptionMethod") or "unknown"),
        "transcription_style": "lightly_cleaned_verbatim",
        "caption_style": textnorm.caption_style(c[1] for c in cues),
        "normalization_level": "light",
        "normalization_rules": list(textnorm.RULES),
        "audio_quality_notes": None,
        "privacy_level": "internal",
        "consent_status": "public_broadcast",
        "redaction_applied": "platform_profanity_mask" if doc_tags.get("censored") else "none",
        "created_by": CREATED_BY,
        "word_count": sum(cue_words(c[1]) for c in cues),
        "speech_word_count": speech_words,
        "pre_speech_word_count": pre_words,
        "speech_start_seconds": round(start_seconds, 2),
        "speech_start_source": start_source,
        "caption_segment_count": len(cues),
        "dropped_caption_count": dropped,
        "non_speech_tags": dict(sorted(doc_tags.items())),
        "content_sha256": transcript_hash(record),
        "normalized_sha256": sha256_text(" ".join(speech_texts)),
        "source_sha256": record.get("sourceSha256") if isinstance(record.get("sourceSha256"), str) else None,
        "duplicate_of": None,
        "quality_flags": flags,
    }
    return doc, passages


def open_deterministic_gzip(path):
    raw = path.open("wb")
    zipped = gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0)
    return io.TextIOWrapper(zipped, encoding="utf-8", newline="\n")


def csv_value(value):
    if value is None:
        return ""
    if isinstance(value, list):
        return "; ".join(map(str, value))
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    if isinstance(value, bool):
        return "yes" if value else "no"
    return value


def git(*args):
    try:
        result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, timeout=30)
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0:
        return None
    return result.stdout.strip() or None


def file_digest(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


_WORKER = {}


def _start_worker(context):
    _WORKER.clear()
    _WORKER.update(context)
    _WORKER["extract"] = scripture_extractor(context["scriptures"])


def _document_job(job):
    feed, path = job
    hits = Counter()
    try:
        doc, passages = build_document(path, feed, _WORKER["meta"][feed], _WORKER["notes"], _WORKER["extract"],
                                       hits, _WORKER["target_words"], _WORKER["max_words"])
    except CorpusError as error:
        return feed, path, str(error)
    return feed, path, (doc, passages, hits)


def select_files(feeds, limit=None):
    """[(feed, path)] in build order: feeds as given, files sorted, the first `limit` in all."""
    jobs = [(feed, path) for feed in feeds for path in sources.transcript_files(feed)]
    return jobs if limit is None else jobs[:limit]


def documents_in_order(jobs, context, workers):
    """Build every job, in parallel when `workers` > 1, yielding results in job order."""
    if workers > 1 and len(jobs) > 1:
        try:
            pool_context = multiprocessing.get_context("fork")
        except ValueError:
            pool_context = None
        if pool_context is not None:
            with pool_context.Pool(workers, initializer=_start_worker, initargs=(context,)) as pool:
                yield from pool.imap(_document_job, jobs, chunksize=4)
            return
    _start_worker(context)
    for job in jobs:
        yield _document_job(job)


def build(args):
    out = Path(args.out).resolve()
    temporary = out.with_name(out.name + ".tmp")
    if temporary.exists():
        shutil.rmtree(temporary)
    temporary.mkdir(parents=True)

    jobs = select_files(args.feeds or list(FEEDS), args.limit)
    context = {
        "meta": {feed: sources.channel_meta(FEEDS[feed]) for feed in {feed for feed, _path in jobs}},
        "notes": sources.notes(),
        "scriptures": not args.skip_scriptures,
        "target_words": args.target_words,
        "max_words": args.max_words,
    }
    counters, issue_counts, hits = Counter(), Counter(), Counter()
    by_language, by_date_source, by_caption_style, by_feed = Counter(), Counter(), Counter(), Counter()
    issue_documents, failures, sample = [], [], []
    seen_text = {}

    selected = args.feeds or list(FEEDS)
    documents_path = temporary / "documents.jsonl"
    with documents_path.open("w", encoding="utf-8", newline="\n") as documents, \
            (temporary / "documents.csv").open("w", encoding="utf-8", newline="") as table, \
            open_deterministic_gzip(temporary / "segments.jsonl.gz") as segment_rows:
        writer = csv.DictWriter(table, fieldnames=list(schema.DOCUMENT), lineterminator="\n")
        writer.writeheader()
        for feed, path, result in documents_in_order(jobs, context, args.jobs):
            if isinstance(result, str):
                failures.append({"file_name": sources.relative(path), "reason": result})
                continue
            doc, passages, doc_hits = result
            hits.update(doc_hits)

            if doc["speech_word_count"] >= MIN_SPEECH_WORDS:
                first = seen_text.setdefault(doc["normalized_sha256"], doc["doc_id"])
                if first != doc["doc_id"]:
                    doc["duplicate_of"] = first
                    doc["quality_flags"].append("duplicate_content")

            errors = schema.validate(doc, schema.DOCUMENT)
            for row in passages:
                errors += schema.validate_segment(row)
            if errors:
                raise SystemExit(f"{doc['doc_id']} does not match the data dictionary:\n  " + "\n  ".join(sorted(set(errors))[:20]))

            documents.write(json_line(doc))
            writer.writerow({k: csv_value(v) for k, v in doc.items()})
            for row in passages:
                segment_rows.write(json_line(row))
                counters["analysis_segments"] += 1
                counters[f"{row['region']}_segments"] += 1
                counters["scripture_references"] += len(row["scripture_references"])
                counters["scripture_references_verified"] += sum(r["verified"] for r in row["scripture_references"])
                if args.qa_sample and row["region"] == "speech" and row["word_count"] >= 50 and not doc["duplicate_of"]:
                    rank = int(hashlib.sha256(row["segment_id"].encode()).hexdigest()[:16], 16)
                    item = (-rank, row["segment_id"], {
                        "segment_id": row["segment_id"],
                        "doc_id": doc["doc_id"],
                        "title": doc["title"],
                        "feed": feed,
                        "source_url": row["source_url"],
                        "start_time": row["start_time"],
                        "end_time": row["end_time"],
                        "language": row["language"],
                        "text_original": row["text_original"],
                        "text_normalized": row["text_normalized"],
                        "review_status": None,
                        "reviewer": None,
                        "reviewer_notes": None,
                    })
                    if len(sample) < args.qa_sample:
                        heapq.heappush(sample, item)
                    elif item > sample[0]:
                        heapq.heapreplace(sample, item)

            counters["documents"] += 1
            counters["caption_segments"] += doc["caption_segment_count"]
            counters["words"] += doc["word_count"]
            counters["speech_words"] += doc["speech_word_count"]
            counters["pre_speech_words"] += doc["pre_speech_word_count"]
            by_feed[feed] += 1
            by_language[doc["language"]] += 1
            by_date_source[doc["date_source"] or "missing"] += 1
            by_caption_style[doc["caption_style"]] += 1
            for flag in doc["quality_flags"]:
                issue_counts[flag] += 1
            if doc["quality_flags"]:
                issue_documents.append({"doc_id": doc["doc_id"], "flags": doc["quality_flags"], "title": doc["title"]})

    with (temporary / "qa_sample.jsonl").open("w", encoding="utf-8", newline="\n") as handle:
        for _rank, _id, item in sorted(sample, key=lambda x: x[1]):
            handle.write(json_line(item))

    quality = {
        "schema_version": SCHEMA_VERSION,
        "corpus_version": CORPUS_VERSION,
        "normalization_version": textnorm.NORMALIZATION_VERSION,
        "parameters": {
            "feeds": selected,
            "target_words": args.target_words,
            "max_words": args.max_words,
            "scripture_extraction": not args.skip_scriptures,
            "limit": args.limit,
        },
        "counts": dict(sorted(counters.items())),
        "documents_by_feed": dict(sorted(by_feed.items())),
        "documents_by_language": dict(sorted(by_language.items())),
        "documents_by_date_source": dict(sorted(by_date_source.items())),
        "documents_by_caption_style": dict(sorted(by_caption_style.items())),
        "rule_hits": {rule: hits.get(rule, 0) for rule in textnorm.RULES},
        "issue_counts": dict(sorted(issue_counts.items())),
        "unreadable_files": failures,
        "issue_documents": issue_documents,
    }
    (temporary / "quality.json").write_text(json.dumps(quality, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    (temporary / "schema.json").write_text(json.dumps(schema.json_schema(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    shutil.copyfile(HERE / "SCHEMA.md", temporary / "README.md")

    manifest = {
        "corpus_version": CORPUS_VERSION,
        "schema_version": SCHEMA_VERSION,
        "normalization_version": textnorm.NORMALIZATION_VERSION,
        "created_by": CREATED_BY,
        "source_commit": git("rev-parse", "HEAD"),
        "created_at": git("log", "-1", "--format=%cI"),
        "counts": {"documents": counters["documents"], "segments": counters["analysis_segments"], "unreadable_files": len(failures)},
        "files": {
            p.name: {"bytes": p.stat().st_size, "sha256": file_digest(p)}
            for p in sorted(temporary.iterdir())
        },
    }
    (temporary / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    if out.exists():
        shutil.rmtree(out)
    temporary.replace(out)
    print(f"corpus: {counters['documents']} documents -> {counters['analysis_segments']} passages "
          f"({counters['pre_speech_segments']} pre-speech)")
    print(f"words: {counters['words']} ({counters['speech_words']} spoken) · scripture references: "
          f"{counters['scripture_references']} ({counters['scripture_references_verified']} verified)")
    print(f"quality flags: {sum(issue_counts.values())} across {len(issue_documents)} documents")
    print(f"languages: {dict(by_language.most_common())}")
    if failures:
        print(f"unreadable transcripts: {len(failures)} (see quality.json)")
    print(f"wrote {out}")
    if failures and args.strict:
        raise SystemExit(f"--strict: {len(failures)} transcript file(s) could not be read")


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", default=str(ROOT / "dist" / "corpus"))
    parser.add_argument("--feeds", nargs="+", choices=sorted(FEEDS))
    parser.add_argument("--target-words", type=int, default=450)
    parser.add_argument("--max-words", type=int, default=650)
    parser.add_argument("--limit", type=int, help="build only the first N documents (tests/smoke runs)")
    parser.add_argument("--skip-scriptures", action="store_true", help="omit slower scripture extraction")
    parser.add_argument("--qa-sample", type=int, default=100, help="passages to draw for manual review (0 disables)")
    parser.add_argument("--jobs", type=int, default=os.cpu_count() or 1, help="recordings built in parallel (default: CPU count)")
    parser.add_argument("--strict", action="store_true", help="fail when any transcript file cannot be read")
    args = parser.parse_args(argv)
    if args.target_words < 50 or args.max_words < args.target_words:
        parser.error("require 50 <= --target-words <= --max-words")
    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be at least 1")
    if args.jobs < 1:
        parser.error("--jobs must be at least 1")
    if args.qa_sample < 0:
        parser.error("--qa-sample must be 0 or more")
    return args


if __name__ == "__main__":
    build(parse_args())
