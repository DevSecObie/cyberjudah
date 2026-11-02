#!/usr/bin/env python3
"""Every book the classes bring up, for the library's "Class books" shelf.

    python3 scripts/corpus/build.py && python3 scripts/corpus/books.py --moments 8
    python3 scripts/library/class_books.py          # writes data/library/class-books.json

For each book in data/books.tsv (except the lost books and the teachers' own), it writes
where the book can be read in full and the moments the classes spoke about it:

  library        we hold it page by page (data/library/<slug>/), open it there
  public-domain  a free archive.org scan: shown in full inside the app
  borrow         still in copyright: archive.org lends it (Read the full book), and we show
                 only the classes' own words about it, never the book's text
  none           no copy found yet; the classes' words only

The sources come from data/library-sources.tsv; the moments from dist/books.json.
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "corpus"))
import books as catalog_books  # noqa: E402

SOURCES = ROOT / "data" / "library-sources.tsv"
LIBRARY = ROOT / "data" / "library"
OUT = LIBRARY / "class-books.json"
SKIP_KINDS = {"lost", "class"}
ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$")
YOUTUBE = re.compile(r"[?&]v=([A-Za-z0-9_-]{11})(?:&t=(\d+)s?)?")
# The classes' names for the books we already hold page by page (data/library/<slug>).
HELD = {
    "The Two Babylons": "two-babylons",
    "The Works of Flavius Josephus": "josephus",
    "Antiquities of the Jews": "josephus",
    "The Jewish Encyclopedia": "jewish-encyclopedia",
    "Smith's Bible Dictionary": "smiths-dictionary-of-the-bible",
    "The History of the American Indians": "history-of-the-american-indians",
    "Hebrewisms of West Africa": "hebrewisms-of-west-africa",
    "The Lost Tribes a Myth": "lost-tribes-a-myth",
    "Light and Truth": "light-and-truth",
    "Foxe's Book of Martyrs": "foxes-book-of-martyrs",
    "The Rise of Christendom": "rise-of-christendom",
    "The Dragon, Image, and Demon": "dragon-image-and-demon",
    "The International Standard Bible Encyclopaedia": "international-standard-bible-encyclopaedia",
    "Religious Instruction of the Negroes": "religious-instruction-of-the-negroes",
}


def sources(path=SOURCES):
    out = {}
    for n, line in enumerate(Path(path).read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip() or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) != 4:
            raise SystemExit(f"{path.name}:{n}: expected title, author, status and identifier")
        title, author, status, ident = (p.strip() for p in parts)
        if status not in ("public-domain", "borrow"):
            raise SystemExit(f"{path.name}:{n}: unknown status {status!r}")
        if not ID.match(ident):
            raise SystemExit(f"{path.name}:{n}: not an archive.org identifier: {ident!r}")
        out[(title, author)] = (status, ident)
    return out


def moment(m):
    hit = YOUTUBE.search(m.get("url") or "")
    if not hit:
        return None
    text = re.sub(r"\s+", " ", m.get("text") or "").strip()
    if len(text) > 420:
        text = text[:420].rsplit(" ", 1)[0] + " …"
    return {"video": hit.group(1), "t": int(hit.group(2) or 0), "title": m.get("title") or "", "date": m.get("date"), "said": text}


def build(heard_path, held_dirs=LIBRARY):
    heard = {(b["title"], b["author"]): b for b in json.loads(Path(heard_path).read_text(encoding="utf-8"))}
    where = sources()
    held = {slug for slug in HELD.values() if (Path(held_dirs) / slug / "book.json").exists()}
    known = {(b["title"], b["author"]) for b in catalog_books.catalog()}
    stale = [k for k in where if k not in known]
    if stale:
        raise SystemExit(f"{SOURCES.name}: not in data/books.tsv: {stale}")
    rows = []
    for b in catalog_books.catalog():
        if b["kind"] in SKIP_KINDS:
            continue
        key = (b["title"], b["author"])
        h = heard.get(key, {})
        row = {"title": b["title"], "author": b["author"], "kind": b["kind"], "shelf": catalog_books.KINDS[b["kind"]],
               "recordings": h.get("recordings", 0), "first_year": h.get("first_year"), "last_year": h.get("last_year")}
        slug = HELD.get(b["title"])
        if slug in held:
            row.update(status="library", slug=slug)
        elif key in where:
            status, ident = where[key]
            row.update(status=status, archive=ident)
        else:
            row["status"] = "none"
        row["moments"] = [m for m in (moment(x) for x in h.get("moments", [])) if m]
        rows.append(row)
    rows.sort(key=lambda r: (-r["recordings"], r["title"]))
    return rows


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--books", type=Path, default=ROOT / "dist" / "books.json", help="scripts/corpus/books.py's output")
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args(argv)
    rows = build(args.books)
    args.out.write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    counts = {s: sum(r["status"] == s for r in rows) for s in ("library", "public-domain", "borrow", "none")}
    print(f"{len(rows)} class books -> {args.out.relative_to(ROOT)}: {counts}")


if __name__ == "__main__":
    main()
