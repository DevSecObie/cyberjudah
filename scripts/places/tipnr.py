#!/usr/bin/env python3
"""Places of the Bible, from STEPBible's TIPNR (Translators Individualised Proper Names with
all References, Tyndale House Cambridge, STEPBible.org, CC BY 4.0).

Keeps the facts, as scripts/people/tipnr.py does for people: each place's names in their King
James forms, its Strong's numbers, the region TIPNR puts it in, where it is on the map when
that is known, and every verse it is named in. It leaves out the file's descriptions
(@Brief/@Short/@Article and the "#A location in ..." line), which are machine-written
commentary.

  python3 scripts/places/tipnr.py "<path to the TIPNR .txt>"   # writes data/places/places.json

The TIPNR file comes from https://github.com/STEPBible/STEPBible-Data (folder "Proper Nouns").
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "people"))
from tipnr import BOOKS, REF, ROOT, as_written, common_words, key, kjv_words, labelled_forms, pid  # noqa: E402

OUT = os.path.join(ROOT, "data", "places", "places.json")
ORDER = list(BOOKS.values())
MAP = re.compile(r"/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),\d+(?:\.\d+)?z")


def coords(url):
    """'https://www.google.com/maps/@31.1858,34.96745,14z' -> [31.1858, 34.96745]; '@0,14z' (unknown) -> None."""
    m = MAP.search(url or "")
    if not m:
        return None
    lat, lng = float(m.group(1)), float(m.group(2))
    return None if lat == 0 and lng == 0 else [lat, lng]


def region(field):
    """TIPNR's region column ('Mesopotamia(?)', 'Judah'); '>' and blanks mean none."""
    field = (field or "").strip()
    return "" if field in ("", ">") else field


def kjv_place_names(place, words):
    """A place's names as the KJV spells them, the one its text uses most first; where none of the
    KJV forms is in the text, the record's own name."""
    forms = []
    for shown in place["shown"]:
        for f, marked in labelled_forms(shown):
            if not marked:
                continue
            f, _ = as_written(f, words)
            if f not in forms:
                forms.append(f)
    # A form with a word the KJV also writes in lower case is an ordinary phrase there ("the river",
    # "The LORD is there"), not the place's name: the Euphrates is "Euphrates", Jerusalem "Jerusalem".
    # A place with no proper KJV form keeps TIPNR's name ("King's Highway").
    proper = lambda f: "/" not in f and all(key(re.sub(r"'s$", "", w)) not in common_words() for w in f.split())
    names = [f for f in forms if proper(f)]
    if not names:
        return place["id_name"], [place["id_name"]]
    best = max(names, key=lambda f: (as_written(f, words)[1] > 0, as_written(f, words)[1]))
    return best, [best] + [f for f in names if f != best]


def main(path):
    lines = open(path, encoding="utf-8-sig").read().split("\n")
    places, cur, section = [], None, None

    def close():
        if cur and cur["verses"]:
            cur["verses"] = [f"{b}/{c}/{v}" for b, c, v in sorted(set(cur["verses"]), key=lambda r: (ORDER.index(r[0]), r[1], r[2]))]
            places.append(cur)

    for raw in lines:
        f = raw.rstrip("\r").split("\t")
        head = f[0].strip()
        m = re.match(r"^\$=+\s*(PERSON|PLACE|OTHER)", head)
        if m:
            close(); cur = None
            section = m.group(1)
            continue
        if section != "PLACE" or not head:
            continue
        if cur is None and "@" in head and "=" in head and not head.startswith("–"):
            unified, _, strong = head.partition("=")
            cur = {
                "id": pid(unified), "id_name": unified.split("@")[0].replace("_", " "), "shown": [],
                "strongs": [s for s in re.split(r"[,+\s]+", strong.strip()) if re.match(r"^[GH]\d+[A-Za-z]?$", s)],
                "region": region(f[6] if len(f) > 6 else ""), "coords": coords(f[4] if len(f) > 4 else ""), "verses": [],
            }
            continue
        if cur is not None and head.startswith("–") and not head.startswith("– Total") and len(f) > 4:
            shown = f[3].strip()
            if shown and shown not in cur["shown"]:
                cur["shown"].append(shown)
            for r in re.split(r";\s*", f[4]):
                rm = REF.match(r.strip())
                if rm and rm.group(1) in BOOKS:
                    cur["verses"].append((BOOKS[rm.group(1)], int(rm.group(2)), int(rm.group(3))))
    close()
    words = kjv_words()
    for p in places:
        p["name"], p["names"] = kjv_place_names(p, words)
        del p["shown"], p["id_name"]
    out = [{k: p[k] for k in ("id", "name", "names", "region", "coords", "strongs", "verses")} for p in places]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    doc = {
        "source": "TIPNR, Translators Individualised Proper Names with all References, by Tyndale House Cambridge, STEPBible.org",
        "license": "CC BY 4.0", "url": "https://github.com/STEPBible/STEPBible-Data",
        "places": out,
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(out)} places, {sum(len(p['verses']) for p in out)} verse mentions, {sum(1 for p in out if p['coords'])} on the map -> {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main(sys.argv[1])
