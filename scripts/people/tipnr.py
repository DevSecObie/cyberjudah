#!/usr/bin/env python3
"""People of the Bible, from STEPBible's TIPNR (Translators Individualised Proper Names with
all References, Tyndale House Cambridge, STEPBible.org, CC BY 4.0).

Keeps the facts: each individual's names (with the King James forms), parents, siblings,
partners, children, tribe or nation, and every verse they are named in. It leaves out the
file's @Brief/@Short/@Article descriptions, which are machine-written commentary; what the
classes taught is what the app shows about a person.

  python3 scripts/people/tipnr.py "<path to the TIPNR .txt>"   # writes data/people/people.json

The TIPNR file comes from https://github.com/STEPBible/STEPBible-Data (folder "Proper Nouns").
"""
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "data", "people", "people.json")

BOOKS = {
    "Gen": "genesis", "Exo": "exodus", "Lev": "leviticus", "Num": "numbers", "Deu": "deuteronomy", "Jos": "joshua", "Jdg": "judges",
    "Rut": "ruth", "1Sa": "1-samuel", "2Sa": "2-samuel", "1Ki": "1-kings", "2Ki": "2-kings", "1Ch": "1-chronicles", "2Ch": "2-chronicles",
    "Ezr": "ezra", "Neh": "nehemiah", "Est": "esther", "Job": "job", "Psa": "psalms", "Pro": "proverbs", "Ecc": "ecclesiastes",
    "Sng": "song-of-solomon", "Isa": "isaiah", "Jer": "jeremiah", "Lam": "lamentations", "Ezk": "ezekiel", "Dan": "daniel", "Hos": "hosea",
    "Jol": "joel", "Amo": "amos", "Oba": "obadiah", "Jon": "jonah", "Mic": "micah", "Nam": "nahum", "Hab": "habakkuk", "Zep": "zephaniah",
    "Hag": "haggai", "Zec": "zechariah", "Mal": "malachi", "Mat": "matthew", "Mrk": "mark", "Luk": "luke", "Jhn": "john", "Act": "acts",
    "Rom": "romans", "1Co": "1-corinthians", "2Co": "2-corinthians", "Gal": "galatians", "Eph": "ephesians", "Php": "philippians",
    "Col": "colossians", "1Th": "1-thessalonians", "2Th": "2-thessalonians", "1Ti": "1-timothy", "2Ti": "2-timothy", "Tit": "titus",
    "Phm": "philemon", "Heb": "hebrews", "Jas": "james", "1Pe": "1-peter", "2Pe": "2-peter", "1Jn": "1-john", "2Jn": "2-john",
    "3Jn": "3-john", "Jud": "jude", "Rev": "revelation",
}
REF = re.compile(r"^(?:LXX\s*)?([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)[a-z]?$")


def pid(unified):
    """'Abraham@Gen.11.26-1Pe' -> 'abraham-gen-11-26' (unique, stable, readable)."""
    name, _, where = unified.partition("@")
    first = where.split("-")[0]
    return re.sub(r"[^a-z0-9]+", "-", f"{name} {first}".lower()).strip("-")


def people_list(field):
    return [pid(x.strip()) for x in re.split(r",\s*", field or "") if "@" in x]


def main(path):
    lines = open(path, encoding="utf-8-sig").read().split("\n")
    section, people, cur = None, [], None

    def close():
        if cur and cur["verses"]:
            cur["verses"] = sorted(set(cur["verses"]), key=lambda r: (list(BOOKS.values()).index(r[0]), r[1], r[2]))
            people.append(cur)

    for raw in lines:
        f = raw.rstrip("\r").split("\t")
        head = f[0].strip()
        m = re.match(r"^\$=+\s*(PERSON|PLACE|OTHER)", head)
        if m:
            close(); cur = None
            section = m.group(1)
            continue
        if section != "PERSON" or not head:
            continue
        if cur is None and "@" in head and "=" in head and not head.startswith("–"):
            unified = head.split("=")[0]
            parents = (f[2] if len(f) > 2 else "").split("+")
            cur = {
                "id": pid(unified), "name": unified.split("@")[0], "names": [], "description": f[1].strip() if len(f) > 1 else "",
                "father": people_list(parents[0])[:1], "mother": people_list(parents[1] if len(parents) > 1 else "")[:1],
                "siblings": people_list(f[3] if len(f) > 3 else ""), "partners": people_list(f[4] if len(f) > 4 else ""),
                "children": people_list(f[5] if len(f) > 5 else ""), "tribe": (f[6].strip() if len(f) > 6 else ""),
                "type": (f[8].strip() if len(f) > 8 else ""), "verses": [],
            }
            continue
        if cur is not None and head.startswith("–") and not head.startswith("– Total") and len(f) > 4:
            shown = f[3].strip()
            if shown and shown not in cur["names"]:
                cur["names"].append(shown)
            for r in re.split(r";\s*", f[4]):
                rm = REF.match(r.strip())
                if rm and rm.group(1) in BOOKS:
                    cur["verses"].append((BOOKS[rm.group(1)], int(rm.group(2)), int(rm.group(3))))
    close()
    for p in people:
        p["verses"] = [f"{b}/{c}/{v}" for b, c, v in p["verses"]]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    doc = {
        "source": "TIPNR, Translators Individualised Proper Names with all References, by Tyndale House Cambridge, STEPBible.org",
        "license": "CC BY 4.0", "url": "https://github.com/STEPBible/STEPBible-Data",
        "people": people,
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(people)} people, {sum(len(p['verses']) for p in people)} verse mentions -> {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main(sys.argv[1])
