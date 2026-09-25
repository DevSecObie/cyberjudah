#!/usr/bin/env python3
"""Fill missing upload dates (and durations, views) in each feed's channel-meta.tsv.

    python3 scripts/corpus/backfill_meta.py --report                  # what is missing
    python3 scripts/corpus/backfill_meta.py --backend yt-dlp --limit 500
    python3 scripts/corpus/backfill_meta.py --from-tsv found.tsv      # id<TAB>date[<TAB>duration<TAB>views]

Only transcripts that would otherwise have no date are looked up. Existing values are never
overwritten: a blank cell is filled, a filled cell is left alone. Rows keep their order and
every other byte of the file; a transcript with no row gets one appended. Dates are written as
YYYYMMDD, the format yt-dlp reports and the corpus reads.

`--from-tsv` accepts dates as YYYYMMDD, YYYY-MM-DD, or YouTube's own wording
("Premiered Jan 5, 2023", "Streamed live on Mar 3, 2021").
"""

import argparse
import hashlib
import os
import re
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sources  # noqa: E402

MONTHS = {m: i for i, m in enumerate(("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"), 1)}
PUBLISHED = re.compile(r"\b([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b")
DAY_FIRST = re.compile(r"\b(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})\b")


def compact_date(value):
    """'Premiered Jan 5, 2023' / '2023-01-05' / '20230105' -> '20230105', else None."""
    text = str(value or "").strip()
    iso = sources.iso_date(text)
    if iso:
        return iso.replace("-", "")
    for pattern, order in ((PUBLISHED, "mdy"), (DAY_FIRST, "dmy")):
        match = pattern.search(text)
        if not match:
            continue
        if order == "mdy":
            month, day, year = match.group(1), match.group(2), match.group(3)
        else:
            day, month, year = match.group(1), match.group(2), match.group(3)
        month_number = MONTHS.get(month.lower()[:3])
        if not month_number:
            continue
        try:
            parsed = date(int(year), month_number, int(day))
        except ValueError:
            continue
        return parsed.strftime("%Y%m%d") if sources.iso_date(parsed.isoformat()) else None
    return None


def clean_number(value, integer=False):
    """'1,234' / '4,140 views' / '3600.0' -> a plain number string; '' when unknown."""
    match = re.search(r"\d[\d,]*(?:\.\d+)?", str(value or ""))
    parsed = sources.number(match.group(0).replace(",", "")) if match else None
    if parsed is None:
        return ""
    return str(int(parsed)) if integer or float(parsed).is_integer() else str(parsed)


def undated(feed):
    """{video_id: title} for transcripts in `feed` that no source dates."""
    meta = sources.channel_meta(sources.FEEDS[feed])
    notes = sources.notes()
    missing = {}
    for path in sources.transcript_files(feed):
        record, problem = sources.read_transcript(path)
        if problem:
            continue
        video_id = str(record.get("videoId") or path.stem)
        if sources.iso_date(record.get("date")) or meta.get(video_id, {}).get("date"):
            continue
        if notes.get(video_id, {}).get("date"):
            continue
        missing[video_id] = str(record.get("title") or meta.get(video_id, {}).get("title") or "")
    return missing


def apply(feed_dir, found, titles):
    """Write `found` ({id: {date, duration, views}}) into channel-meta.tsv; return cells filled."""
    path = Path(feed_dir) / "channel-meta.tsv"
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True) if path.exists() else []
    filled = 0
    done = set()
    for number, line in enumerate(lines):
        body = line.rstrip("\r\n")
        ending = line[len(body):]
        cells = body.split("\t")
        video_id = cells[0]
        if video_id not in found or video_id in done or len(cells) < 4:
            continue
        cells += [""] * (5 - len(cells))
        values = found[video_id]
        for column, key in ((1, "date"), (2, "duration"), (4, "views")):
            if not cells[column].strip() or cells[column].strip() == "NA":
                if values.get(key):
                    cells[column] = values[key]
                    filled += 1
        done.add(video_id)
        lines[number] = "\t".join(cells) + (ending or "\n")
    for video_id in sorted(set(found) - done):
        values = found[video_id]
        if not values.get("date"):
            continue
        title = (titles.get(video_id) or "").replace("\t", " ").replace("\n", " ")
        if lines and not lines[-1].endswith("\n"):
            lines[-1] += "\n"
        lines.append("\t".join([video_id, values["date"], values.get("duration", ""), title, values.get("views", "")]) + "\n")
        filled += 1
    if filled:
        temporary = path.with_suffix(".tsv.tmp")
        temporary.write_text("".join(lines), encoding="utf-8")
        os.replace(temporary, path)
    return filled


