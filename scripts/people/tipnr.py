#!/usr/bin/env python3
"""People of the Bible, from STEPBible's TIPNR (Translators Individualised Proper Names with
all References, Tyndale House Cambridge, STEPBible.org, CC BY 4.0).

Keeps the facts: each individual's names in their King James forms, parents, siblings,
partners, children, tribe or nation, and every verse they are named in. It leaves out the
file's @Brief/@Short/@Article descriptions, which are machine-written commentary; what the
classes taught is what the app shows about a person.

  python3 scripts/people/tipnr.py "<path to the TIPNR .txt>"   # writes data/people/people.json
  python3 scripts/people/tipnr.py --kjv                         # re-applies the KJV names to it

Names are the King James Version's, never another version's: TIPNR marks how each version
spells a name ("Bezalel =ESV,NIV; Bezaleel =KJV"); the KJV's forms are kept, the others
dropped, and a person is shown by the KJV form the KJV text uses most.

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


def kjv_words():
    """The KJV text's words (data/bible, with the Apocrypha), keyed without case or hyphens, each
    with how the text spells it most ("adonibezek" -> "Adoni-bezek") and how often it appears."""
    seen = {}
    for name in os.listdir(os.path.join(ROOT, "data", "bible")):
        doc = json.load(open(os.path.join(ROOT, "data", "bible", name), encoding="utf-8")) if name.endswith(".json") else None
        if not isinstance(doc, dict) or "chapters" not in doc:
            continue
        for verses in doc["chapters"].values():
            for v in verses:
                for w in re.findall(r"[A-Za-z][A-Za-z'\-–]*[A-Za-z]|[A-Za-z]", v if isinstance(v, str) else v.get("text", "")):
                    w = w.replace("–", "-")  # the text joins names with an en dash: Adoni–bezek
                    forms = seen.setdefault(key(w), {})
                    forms[w] = forms.get(w, 0) + 1
    return {k: (max(f, key=lambda w: (w[:1].isupper(), f[w])), sum(f.values())) for k, f in seen.items()}


def key(word):
    return re.sub(r"[^a-z']", "", word.lower())


def kjv_forms(shown):
    """The King James forms in one of TIPNR's spellings: 'Aeneas =ESV,NIV; Eneas =KJV' -> ['Eneas'];
    'Avims,Avites =KJV' -> both; a plain name is every version's, the KJV's included."""
    named = lambda forms: [f.strip() for f in forms.split(",") if re.search(r"[A-Za-z]", f)]  # "[ ]" is unnamed
    if "=" not in shown:
        return named(shown)
    out = []
    for part in shown.split(";"):
        forms, _, versions = part.partition("=")
        if "KJV" in [v.strip() for v in versions.split(",")]:
            out += named(forms)
    return out


def unnamed_label(person, by_id, kjv=None):
    """Someone the KJV does not name, called as the KJV speaks of them, never by another version's
    name: 'daughter_of_Pharaoh' -> 'Daughter of Pharaoh'; Salome -> 'Daughter of Herodias' (Matthew
    14:6); Pyrrhus -> 'Father of Sopater' (Acts 20:4 names only Sopater of Berea)."""
    raw = person["id_name"]
    if "_of_" in raw:
        words = re.sub(r"([a-z])([A-Z])", r"\1 \2", re.sub(r"\d", "", raw)).replace("_", " ").split()
        label = " ".join(w if w[:1].isupper() and w.lower() not in ("in", "law") else w.lower() for w in words)
        # The relative by their KJV name too: "father_of_Elizabeth" -> "Father of Elisabeth".
        label = " ".join((kjv or {}).get(w, w) for w in label.split())
        return (label[:1].upper() + label[1:]).replace("mother in law", "mother-in-law").replace("Mother in law", "Mother-in-law")
    _, _, aside = person["description"].partition(" - ")
    aside = re.sub(r"^unnamed\s+", "", aside.strip())
    if re.match(r"^(daughter|son|wife|husband|father|mother|sister|brother) of [A-Z]", aside):
        return aside[:1].upper() + aside[1:]
    if raw.startswith("Unnamed"):
        return f"An unnamed {'woman' if person['type'] == 'Female' else 'man'}"
    if "_" in raw:
        return raw.replace("_", " ").capitalize()
    kin = [by_id[c]["name"] for c in person.get("children", []) if c in by_id and not by_id[c]["name"].startswith(("An unnamed", "Unnamed"))]
    if kin:
        return f"{'Mother' if person['type'] == 'Female' else 'Father'} of {kin[0]}"
    return raw


def as_written(form, words):
    """A name as the KJV text writes it (its hyphens, its capital), and how often: 'Nergal-shar-ezer'
    -> ('Nergal-sharezer', 3). A name of several words counts as often as its rarest word."""
    parts = form.split()
    found = [words.get(key(w)) for w in parts]
    if not all(found):
        return form, 0
    if len(parts) == 1:
        text = found[0][0]
        return text[:1].upper() + text[1:], found[0][1]
    return form[:1].upper() + form[1:], min(n for _, n in found)


def kjv_names(person, words, original=None):
    """A person's names as the KJV spells them, the one its text uses most first. Where none of
    the KJV forms is in the text, the record's own name if the text has it, else the first."""
    forms = []
    for shown in person["names"]:
        for f in kjv_forms(shown):
            # As the text writes it; where it only has it as a people's name, that form
            # ("Emim" -> "Emims", "Nympha" -> "Nymphas", "Nehelam" -> "Nehelamite").
            if not as_written(f, words)[1]:
                f = next((g for g in (f + "s", f + "ite", f + "ites") if as_written(g, words)[1]), f)
            f, _ = as_written(f, words)
            if f not in forms:
                forms.append(f)
    if not forms:
        return None, []
    scored = [(f, as_written(f, words)[1]) for f in forms]
    best = max(scored, key=lambda x: (x[1] > 0, x[0] == person["name"], x[1]))[0]
    if as_written(best, words)[1] == 0 and original:
        text, n = as_written(original, words)
        if n:
            best = text
            forms = [text] + forms
    return best, [best] + [f for f in forms if f != best]


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
    apply_kjv(people)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    doc = {
        "source": "TIPNR, Translators Individualised Proper Names with all References, by Tyndale House Cambridge, STEPBible.org",
        "license": "CC BY 4.0", "url": "https://github.com/STEPBible/STEPBible-Data",
        "people": people,
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(people)} people, {sum(len(p['verses']) for p in people)} verse mentions -> {os.path.relpath(OUT, ROOT)}")


