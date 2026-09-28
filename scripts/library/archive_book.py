#!/usr/bin/env python3
"""A public-domain book from archive.org into data/library/<slug>/: its text page by printed
page, its chapters, and its fold-out maps, so the app can show the book beside the classes
that read from it.

  python3 scripts/library/archive_book.py lost-tribes-a-myth

Each book is described in BOOKS below: the archive.org item, the chapters (from its table of
contents) and the map leaves. The script downloads the item's OCR layout (_djvu.xml) and scan
data, writes pages.json ([{page, leaf, text}], paragraphs separated by a blank line) and
book.json, and saves each map as WebP. Page scans themselves are not stored: the app loads
them from archive.org by leaf number.
"""
import html
import io
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

BOOKS = {
    "lost-tribes-a-myth": {
        "title": "The Lost Tribes a Myth",
        "subtitle": "Suggestions Towards Rewriting Hebrew History",
        "author": "Allen H. Godbey",
        "year": 1930,
        "publisher": "Duke University Press, Durham, North Carolina",
        "archive": "losttribesmythsu00godb",
        "license": "Public domain in the United States (published 1930).",
        "chapters": [
            ("I", "The Lost Tribes Theory", 1), ("II", "Many Deportations from Palestine", 8),
            ("III", "Traditions of Palestinian Origin", 15), ("IV", "Hebrews Are Not Israelites", 33),
            ("V", "The Great Schism", 72), ("VI", "Status of Deported Israelites", 118),
            ("VII", "Ethnologists and Jews", 144), ("VIII", "Asmonean Propagandism", 160),
            ("IX", "Yemen Jews and Falashas", 174), ("X", "Berber, Moorish, and Negro Jews", 204),
            ("XI", "Khazars, Scythians, and Tartars", 257), ("XII", "Black Jews of India", 317),
            ("XIII", "Persian, Turkoman, Mongol, and Chinese Jews", 368), ("XIV", "Samaritans, Sadducees, and Karaites", 426),
            ("XV", "Missionaries Who Failed", 451), ("XVI", "Proselytes in the Old Testament", 472),
            ("XVII", "Shrine Levites", 485), ("XVIII", "The City of Refuge", 514),
            ("XIX", "Captivity, Adoption, and Slavery", 531), ("XX", "Badges", 552),
            ("XXI", "The Provenance of Yahwism", 561), ("XXII", "Survivals of Sacrifice", 584),
            ("XXIII", "Exilic Propagandism", 606), ("XXIV", "Ancient Jewish Translations of Their Scriptures", 621),
            ("XXV", "The Babylonian Academies", 651), ("XXVI", "No Lost Tribes in the Prophets", 665),
            ("XXVII", "Post-Exilic References", 674), ("XXVIII", "Rewriting Hebrew History", 686),
            ("", "Bibliography", 711), ("", "Index of Scripture Passages", 757), ("", "Topical Index", 769),
        ],
        "maps": [
            (286, 256, "Yemen Jews and Falashas; Berber, Moorish and Negro Jews", "From Palestine across Africa"),
            (346, 316, "From Asia Minor to Persia", "From Palestine to Asia Minor, the Caucasus, and Babylonia"),
            (398, 366, "From Palestine to India and China", "From Palestine to India and China"),
        ],
        "contents_leaves": (19, 30),
        # Pages whose running head the OCR could not read, checked against the scan: the copy
        # lacks pp. 272-273, so image 303 is p. 274 (keyed by page-image index).
        "page_at": {303: 274},
    },
}


def get(url):
    with urllib.request.urlopen(url, timeout=600) as r:
        return r.read()


def paragraphs(block):
    out = []
    for p in re.findall(r"<PARAGRAPH>(.*?)</PARAGRAPH>", block, re.S):
        t = ""
        for line in re.findall(r"<LINE>(.*?)</LINE>", p, re.S):
            ln = " ".join(html.unescape(w) for w in re.findall(r"<WORD[^>]*>(.*?)</WORD>", line, re.S))
            t = t[:-1] + ln if t.endswith("-") and ln[:1].islower() else (t + " " + ln).strip()
        if t:
            out.append(t)
    return out


