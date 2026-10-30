#!/usr/bin/env python3
"""Put a note in the order of the class.

A note used to gather what a class brought out from the news in a section of its own, before
the scriptures. The class did not: it played a clip and drew its point where it came to it, between
the scriptures it opened. This moves each news item that has its moment into `## Scriptures
Opened` (or `## Readings and Scriptures`), before the first passage opened after that moment, as
one paragraph:

    *[[21:31](https://www.youtube.com/watch?v=…&t=1291s)]* **In The News: <the clip>** — <its point>

and keeps the passages themselves in the order they were opened. A news item with no moment stays
in `## In The News`; the section goes when nothing is left in it.

    python3 scripts/notes/class_order.py [--check] [note.md ...]

With no files it does every note under blog/, captains/notes/ and history/notes/. With --check it
changes nothing and exits 1 if any note is out of order.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STREAMS = ("## Scriptures Opened", "## Readings and Scriptures")
NEWS = "## In The News"
SECONDS = re.compile(r"[?&]t=(\d+)s")
STAMP = re.compile(r"^\*\[(?:\[)?(\d+(?::\d\d){1,2})")


def seconds_of(text):
    """The first moment a piece of a note points at: a linked timestamp, else a bare *[m:ss]*."""
    m = SECONDS.search(text)
    if m:
        return int(m.group(1))
    m = STAMP.match(text.strip())
    if m:
        parts = [int(x) for x in m.group(1).split(":")]
        total = 0
        for p in parts:
            total = total * 60 + p
        return total
    return None


def split_sections(body):
    """The note as its head (up to the first `## `) and its `## ` sections, each with its lines."""
    lines = body.split("\n")
    head, sections, cur = [], [], None
    for line in lines:
        if line.startswith("## "):
            cur = [line]
            sections.append(cur)
        elif cur is None:
            head.append(line)
        else:
            cur.append(line)
    return head, sections


def foot(section):
    """A section's own lines, and the note's closing `---` nav line if it ends the section."""
    for i, line in enumerate(section):
        if line.strip() == "---":
            return section[:i], section[i:]
    return section, []


def news_items(section):
    """Each top-level `- ` item of a section, with the lines indented under it."""
    items, cur, rest = [], None, []
    for line in section[1:]:
        if line.startswith("- "):
            cur = [line]
            items.append(cur)
        elif cur is not None and (line.startswith("  ") or not line.strip()):
            cur.append(line)
        else:
            cur = None
            rest.append(line)
    return [[x for x in item] for item in items], rest


def as_paragraph(item):
    """A news item, `- *[t]* **clip** — point`, as a paragraph that says it is the news."""
    first = item[0][2:]
    m = re.match(r"^(\*\[\[[^\]]+\]\([^)]+\)\]\*|\*\[[^\]]+\]\*)\s*(.*)$", first)
    stamp, text = (m.group(1), m.group(2)) if m else ("", first)
    if text.startswith("**"):
        text = "**In The News: " + text[2:]
    else:
        text = "**In The News:** " + text
    lines = [f"{stamp} {text}".strip()] + [x[2:] if x.startswith("  ") else x for x in item[1:]]
    while lines and not lines[-1].strip():
        lines.pop()
    return lines


def units(section):
    """A stream section as its passages: each starts at a passage line (`**[...` or a reading)."""
    out, cur = [], []
    lead = []
    for line in section[1:]:
        starts = line.startswith("**[") or line.startswith('<div class="reading">')
        if starts:
            cur = [line]
            out.append(cur)
        elif out:
            cur.append(line)
        else:
            lead.append(line)
    return lead, out


def reorder(text):
    m = re.match(r"^(---\n.*?\n---\n)(.*)$", text, re.S)
    if not m:
        return text
    front, body = m.group(1), m.group(2)
    head, sections = split_sections(body)
    titles = [s[0].strip() for s in sections]
    stream_at = next((i for i, t in enumerate(titles) if t in STREAMS), None)
    if stream_at is None:
        return text

    moved = []
    if NEWS in titles:
        ni = titles.index(NEWS)
        own, tail = foot(sections[ni])
        items, rest = news_items(own)
        keep = []
        for item in items:
            s = seconds_of(item[0][2:])
            if s is None:
                keep.append(item)
            else:
                moved.append((s, as_paragraph(item)))
        if moved:
            kept_lines = [l for item in keep for l in item] + rest
            if any(l.strip() for l in kept_lines):
                sections[ni] = [own[0], ""] + [l for item in keep for l in item] + rest + tail
            else:
                sections[ni] = tail  # nothing left: the section goes (its nav line, if any, stays)

    stream_own, stream_tail = foot(sections[stream_at])
    lead, passages = units(stream_own)
    timed = []
    last = -1
    for index, unit in enumerate(passages):
        s = seconds_of(unit[0])
        if s is not None:
            last = s
        timed.append((last, 0, index, unit))
    for index, (s, para) in enumerate(moved):
        timed.append((s, -1, index, para + [""]))  # at the same moment, the news comes first
    timed.sort(key=lambda x: (x[0], x[1], x[2]))
    if not moved and [x[2] for x in timed] == list(range(len(passages))):
        return text  # already in the order of the class
    body_lines = [l for _, _, _, unit in timed for l in unit]
    new_stream = [stream_own[0]] + lead + body_lines
    if new_stream[-1].strip():
        new_stream.append("")
    sections[stream_at] = new_stream + stream_tail

    return front + "\n".join(head + [l for s in sections for l in s])


def notes(paths):
    if paths:
        return [Path(p) for p in paths]
    found = []
    for d in ("blog", "captains", "history/notes"):
        found += sorted((ROOT / d).rglob("*.md"))
    return [p for p in found if p.name not in ("index.md", "README.md")]


def main(argv):
    check = "--check" in argv
    files = notes([a for a in argv if a != "--check"])
    changed = 0
    for path in files:
        text = path.read_text()
        new = reorder(text)
        if new != text:
            changed += 1
            if check:
                print(f"{path.relative_to(ROOT)}: not in the order of the class")
            else:
                path.write_text(new)
    print(f"{changed} of {len(files)} note(s) {'out of' if check else 'put in'} the order of the class")
    return 1 if check and changed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