def apply_kjv(people):
    """Every person by their KJV name; those the KJV does not name, as it speaks of them."""
    words, by_id, changed = kjv_words(), {p["id"]: p for p in people}, 0
    for p in people:
        p.setdefault("id_name", p["name"])
    unnamed = []
    for p in people:
        name, names = kjv_names(p, words, p["id_name"])
        if name is None:
            unnamed.append(p)
            continue
        changed += name != p["name"] or names != p["names"]
        p["name"], p["names"] = name, names
    kjv = {}
    for p in people:
        if p["names"] and p["id_name"] != p["name"]:
            kjv.setdefault(p["id_name"], p["name"])
    for p in unnamed:
        label = unnamed_label(p, by_id, kjv)
        changed += label != p["name"] or p["names"] != []
        p["name"], p["names"] = label, []
    for p in people:
        del p["id_name"]
    return changed


def relabel():
    """Re-applies the KJV names to data/people/people.json, without the TIPNR file."""
    doc = json.load(open(OUT, encoding="utf-8"))
    for p in doc["people"]:
        p["id_name"] = p.get("id_name") or p["name"]
    changed = apply_kjv(doc["people"])
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"{changed} of {len(doc['people'])} people given their KJV names -> {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    relabel() if sys.argv[1:] == ["--kjv"] else main(sys.argv[1])