def main(slug):
    b = BOOKS[slug]
    ident = b["archive"]
    base = f"https://archive.org/download/{ident}/{ident}"
    out = os.path.join(ROOT, "data", "library", slug)
    os.makedirs(os.path.join(out, "maps"), exist_ok=True)
    scan = get(base + "_scandata.xml").decode("utf-8")
    number = {int(l): (re.search(r"<pageNumber>(.*?)</", body) or [None, None])[1]
              for l, body in re.findall(r'<page leafNum="(\d+)">(.*?)</page>', scan, re.S)}
    djvu = get(base + "_djvu.xml").decode("utf-8")
    pages, contents = [], []
    # "maps" are archive.org page-image indexes (the djvu leaf minus one, the colour card being
    # leaf 0); a fold-out is its face and its back, and neither is a page of text.
    foldout = {m[0] + 1 for m in b["maps"]} | {m[0] + 2 for m in b["maps"]}
    leaves = []
    for name, block in re.findall(r'<OBJECT[^>]*?usemap="([^"]+)"[^>]*>(.*?)</OBJECT>', djvu, re.S):
        leaf = int(re.search(r"_(\d+)\.djvu", name).group(1))
        lo, hi = b["contents_leaves"]
        if lo <= leaf <= hi:
            contents += paragraphs(block)
        if leaf not in foldout:
            leaves.append((leaf, paragraphs(block)))
    # Printed page numbers: the scan's own numbering drifts around the fold-outs, so number the
    # pages in order from the first, resyncing to the running head ("258 THE LOST TRIBES…",
    # "…AND TARTARS 261") wherever it and the next page's head agree.
    def head(paras):
        t = paras[0] if paras else ""
        m = re.match(r"^(\d{1,3})\.? [A-Z]", t) or re.match(r"^[A-Z][A-Z ,’'.\-]{5,}? (\d{1,3})(?: |$)", t)
        return int(m.group(1)) if m else None
    first = min(l for l, _ in leaves if number.get(l) == "1")
    body = [(l, ps) for l, ps in leaves if l >= first and number.get(l)]
    heads = [head(ps) for _, ps in body]
    n = 0
    for i, (leaf, ps) in enumerate(body):
        n += 1
        h = heads[i]
        if h and h != n and abs(h - n) <= 4 and ((i + 1 < len(body) and heads[i + 1] == h + 1) or (i + 2 < len(body) and heads[i + 2] == h + 2)):
            n = h
        n = b.get("page_at", {}).get(leaf - 1, n)
        # The running head and a bracketed folio ("[ 257 ]") are the page number, shown apart.
        text = [x for x in ps if not re.fullmatch(r"\[?\s*\d{1,3}\s*\]?", x.strip())]
        # A chapter's opening heading ("CHAPTER XI" and its title) is on the screen already.
        if text and len(text[0]) < 70 and re.match(r"^CH\w{2,4}TER\b", text[0]):
            text = text[1:]
            if text and len(text[0]) < 60 and not text[0].rstrip().endswith((".", ",", ";")):
                text = text[1:]
        if text and len(text[0]) < 70 and (head(text[:1]) or re.match(r"^\d{1,3}\b", text[0]) or re.search(r"\b\d{1,3}$", text[0]) or text[0].isupper()):
            text = text[1:]
        titles = {re.sub(r"\W", "", t.lower()) for _, t, _ in b["chapters"]}
        if text and re.sub(r"\W", "", text[0].lower()) in titles:
            text = text[1:]
        pages.append({"page": n, "leaf": leaf - 1, "text": "\n\n".join(text)})
    # Each chapter's topics, from the table of contents ("CHAPTER X  Title  topic, 204. ...").
    toc = "\n\n".join(contents)
    chapters = []
    for i, (num, title, page) in enumerate(b["chapters"]):
        end = (b["chapters"][i + 1][2] - 1) if i + 1 < len(b["chapters"]) else pages[-1]["page"]
        topics = ""
        if num:
            words = r"\s+".join(map(re.escape, title.split()))
            m = re.search(r"CHAPTER\s+[IVXLT1l]+\s*[~\s]*" + words + r"\s*(.+?)(?=CHAPTER\s+[IVXLT1l]+\s|Bibliography,|$)", toc, re.S | re.I)
            topics = m.group(1) if m else ""
            topics = re.sub(r"\b[a-z]{0,4}\s*CONTENTS\s+[XxIiVvLl1]+\b|\b[XxIiVvLl1]+\s+CONTENTS\b", " ", topics)
            topics = re.sub(r"\s+", " ", topics).strip()
            topics = re.sub(r"(\d[.?])[^0-9]*$", r"\1", topics)  # drop the page-header scraps after the last entry
        chapters.append({"n": num, "title": title, "page": page, "end": end, "topics": topics})
    maps = []
    from PIL import Image
    for leaf, facing, title, caption in b["maps"]:
        img = Image.open(io.BytesIO(get(f"https://archive.org/download/{ident}/page/n{leaf}_w4000.jpg"))).convert("RGB")
        file = f"maps/map-p{facing}.webp"
        img.save(os.path.join(out, file), "WEBP", quality=82)
        maps.append({"title": title, "caption": caption, "facing": facing, "leaf": leaf, "file": file, "width": img.width, "height": img.height})
    doc = {k: b[k] for k in ("title", "subtitle", "author", "year", "publisher", "license")}
    doc.update({"slug": slug, "source": f"https://archive.org/details/{ident}", "archive": ident,
                "scan": f"https://archive.org/download/{ident}/page/n{{leaf}}_w1200.jpg",
                "pages": len(pages), "chapters": chapters, "maps": maps})
    json.dump(doc, open(os.path.join(out, "book.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(pages, open(os.path.join(out, "pages.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"{slug}: {len(pages)} pages, {len(chapters)} chapters ({sum(bool(c['topics']) for c in chapters)} with topics), {len(maps)} maps")


if __name__ == "__main__":
    main(sys.argv[1])
