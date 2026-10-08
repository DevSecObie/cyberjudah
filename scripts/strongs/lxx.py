#!/usr/bin/env python3
"""The Greek of the Apocrypha, verse by verse, from Swete's Septuagint (1909) into data/lxx/:

  data/lxx/<book slug>.json   {"<chapter>": {"<verse>": "Greek text"}}
  data/lxx/sources.json

  python3 scripts/strongs/lxx.py <path to the LXX-Swete-1930 checkout>

Swete's text is public domain (Cambridge, 1909-1930; scans on archive.org). The checkout is
eliranwong/LXX-Swete-1930: 00-Swete_versification.csv (word index where each verse begins)
and 01-Swete_word_with_punctuations.csv (every word). Only the books the King James
Apocrypha carries and Swete numbers the same way are written; Greek Esther's additions and
the Prayer of Manasses are numbered differently and are left out.
"""
import csv, json, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "data", "lxx")
BOOKS = {"Tob": "tobit", "Jdt": "judith", "Wis": "wisdom-of-solomon", "Sir": "sirach", "Bar": "baruch", "Epj": "epistle-of-jeremiah",
         "Sus": "susanna", "Bel": "bel-and-the-dragon", "1Ma": "1-maccabees", "2Ma": "2-maccabees", "1Es": "1-esdras"}


def main(src):
    starts = []
    for row in csv.reader(open(os.path.join(src, "00-Swete_versification.csv"), encoding="utf-8"), delimiter="\t"):
        starts.append((int(row[0]), row[1]))
    starts.sort()
    words = {}
    for row in csv.reader(open(os.path.join(src, "01-Swete_word_with_punctuations.csv"), encoding="utf-8"), delimiter="\t"):
        words[int(row[0])] = row[1]
    last = max(words)
    out = {slug: {} for slug in BOOKS.values()}
    for i, (start, ref) in enumerate(starts):
        code, cv = ref.split(".")
        if code not in BOOKS: continue
        end = starts[i + 1][0] if i + 1 < len(starts) else last + 1
        text = " ".join(words[k] for k in range(start, end) if k in words)
        ch, v = cv.split(":")
        out[BOOKS[code]].setdefault(ch, {})[v] = text
    os.makedirs(OUT, exist_ok=True)
    for slug, chs in out.items():
        kjv = json.load(open(os.path.join(ROOT, "data", "bible", f"{slug}.json")))["chapters"]
        same = sum(1 for c, vs in chs.items() if c in kjv and len(vs) == len(kjv[c]))
        json.dump(chs, open(os.path.join(OUT, f"{slug}.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        print(f"{slug}: {len(chs)} chapters, {sum(len(v) for v in chs.values())} verses; {same}/{len(chs)} chapters numbered as the King James")
    json.dump({"text": "The Old Testament in Greek according to the Septuagint, edited by Henry Barclay Swete (Cambridge, 1909-1930), public domain; digital text from github.com/eliranwong/LXX-Swete-1930."},
              open(os.path.join(OUT, "sources.json"), "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1])
