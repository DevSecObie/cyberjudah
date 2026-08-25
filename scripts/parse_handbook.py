"""Parse 'A Handbook of Bible Law' (pdftotext -layout output) into structured JSON.
usage: pdftotext -layout A_Handbook_of_Bible_Law.pdf handbook.txt && python3 parse_handbook.py handbook.txt > src/data/handbook.json
"""
import re, sys, json

raw = open(sys.argv[1], encoding="utf-8").read()
raw = raw.replace("\t\n \xa0", " ").replace("\xa0", " ").replace("\u00ad\u2010", "").replace("\u00ad", "").replace("\u2010", "-").replace("\f", "\n").replace("\ufffd", "'")
raw = re.sub(r"\b(Cor|Thes|Tim|Pet|Sam|Kings|Chron)[,\-]\s", r"\1. ", raw)
lines = [re.sub(r"\s+", " ", l).strip() for l in raw.split("\n")]

BOOKS = {  # abbreviation variants -> canonical
 "Gen":"Genesis","Exod":"Exodus","Lev":"Leviticus","Num":"Numbers","Deut":"Deuteronomy","Josh":"Joshua","Judges":"Judges","Judg":"Judges","Ruth":"Ruth",
 "1 Sam":"1 Samuel","2 Sam":"2 Samuel","1 Kings":"1 Kings","2 Kings":"2 Kings","1 Chron":"1 Chronicles","2 Chron":"2 Chronicles","Ezra":"Ezra","Neh":"Nehemiah","Esth":"Esther",
 "Job":"Job","Psa":"Psalms","Prov":"Proverbs","Eccl":"Ecclesiastes","Song":"Song of Solomon","Isa":"Isaiah","Jer":"Jeremiah","Lam":"Lamentations","Ezek":"Ezekiel","Dan":"Daniel",
 "Hos":"Hosea","Hosea":"Hosea","Joel":"Joel","Amos":"Amos","Obad":"Obadiah","Jonah":"Jonah","Mic":"Micah","Nah":"Nahum","Hab":"Habakkuk","Zeph":"Zephaniah","Hag":"Haggai","Zech":"Zechariah","Mal":"Malachi",
 "Matt":"Matthew","Mark":"Mark","Luke":"Luke","John":"John","Acts":"Acts","Rom":"Romans","1 Cor":"1 Corinthians","2 Cor":"2 Corinthians","Cor":"1 Corinthians","Gal":"Galatians","Eph":"Ephesians",
 "Phil":"Philippians","Philip":"Philippians","Col":"Colossians","CoL":"Colossians","1 Thes":"1 Thessalonians","2 Thes":"2 Thessalonians","Thes":"1 Thessalonians","1 Tim":"1 Timothy","2 Tim":"2 Timothy","Titus":"Titus","Philem":"Philemon",
 "Heb":"Hebrews","James":"James","Ja":"James","1 Pet":"1 Peter","2 Pet":"2 Peter","1 John":"1 John","2 John":"2 John","3 John":"3 John","Jude":"Jude","Rev":"Revelation",
}
ORDER = ["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi","Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation"]

abbr_alt = "|".join(sorted((re.escape(k) for k in BOOKS), key=len, reverse=True))
REF = re.compile(rf"(?<![A-Za-z])({abbr_alt})\.?\s*(\d+)(?:\s*[:;]\s*(\d+(?:\s*-\s*\d+)?(?:\s*,\s*\d+(?:\s*-\s*\d+)?)*))?")
SUB = re.compile(r"^(\d{1,2})\s*([A-Z])\s*[-–]\s*(.+)$")
ENTRY = re.compile(r"^(\d{1,2})\.\s*(?:\d{1,2}\.\s*)?(.*)$")
SEEALSO = re.compile(r"^\(See also (.+)\)$")

parts, cur_part, cur_sub, cur_entry, pending_header = [], None, None, None, []

