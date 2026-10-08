#!/usr/bin/env python3
"""Strong's numbers for the King James text, and Strong's dictionaries, into data/strongs/:

  data/strongs/tags/<book slug>.json   {"<chapter>": {"<verse>": [[text, ["H7225"]], ...]}}
  data/strongs/hebrew.json, greek.json  {"H1": {"lemma", "xlit", "pron", "derivation", "def", "kjv"}}

  python3 scripts/strongs/build.py <kjv-with-strongs dir> <openscriptures/strongs dir>

The tagged text is James Strong's own work (1890): every English word of the King James
Version keyed to the Hebrew or Greek word behind it, as in his Exhaustive Concordance
(public domain). It comes here from a JSON transcription of it, one file per book, each
verse as "In the beginning[H7225] God[H430] created[H1254][H853]…" with the translators'
italics as <em>. The dictionaries are Strong's concise Hebrew and Greek dictionaries
(1894), Open Scriptures' JSON transcription (CC BY-SA).

Every verse is checked against data/bible: the same books, chapters and verse counts, and
the same words once tags and italics are set aside.
"""
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "data", "strongs")

CODES = {
    "Gen": "genesis", "Exo": "exodus", "Lev": "leviticus", "Num": "numbers", "Deu": "deuteronomy", "Jos": "joshua", "Jdg": "judges", "Rth": "ruth",
    "1Sa": "1-samuel", "2Sa": "2-samuel", "1Ki": "1-kings", "2Ki": "2-kings", "1Ch": "1-chronicles", "2Ch": "2-chronicles", "Ezr": "ezra", "Neh": "nehemiah",
    "Est": "esther", "Job": "job", "Psa": "psalms", "Pro": "proverbs", "Ecc": "ecclesiastes", "Sng": "song-of-solomon", "Isa": "isaiah", "Jer": "jeremiah",
    "Lam": "lamentations", "Eze": "ezekiel", "Dan": "daniel", "Hos": "hosea", "Joe": "joel", "Amo": "amos", "Oba": "obadiah", "Jon": "jonah", "Mic": "micah",
    "Nah": "nahum", "Hab": "habakkuk", "Zep": "zephaniah", "Hag": "haggai", "Zec": "zechariah", "Mal": "malachi",
    "Mat": "matthew", "Mar": "mark", "Luk": "luke", "Jhn": "john", "Act": "acts", "Rom": "romans", "1Co": "1-corinthians", "2Co": "2-corinthians",
    "Gal": "galatians", "Eph": "ephesians", "Phl": "philippians", "Col": "colossians", "1Th": "1-thessalonians", "2Th": "2-thessalonians",
    "1Ti": "1-timothy", "2Ti": "2-timothy", "Tit": "titus", "Phm": "philemon", "Heb": "hebrews", "Jas": "james", "1Pe": "1-peter", "2Pe": "2-peter",
    "1Jo": "1-john", "2Jo": "2-john", "3Jo": "3-john", "Jde": "jude", "Rev": "revelation",
}
VERSE = r'"{code}\|(\d+)\|(\d+)":\s*\{{\s*"en":\s*"((?:[^"\\]|\\.)*)"'  # the transcription mixes books into one file
TAG = re.compile(r"\[([HG]\d+)\]")


def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def tagged_words(en):
    """'God[H430] created[H1254][H853] the heaven[H8064]' -> [['god', []], ['created', ['H1254','H853']], ['the', []], ['heaven', ['H8064']]]:
    each word with the tags written after it."""
    s = re.sub(r"</?em>", "", json.loads(f'"{en}"'))
    out = []
    for part in re.split(r"(\[[HG]\d+\])", s):
        if TAG.fullmatch(part):
            if out:
                out[-1][1].append(part[1:-1])
        else:
            out += [[w, []] for w in norm(part).split()]
    return out


def spans(en, kjv):
    """The King James verse as spans of its own words, each with the Strong's numbers of the
    tagged word that ends it: [['In the beginning', ['H7225']], ['God', ['H430']], ...]. The
    transcription loses the tail of some verses, so the words come from data/bible and the
    tags are laid on them by alignment; words the transcription lacks stay untagged."""
    import difflib
    tw = tagged_words(en)
    kw = re.findall(r"\S+", kjv)
    kn = [norm(w) for w in kw]
    tags_at = {}
    sm = difflib.SequenceMatcher(None, [w for w, _ in tw], kn, autojunk=False)
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal" or (op == "replace" and i2 - i1 == j2 - j1):
            for k in range(i2 - i1):
                if tw[i1 + k][1]:
                    tags_at[j1 + k] = tw[i1 + k][1]
    out, buf = [], []
    for j, w in enumerate(kw):
        buf.append(w)
        if j in tags_at:
            out.append([" ".join(buf), tags_at[j]]); buf = []
    if buf:
        out.append([" ".join(buf), []])
    return out, len(tags_at), sum(1 for _, t in tw if t)


def main(kjv_dir, strongs_dir):
    os.makedirs(os.path.join(OUT, "tags"), exist_ok=True)
    total, mismatch, lost = 0, [], [0, 0]
    for code, slug in CODES.items():
        raw = open(os.path.join(kjv_dir, f"{code}.json"), encoding="utf-8").read()
        bible = json.load(open(os.path.join(ROOT, "data", "bible", f"{slug}.json"), encoding="utf-8"))["chapters"]
        book = {}
        for ch, v, en in re.findall(VERSE.format(code=re.escape(code)), raw):
            if ch not in bible or int(v) > len(bible[ch]):
                mismatch.append((slug, ch, v, "not in data/bible")); continue
            sp, placed, given = spans(en, bible[ch][int(v) - 1])
            book.setdefault(ch, {})[v] = sp
            total += 1
            lost[0] += given - placed; lost[1] += given
        want = sum(len(c) for c in bible.values())
        got = sum(len(c) for c in book.values())
        if got != want:
            print(f"  {slug}: {got} of {want} verses tagged")
        json.dump(book, open(os.path.join(OUT, "tags", f"{slug}.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"{total} verses tagged; {lost[1] - lost[0]} of {lost[1]} tags placed ({lost[0]} on words the transcription mis-spells or lacks); {len(mismatch)} verses missing")
    for m in mismatch[:12]:
        print("   ", m)
    for lang, fname in (("hebrew", "hebrew/strongs-hebrew-dictionary.js"), ("greek", "greek/strongs-greek-dictionary.js")):
        js = open(os.path.join(strongs_dir, fname), encoding="utf-8").read()
        body = js[js.index("{"):js.rindex("}") + 1]
        d = json.loads(body)
        out = {k: {"lemma": e.get("lemma", ""), "xlit": e.get("xlit", ""), "pron": e.get("pron", ""), "derivation": e.get("derivation", ""), "def": e.get("strongs_def", ""), "kjv": e.get("kjv_def", "")} for k, e in d.items()}
        json.dump(out, open(os.path.join(OUT, f"{lang}.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        print(f"{lang}: {len(out)} entries")
    json.dump({
        "text": "The King James Version with Strong's numbers, James Strong's Exhaustive Concordance (1890), public domain; JSON transcription from github.com/kaiserlik/kjv.",
        "dictionaries": "Strong's Concise Dictionaries of the Words in the Hebrew Bible and the Greek Testament (1894); JSON by Open Scriptures (github.com/openscriptures/strongs), CC BY-SA.",
    }, open(os.path.join(OUT, "sources.json"), "w", encoding="utf-8"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
