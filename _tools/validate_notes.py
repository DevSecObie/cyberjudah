#!/usr/bin/env python3
"""Validate note files: every [[target]] / ![[target]] with a #^vN anchor
resolves to a Bible chapter file containing that anchor; every plain
[[Page]] link resolves to a file in content/; no em dashes.

Usage: python3 _tools/validate_notes.py <file.md> [more files...]
"""
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
content = root / "content"

pages = {}
for p in content.rglob("*.md"):
    pages[p.stem] = p

anchors = {}
def chapter_anchors(stem):
    if stem not in anchors:
        p = pages.get(stem)
        found = set()
        if p:
            for line in p.read_text(encoding="utf-8-sig").splitlines():
                m = re.search(r"\^(v\d+)\s*$", line)
                if m:
                    found.add(m.group(1))
        anchors[stem] = found
    return anchors[stem]

LINK = re.compile(r"!?\[\[([^\]|#]+)(#\^(v\d+))?(\|[^\]]*)?\]\]")

bad = 0
for f in sys.argv[1:]:
    text = Path(f).read_text(encoding="utf-8-sig")
    problems = []
    for i, line in enumerate(text.splitlines(), 1):
        if "—" in line:
            problems.append(f"  L{i}: em dash")
        for m in LINK.finditer(line):
            stem, anchor = m.group(1).strip(), m.group(3)
            if stem not in pages:
                problems.append(f"  L{i}: missing page [[{stem}]]")
            elif anchor and anchor not in chapter_anchors(stem):
                problems.append(f"  L{i}: missing anchor [[{stem}#^{anchor}]]")
    print(f"{Path(f).name}: {'OK' if not problems else str(len(problems)) + ' problems'}")
    for p in problems[:20]:
        print(p)
    bad += len(problems)
sys.exit(1 if bad else 0)
