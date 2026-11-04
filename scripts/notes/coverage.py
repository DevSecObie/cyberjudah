#!/usr/bin/env python3
"""Notes coverage: how many recordings have notes, and which without notes matter most.

A recording "has notes" when a note (blog/, captains/, history/notes/) carries its video id. The recordings come from the three
transcript feeds. Recordings without notes are ranked by how many verses the transcripts show
them reading aloud (data/precepts/readings, scripts/precepts/readings.py): those are the ones a
verse lookup lands on most, so their notes do the most good. Bishops' and Deacons' classes are
listed first in a separate table, as the notes backlog puts them first.

  python3 scripts/notes/coverage.py [--top 50] [--out FILE.md]
"""
import argparse, glob, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FEEDS = (("blog", "Sabbath classes"), ("captains", "15 Min w/ Captains"), ("history", "Our Hidden History"))


def noted_videos():
    out = set()
    for d in ("blog", "captains", os.path.join("history", "notes")):
        for f in glob.glob(os.path.join(ROOT, d, "*", "*.md")):
            for m in re.finditer(r'data-video-id="([\w-]{11})"|youtube\.com/watch\?v=([\w-]{11})', open(f, encoding="utf-8").read()[:4000]):
                out.add(m.group(1) or m.group(2))
    return out


def class_metadata():
    rows = {}
    p = os.path.join(ROOT, "data", "sources", "class-teachers.tsv")
    if os.path.exists(p):
        for line in open(p, encoding="utf-8").read().splitlines()[1:]:
            c = line.split("\t")
            if len(c) == 4: rows[c[0]] = {"teacher": c[1], "date": c[2], "title": c[3]}
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=50)
    ap.add_argument("--out")
    a = ap.parse_args()
    noted = noted_videos()
    meta = json.load(open(os.path.join(ROOT, "data", "precepts", "readings", "videos.json"), encoding="utf-8"))
    fixes = class_metadata()
    verses = {}
    for f in glob.glob(os.path.join(ROOT, "data", "precepts", "readings", "*.json")):
        if f.endswith("videos.json"): continue
        slug = os.path.basename(f)[:-5]
        for ch, vs in json.load(open(f, encoding="utf-8")).items():
            for v, rows in vs.items():
                for r in rows: verses.setdefault(r[0], set()).add(f"{slug} {ch}:{v}")
    lines = ["# Notes coverage", "", "| Feed | Recordings | With notes | Without notes |", "|---|---:|---:|---:|"]
    tot = [0, 0]
    feed_of = {}
    for d, label in FEEDS:
        vids = [os.path.basename(p)[:-5] for p in glob.glob(os.path.join(ROOT, d, "transcripts", "*.json"))]
        for v in vids: feed_of[v] = label
        n, w = len(vids), sum(1 for v in vids if v in noted)
        tot[0] += n; tot[1] += w
        lines.append(f"| {label} | {n:,} | {w:,} | {n - w:,} |")
    lines.append(f"| **All** | **{tot[0]:,}** | **{tot[1]:,}** | **{tot[0] - tot[1]:,}** |")

    def row(v):
        m = {**meta.get(v, {}), **{k: x for k, x in fixes.get(v, {}).items() if x}}
        return m.get("date") or "date unknown", m.get("title") or v, m.get("teacher") or "teacher unknown"
    missing = sorted((v for v in feed_of if v not in noted and v in verses), key=lambda v: (-len(verses[v]), v))
    lead = [v for v in missing if re.match(r"(bishop|deacon|elder nathanyel)\b", row(v)[2], re.I)]
    for title, vids in ((f"Bishops' and Deacons' classes without notes, by verses read (top {a.top})", lead), (f"All recordings without notes, by verses read (top {a.top})", missing)):
        lines += ["", f"## {title}", "", "| # | Verses read | Date | Recording | Teacher | Feed | Video |", "|---:|---:|---|---|---|---|---|"]
        for i, v in enumerate(vids[: a.top], 1):
            d, t, who = row(v)
            lines.append(f"| {i} | {len(verses[v])} | {d} | {t.strip(' |').replace('|', '·')} | {who} | {feed_of[v]} | https://youtu.be/{v} |")
    lines += ["", "\"Verses read\" counts the distinct verses the transcript index shows the recording reading aloud. "
              "It stands in for how often a verse lookup lands on the recording, since lookups are not logged."]
    text = "\n".join(lines) + "\n"
    if a.out:
        open(a.out, "w", encoding="utf-8").write(text)
    print(text if not a.out else f"wrote {a.out}")


if __name__ == "__main__":
    main()
