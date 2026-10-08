"""Readers for the corpus inputs: transcript records, channel metadata and written notes.

Every reader tolerates bad input and reports it instead of stopping the build: one broken
transcript must not cost the other eight thousand.
"""

import csv
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FEEDS = {
    "classes": ROOT / "blog",
    "captains": ROOT / "captains",
    "history": ROOT / "history",
}
# Where each feed's written notes live, and the site path prefix they are served under.
NOTE_DIRS = (
    ("blog", "classes"),
    ("captains", "captains"),
    ("history/notes", "history"),
)
VIDEO_ID = re.compile(r"[\w-]{11}")


def iso_date(value):
    value = str(value or "").strip()
    if re.fullmatch(r"\d{8}", value):
        value = f"{value[:4]}-{value[4:6]}-{value[6:]}"
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return None
    year, month, day = map(int, value.split("-"))
    if not (1990 <= year <= 2100 and 1 <= month <= 12 and 1 <= day <= 31):
        return None
    return value


def number(value, integer=False):
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(parsed) or math.isinf(parsed) or parsed < 0:
        return None
    return int(parsed) if integer else parsed


def seconds(value):
    """A duration as seconds: '3600', '3600.0', '59:03' or '1:02:03'; None if unreadable."""
    text = str(value or "").strip()
    if re.fullmatch(r"\d+(?::[0-5]?\d){1,2}", text):
        total = 0
        for part in text.split(":"):
            total = total * 60 + int(part)
        return float(total)
    return number(text)


def channel_meta(feed_dir):
    """Read the headerless channel-meta.tsv, keeping the first useful value per id.

    Columns: id, upload date (YYYYMMDD or YYYY-MM-DD), duration seconds, title, views.
    """
    rows = {}
    path = Path(feed_dir) / "channel-meta.tsv"
    if not path.exists():
        return rows
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.reader(handle, delimiter="\t", quoting=csv.QUOTE_NONE):
            if len(row) < 4 or not VIDEO_ID.fullmatch(row[0] or ""):
                continue
            record = {
                "date": iso_date(row[1]),
                "duration": seconds(row[2]),
                "title": row[3].strip() or None,
                "views": number(row[4] if len(row) > 4 else None, integer=True),
            }
            if row[0] not in rows:
                rows[row[0]] = record
            else:
                for key, value in record.items():
                    if rows[row[0]].get(key) is None and value is not None:
                        rows[row[0]][key] = value
    return rows


FRONTMATTER = re.compile(r"\A---\n(.*?)\n---\n", re.S)


def _frontmatter(text):
    match = FRONTMATTER.match(text)
    fields = {}
    if not match:
        return fields
    for line in match.group(1).splitlines():
        key, sep, value = line.partition(":")
        if not sep:
            continue
        value = value.strip()
        try:
            fields[key.strip()] = json.loads(value)
        except ValueError:
            fields[key.strip()] = value.strip("\"'")
    return fields


def notes(root=ROOT):
    """{video_id: {"path", "url", "date", "tags"}} for every written note that embeds a video."""
    found = {}
    for folder, prefix in NOTE_DIRS:
        base = Path(root) / folder
        for path in sorted(base.glob("*/*.md")):
            try:
                text = path.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            video = re.search(r'data-video-id="([\w-]{11})"', text)
            if not video or video[1] in found:
                continue
            meta = _frontmatter(text)
            tags = meta.get("tags")
            # The page's address is the note's slug when it has one (the engine publishes by it;
            # older files repeat the date in their name), else the file's place.
            slug = str(meta.get("slug") or "").strip().strip("/")
            found[video[1]] = {
                "path": str(path.relative_to(root)),
                "url": f"/{prefix}/{slug}" if slug else f"/{prefix}/{path.parent.name}/{path.stem}",
                "date": iso_date(meta.get("date")),
                "tags": sorted({str(t).strip() for t in tags if str(t).strip()}) if isinstance(tags, list) else [],
            }
    return found


def relative(path, root=ROOT):
    """`path` relative to the repository when it is inside it, else its file name."""
    path = Path(path).resolve()
    try:
        return str(path.relative_to(Path(root).resolve()))
    except ValueError:
        return path.name


def transcript_files(feed):
    return sorted((FEEDS[feed] / "transcripts").glob("*.json"))


def read_transcript(path):
    """(record, None) or (None, reason) for one transcript file."""
    try:
        with open(path, encoding="utf-8") as handle:
            record = json.load(handle)
    except (OSError, UnicodeDecodeError) as error:
        return None, f"unreadable: {error.__class__.__name__}"
    except ValueError as error:
        return None, f"invalid_json: {error.msg} at line {error.lineno}"
    if not isinstance(record, dict):
        return None, "invalid_record: not an object"
    if not isinstance(record.get("segments", []), list):
        return None, "invalid_record: segments is not a list"
    return record, None


def valid_cues(record):
    """[(seconds, text, source_index)] for the usable cues, and how many were dropped."""
    cues, dropped = [], 0
    for index, item in enumerate(record.get("segments") or []):
        if not isinstance(item, (list, tuple)) or len(item) < 2:
            dropped += 1
            continue
        seconds = number(item[0])
        text = item[1] if isinstance(item[1], str) else ("" if item[1] is None else str(item[1]))
        text = text.strip()
        if seconds is None or not text:
            dropped += 1
            continue
        cues.append((seconds, text, index))
    return cues, dropped