def read_tsv(path):
    found = {}
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            cells = line.rstrip("\r\n").split("\t")
            if not cells or not sources.VIDEO_ID.fullmatch(cells[0]):
                continue
            found[cells[0]] = {
                "date": compact_date(cells[1] if len(cells) > 1 else None) or "",
                "duration": clean_number(cells[2] if len(cells) > 2 else None),
                "views": clean_number(cells[3] if len(cells) > 3 else None, integer=True),
            }
    return found


def ytdlp(ids, batch=50):
    command = ["yt-dlp"] if shutil.which("yt-dlp") else [sys.executable, "-m", "yt_dlp"]
    found = {}
    for start in range(0, len(ids), batch):
        chunk = ids[start:start + batch]
        result = subprocess.run(
            command + ["--skip-download", "--ignore-errors", "--no-warnings", "--no-playlist",
                       "--print", "%(id)s\t%(upload_date)s\t%(duration)s\t%(view_count)s"]
            + [f"https://www.youtube.com/watch?v={video_id}" for video_id in chunk],
            capture_output=True, text=True,
        )
        for line in result.stdout.splitlines():
            cells = line.split("\t")
            if len(cells) == 4 and cells[0] in chunk:
                found[cells[0]] = {
                    "date": compact_date(cells[1]) or "",
                    "duration": clean_number(cells[2]),
                    "views": clean_number(cells[3], integer=True),
                }
        print(f"yt-dlp: {min(start + batch, len(ids))}/{len(ids)} looked up, {sum(1 for v in found.values() if v['date'])} dated", flush=True)
    return found


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--feeds", nargs="+", choices=sorted(sources.FEEDS), default=sorted(sources.FEEDS))
    parser.add_argument("--backend", choices=("yt-dlp",), help="look the missing dates up")
    parser.add_argument("--from-tsv", type=Path, help="apply dates found elsewhere")
    parser.add_argument("--limit", type=int, help="look up at most N videos in total")
    parser.add_argument("--report", action="store_true", help="list what is missing and change nothing")
    parser.add_argument("--ids-out", type=Path, help="with --report: write the undated ids, one per line")
    args = parser.parse_args(argv)
    if not (args.report or args.backend or args.from_tsv):
        parser.error("choose --report, --backend or --from-tsv")

    supplied = read_tsv(args.from_tsv) if args.from_tsv else {}
    budget = args.limit
    total_missing = total_filled = 0
    all_ids = []
    for feed in args.feeds:
        missing = undated(feed)
        total_missing += len(missing)
        ids = sorted(missing)
        all_ids += ids
        if args.report:
            print(f"{feed}: {len(ids)} transcripts without a date")
            continue
        found = {i: supplied[i] for i in ids if i in supplied}
        if args.backend:
            # Rotate daily so videos YouTube will not answer for do not block the rest.
            today = date.today().isoformat()
            todo = sorted((i for i in ids if i not in found), key=lambda i: hashlib.sha256(f"{today}{i}".encode()).hexdigest())
            if budget is not None:
                todo, budget = todo[:budget], budget - len(todo[:budget])
            found.update(ytdlp(todo))
        filled = apply(sources.FEEDS[feed], found, missing)
        dated = sum(1 for v in found.values() if v.get("date"))
        total_filled += filled
        print(f"{feed}: {len(ids)} undated, {dated} dates found, {filled} cells filled")
    if args.report and args.ids_out:
        args.ids_out.write_text("".join(i + "\n" for i in all_ids), encoding="utf-8")
    print(f"total: {total_missing} undated transcripts" + ("" if args.report else f", {total_filled} cells filled"))


if __name__ == "__main__":
    main()
