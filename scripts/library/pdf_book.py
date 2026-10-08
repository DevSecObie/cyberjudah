#!/usr/bin/env python3
"""A document we hold as a PDF (not on archive.org) into data/library/<slug>/, in the same
shape archive_book.py writes, so the app's Library, its search and Ask all read it:

  python3 scripts/library/pdf_book.py <slug>            # one configured document
  python3 scripts/library/pdf_book.py --list

Each document is described in DOCS: the PDF, its title, and its sections (heading text that
opens a section on its page). The script writes

  book.json        the document, its sections as chapters, its pictures
  pages.json       [{vol, page, img, words, text}], paragraphs separated by a blank line
  figures/page-N.webp      every page as it was printed (the reader's "Original page")
  figures/fig-N.webp       the largest picture on each page that has one
  figures/original.pdf     the PDF itself, published beside the pictures

Needs PyMuPDF and Pillow (pip install pymupdf pillow).
"""
import io
import json
import os
import re
import shutil
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA_ORIGIN = "https://data.cyberjudah.io"

DOCS = {
    "12-tribes-breakdown": {
        "pdf": "12_Tribes_Breakdown.pdf",
        "title": "The 12 Tribes Breakdown",
        "subtitle": "The tribes of Israel today: their names, their lands, and the scriptures that show them",
        "author": "", "year": 2014, "publisher": "",
        "license": "Shared with the assembly for study.",
        # The headings that open each tribe's section, as printed (spellings kept).
        "sections": ["Judah", "Zebulon", "Reuben", "Napthali", "Levi & Simeon", "Issachar", "Gad",
                     "Ephraim & Manessah", "Dan", "Benjamin", "Ashur"],
    },
}

PAGE_WIDTH = 1200       # the printed page, as the reader shows it
MIN_PICTURE = 180       # smaller images are rules, bullets and logos


def webp(img, path, width=None):
    from PIL import Image
    if width and img.width > width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    img.convert("RGB").save(path, "WEBP", quality=78, method=6)
    return img.size


def text_of(page):
    """The page's words as paragraphs. The PDF sets each printed line apart, so lines that
    follow one another closely, in the same column, are one paragraph; a wider gap, a new
    column or a heading starts the next."""
    lines = []
    for b in page.get_text("dict", sort=True)["blocks"]:
        for ln in b.get("lines", []):
            t = re.sub(r"\s+", " ", "".join(s["text"] for s in ln["spans"])).strip()
            if t:
                size = max(s["size"] for s in ln["spans"])
                lines.append((ln["bbox"], t, size))
    paras, cur, prev = [], [], None
    for (x0, y0, x1, y1), t, size in lines:
        if prev:
            (px0, py0, px1, py1), psize = prev
            gap, height = y0 - py1, py1 - py0
            same_col = abs(x0 - px0) < 40 or (x0 < px1 and px0 < x1)
            if not (0 <= gap < max(4, 0.6 * height) and same_col and abs(size - psize) < 2):
                paras.append(" ".join(cur)); cur = []
        cur.append(t)
        prev = ((x0, y0, x1, y1), size)
    if cur:
        paras.append(" ".join(cur))
    return "\n\n".join(re.sub(r"(\w)- (\w)", r"\1-\2", x) for x in paras if x)


def heading_of(page):
    """The large heading that opens a section on this page, if any."""
    for b in page.get_text("dict")["blocks"]:
        for line in b.get("lines", []):
            for s in line["spans"]:
                if s["size"] >= 16 and s["text"].strip():
                    return s["text"].strip()
    return None


def build(slug, pdf_path):
    import pymupdf
    from PIL import Image
    cfg = DOCS[slug]
    out = os.path.join(ROOT, "data", "library", slug)
    figs = os.path.join(out, "figures")
    os.makedirs(figs, exist_ok=True)
    doc = pymupdf.open(pdf_path)

    pages, figures, starts = [], [], []
    for i, page in enumerate(doc):
        n = i + 1
        text = text_of(page)
        pages.append({"vol": 1, "page": n, "img": n, "words": len(text.split()), "text": text})
        h = heading_of(page)
        if h:
            name = next((s for s in cfg["sections"] if h == s or h.startswith(s + " ") or h.startswith(s + "(")), None)
            if name:
                starts.append((name, n, h))
        # The printed page.
        pix = page.get_pixmap(dpi=150)
        webp(Image.open(io.BytesIO(pix.tobytes("png"))), os.path.join(figs, f"page-{n}.webp"), PAGE_WIDTH)
        # The largest picture on it.
        best = None
        for x in page.get_images(full=True):
            try:
                info = doc.extract_image(x[0])
            except Exception:
                continue
            w, hgt = info["width"], info["height"]
            if min(w, hgt) < MIN_PICTURE:
                continue
            if not best or w * hgt > best[0]:
                best = (w * hgt, info)
        if best:
            img = Image.open(io.BytesIO(best[1]["image"]))
            file = f"figures/fig-{n}.webp"
            w, hgt = webp(img, os.path.join(out, file), 1600)
            figures.append({"kind": "figure", "title": "", "caption": "", "vol": 1, "page": n, "img": n, "file": file, "width": w, "height": hgt})

    missing = [s for s in cfg["sections"] if s not in [x[0] for x in starts]]
    if missing:
        sys.exit(f"{slug}: no heading found for {', '.join(missing)}")
    if starts[0][1] != 1:
        starts.insert(0, ("", 1, cfg["title"]))
    chapters = []
    for k, (name, first, printed) in enumerate(starts):
        end = starts[k + 1][1] - 1 if k + 1 < len(starts) else len(pages)
        chapters.append({"n": "", "title": printed, "vol": 1, "volume": "", "page": first, "end": end, "topics": ""})
    for f in figures:
        f["title"] = next(c["title"] for c in chapters if c["page"] <= f["page"] <= c["end"])

    shutil.copyfile(pdf_path, os.path.join(figs, "original.pdf"))
    cover = figures[0]["file"] if figures and figures[0]["page"] == 1 else "figures/page-1.webp"
    book = {
        "title": cfg["title"], "subtitle": cfg["subtitle"], "author": cfg["author"], "year": cfg["year"],
        "publisher": cfg["publisher"], "license": cfg["license"], "slug": slug,
        "source": f"{DATA_ORIGIN}/api/library/{slug}/figures/original.pdf",
        "items": [{"id": slug, "label": ""}],
        "scan": f"{DATA_ORIGIN}/api/library/{slug}/figures/page-{{img}}.webp",
        "cover": cover, "pages": len(pages), "volumes": 1, "chapters": chapters, "figures": figures,
    }
    with open(os.path.join(out, "book.json"), "w", encoding="utf-8") as f:
        json.dump(book, f, ensure_ascii=False, indent=1)
    with open(os.path.join(out, "pages.json"), "w", encoding="utf-8") as f:
        json.dump(pages, f, ensure_ascii=False, indent=0)
    print(f"{slug}: {len(pages)} pages, {len(chapters)} sections, {len(figures)} pictures")
    for c in chapters:
        print(f"  pp. {c['page']}-{c['end']}  {c['title']}")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0] == "--list":
        for s, c in DOCS.items():
            print(f"{s}\t{c['title']}\t{c['pdf']}")
        sys.exit(0)
    slug = args[0]
    if slug not in DOCS:
        sys.exit(f"unknown document {slug}; see --list")
    pdf = args[1] if len(args) > 1 else os.path.join(ROOT, ".cache", "library", DOCS[slug]["pdf"])
    build(slug, pdf)