def flush_entry():
    global cur_entry
    if cur_entry is not None and cur_sub is not None:
        cur_entry["raw"] = " ".join(cur_entry["lines"]); del cur_entry["lines"]
        cur_sub["entries"].append(cur_entry)
    cur_entry = None

def looks_like_ref_tail(s):
    stripped = REF.sub("", s)
    return re.fullmatch(r"[\s;,.:()\-\d]*(etc\.)?[\s;,.:()\-\d]*", stripped) is not None

def is_heading_line(line):
    return len(line) < 45 and (not line.endswith(".") or line.endswith("etc.")) and not REF.search(line) and not re.search(r"\d", line)

for line in lines:
    if not line: continue
    m = SUB.match(line)
    if m:
        num, letter, title = m.groups()
        # trailing heading lines may have been glued onto the last entry; pull them off
        if cur_entry is not None:
            while len(cur_entry["lines"]) > 1 and is_heading_line(cur_entry["lines"][-1]):
                pending_header.insert(0, cur_entry["lines"].pop())
        flush_entry()
        if cur_part is None or cur_part["n"] != int(num):
            cur_part = {"n": int(num), "title": " ".join(pending_header).strip() or f"Part {num}", "sections": []}
            parts.append(cur_part)
        pending_header = []
        cur_sub = {"id": f"{num}{letter}", "title": title.strip().rstrip("."), "seeAlso": [], "entries": []}
        cur_part["sections"].append(cur_sub)
        continue
    m = SEEALSO.match(line)
    if m and cur_sub and not cur_sub["entries"]:
        cur_sub["seeAlso"] = [x.strip() for x in re.split(r"[,;]", m.group(1))]
        continue
    m = ENTRY.match(line)
    if m and cur_sub is not None and re.match(r"^[A-Za-z(']", m.group(2)) and not REF.match(m.group(2)):
        expected = (cur_entry["n"] if cur_entry else (cur_sub["entries"][-1]["n"] if cur_sub["entries"] else 0)) + 1
        if int(m.group(1)) in (expected, expected + 1):
            flush_entry()
            cur_entry = {"n": int(m.group(1)), "lines": [m.group(2)]}
            continue
    if cur_entry is not None:
        prev = cur_entry["lines"][-1]
        if prev.endswith(".") and re.match(r"^[A-Z][a-z]", line) and not REF.match(line) and not is_heading_line(line) and looks_like_ref_tail(prev[-40:]) and REF.search(prev):
            flush_entry()
            cur_entry = {"n": cur_sub["entries"][-1]["n"] + 1, "lines": [line]}
        else:
            cur_entry["lines"].append(line)
        continue
    if cur_sub is None:
        pending_header.append(line)
flush_entry()

def split_entry(raw):
    raw = re.sub(r"\s+", " ", raw).strip()
    matches = list(REF.finditer(raw))
    cut = None
    for mm in matches:
        if looks_like_ref_tail(raw[mm.start():]):
            cut = mm.start(); break
    text = raw[:cut].strip() if cut is not None else raw
    reftext = raw[cut:].strip() if cut is not None else ""
    refs = []
    for mm in REF.finditer(reftext):
        book = BOOKS[mm.group(1)]
        chapter = int(mm.group(2)); verses = (mm.group(3) or "").replace(" ", "")
        refs.append({"book": book, "chapter": chapter, "verses": verses})
    return text, reftext, refs

total = 0
for p in parts:
    for s in p["sections"]:
        for e in s["entries"]:
            text, reftext, refs = split_entry(e.pop("raw"))
            e["text"] = text; e["refs"] = refs; e["citation"] = reftext
            total += 1

import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from repair_refs import repair
repaired = repair(parts)
json.dump({"title": "A Handbook of Bible Law", "bookOrder": ORDER, "parts": parts}, sys.stdout, indent=1)
sys.stderr.write(f"repaired citations: {repaired}\n")
sys.stderr.write(f"parts={len(parts)} sections={sum(len(p['sections']) for p in parts)} entries={total}\n")
