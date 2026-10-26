#!/usr/bin/env python3
"""Where each word sits on a page scan, for the pages a highlight needs:
data/library/<slug>/words/<vol>-<page>.json = {"w", "h", "words": [[text, x0, y0, x1, y1], ...]}
in the scan's own pixels, top-left origin, read from the item's OCR layout (_djvu.xml).

  python3 scripts/library/word_boxes.py <slug> <vol>:<page> [<vol>:<page> ...]
  python3 scripts/library/word_boxes.py --doctrine      # every library page data/doctrine.json names

Only archive.org books have a layout file; a page whose scan is a PDF render is skipped.
"""
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from archive_book import ROOT, fetch  # noqa: E402


def pages_of(slug):
    d = os.path.join(ROOT, "data", "library", slug)
    out = []
    for f in sorted(os.listdir(d)):
        if f == "pages.json" or re.fullmatch(r"pages-v\d+\.json", f):
            out += json.load(open(os.path.join(d, f), encoding="utf-8"))
    return out


def boxes(slug, wanted):
    d = os.path.join(ROOT, "data", "library", slug)
    book = json.load(open(os.path.join(d, "book.json"), encoding="utf-8"))
    if "archive.org" not in book.get("scan", ""):
        print(f"{slug}: not an archive.org scan, skipped")
        return
    pages = pages_of(slug)
    by_vol = {}
    for vol, page in wanted:
        p = next((x for x in pages if x.get("vol", 1) == vol and x["page"] == page), None)
        if p is None:
            print(f"{slug} {vol}:{page}: no such page")
            continue
        by_vol.setdefault(vol, []).append((page, p["img"]))
    os.makedirs(os.path.join(d, "words"), exist_ok=True)
    for vol, want in by_vol.items():
        ident = book["items"][vol - 1]["id"]
        objects = re.findall(r"<OBJECT([^>]*)>(.*?)</OBJECT>", fetch(f"https://archive.org/download/{ident}/{ident}_djvu.xml"), re.S)
        for page, img in want:
            attrs, body = objects[img]
            w, h = (int(re.search(rf'{k}="(\d+)"', attrs).group(1)) for k in ("width", "height"))
            words = []
            for coords, text in re.findall(r'<WORD coords="([\d,]+)"[^>]*>(.*?)</WORD>', body, re.S):
                x0, y1, x1, y0 = (int(c) for c in coords.split(",")[:4])
                words.append([html.unescape(text).strip(), x0, y0, x1, y1])
            json.dump({"w": w, "h": h, "words": words}, open(os.path.join(d, "words", f"{vol}-{page}.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
            print(f"{slug} {vol}:{page}: {len(words)} words")


def main(args):
    if args == ["--doctrine"]:
        want = {}
        for doc in json.load(open(os.path.join(ROOT, "data", "doctrine.json"), encoding="utf-8"))["doctrines"]:
            for b in doc.get("books", []):
                if "book" in b:
                    want.setdefault(b["book"], set()).update((b.get("vol", 1), p) for p in b["pages"])
        for slug, pages in sorted(want.items()):
            boxes(slug, sorted(pages))
        return
    slug, *pages = args
    boxes(slug, [tuple(int(x) for x in p.split(":")) for p in pages])


if __name__ == "__main__":
    main(sys.argv[1:])
