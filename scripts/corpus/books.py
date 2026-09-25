#!/usr/bin/env python3
"""Count the books brought up in the classes.

    python3 scripts/corpus/books.py                 # writes dist/books.json and dist/books.md

Reads the catalog in data/books.tsv (title, author, kind, the phrases that name each book) and
finds every spoken passage that names one, in a single pass over the built corpus. For each
book: how many recordings bring it up, how often, in which years, and moments to hear it.
To add a book, add a row to the catalog; `--discover` lists phrases such as "a book called ..."
that are not in it yet.
"""

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import evidence  # noqa: E402
import sources  # noqa: E402

CATALOG = sources.ROOT / "data" / "books.tsv"
KINDS = {
    "history": "History and scholarship",
    "reference": "Dictionaries, encyclopedias and concordances",
    "psychology": "Psychology and the family",
    "apocryphal": "Writings outside the 80 books",
    "lost": "Books named in scripture but not preserved",
    "religious": "Scriptures of other religions",
    "class": "Written by the teachers",
}


def catalog(path=CATALOG):
    rows = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        title, author, kind, forms = (line.split("\t") + ["", "", ""])[:4]
        forms = [f.strip() for f in forms.split(";") if f.strip()]
        if not forms:
            raise SystemExit(f"data/books.tsv: {title} has no search forms")
        if kind not in KINDS:
            raise SystemExit(f"data/books.tsv: {title} has unknown kind {kind!r}")
        rows.append({"title": title.strip(), "author": author.strip(), "kind": kind, "forms": forms})
    return rows


def count(corpus, books, moments):
    # Search by the catalog's phrases only: a title such as "The Israelites" is too common to
    # search for by itself.
    packs = evidence.pack_many(corpus, [(b["forms"][0], b["forms"][1:]) for b in books], moments, 0)
    results = []
    for book, pack in zip(books, packs):
        years = {y: n for y, n in pack["by_year"].items() if y != "undated"}
        results.append({
            **{k: book[k] for k in ("title", "author", "kind")},
            "recordings": pack["recordings"],
            "mentions": pack["mentions"],
            "by_feed": pack["by_feed"],
            "first_year": min(years) if years else None,
            "last_year": max(years) if years else None,
            "undated_recordings": pack["by_year"].get("undated", 0),
            "moments": [{k: e[k] for k in ("title", "date", "url", "text")} for e in pack["excerpts"]],
        })
    return sorted(results, key=lambda r: (-r["recordings"], r["title"]))


def markdown(results):
    heard = [r for r in results if r["recordings"]]
    lines = ["# Books brought up in the classes", "",
             f"{len(heard)} books from the catalog in data/books.tsv are named in the recordings "
             "(automatic captions, spoken passages only). Counts are recordings that name the book at least once.", ""]
    for kind, label in KINDS.items():
        rows = [r for r in heard if r["kind"] == kind]
        if not rows:
            continue
        lines += [f"## {label}", "", "| Book | Author | Recordings | Years | Hear it |", "|---|---|---:|---|---|"]
        for r in rows:
            years = f"{r['first_year']}–{r['last_year']}" if r["first_year"] and r["first_year"] != r["last_year"] else (r["first_year"] or "undated")
            link = f"[{r['moments'][0]['title'][:40].strip()}]({r['moments'][0]['url']})" if r["moments"] else ""
            lines.append(f"| {r['title']} | {r['author']} | {r['recordings']} | {years} | {link} |")
        lines.append("")
    lines += ["Books named in scripture are counted wherever the verse that names them is read, as well as",
              "where they are discussed.", ""]
    silent = [r["title"] for r in results if not r["recordings"]]
    if silent:
        lines += ["## In the catalog but not found in the captions", "", ", ".join(silent), ""]
    return "\n".join(lines)


DISCOVER = re.compile(r"\bbooks? (?:called|entitled|titled|named) (?:the book )?((?:[\w'-]+ ?){2,8})", re.I)


def discover(corpus, books, top):
    known = [f for b in books for f in b["forms"]]
    seen = Counter()
    for doc, passage in evidence.spoken_passages(corpus):
        for m in DISCOVER.finditer(passage["text_normalized"]):
            phrase = " ".join(m.group(1).lower().split()[:6])
            if not any(k in phrase for k in known):
                seen[phrase] += 1
    for phrase, n in seen.most_common(top):
        print(f"{n}\t{phrase}")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--corpus", type=Path, default=sources.ROOT / "dist" / "corpus")
    parser.add_argument("--out", type=Path, default=sources.ROOT / "dist")
    parser.add_argument("--moments", type=int, default=5, help="moments kept per book")
    parser.add_argument("--discover", type=int, metavar="N", help="list the N most frequent uncatalogued 'book called ...' phrases")
    args = parser.parse_args(argv)
    books = catalog()
    if args.discover:
        discover(args.corpus, books, args.discover)
        return
    results = count(args.corpus, books, args.moments)
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "books.json").write_text(json.dumps(results, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (args.out / "books.md").write_text(markdown(results), encoding="utf-8")
    heard = sum(1 for r in results if r["recordings"])
    print(f"{heard} of {len(results)} catalogued books are named in the recordings -> {args.out / 'books.md'}")


if __name__ == "__main__":
    main()
