"""Parse the precept index (a topical list: topic heading, then one scripture reference per line)
into src/data/precepts.json.
usage: extract-text precept.docx > precept.md && python3 scripts/parse_precepts.py precept.md > src/data/precepts.json
Bold references (**Book c:v**) are kept as `key: true`.
"""
import re, sys, json

BOOKS = {
 "Genesis":"Genesis","Exodus":"Exodus","Leviticus":"Leviticus","Numbers":"Numbers","Deuteronomy":"Deuteronomy","Joshua":"Joshua","Judges":"Judges","Ruth":"Ruth",
 "1Samuel":"1 Samuel","2Samuel":"2 Samuel","1Kings":"1 Kings","2Kings":"2 Kings","1Chronicles":"1 Chronicles","2Chronicles":"2 Chronicles","Ezra":"Ezra","Nehemiah":"Nehemiah",
 "Esther":"Esther","Job":"Job","Psalms":"Psalms","Psalm":"Psalms","Proverbs":"Proverbs","Ecclesiastes":"Ecclesiastes","Songs of Solomon":"Song of Solomon","Song of Solomon":"Song of Solomon",
 "Isaiah":"Isaiah","Jeremiah":"Jeremiah","Lamentations":"Lamentations","Ezekiel":"Ezekiel","Daniel":"Daniel","Hosea":"Hosea","Joel":"Joel","Amos":"Amos","Obadiah":"Obadiah",
 "Jonah":"Jonah","Micah":"Micah","Nahum":"Nahum","Habakkuk":"Habakkuk","Zephaniah":"Zephaniah","Haggai":"Haggai","Zechariah":"Zechariah","Malachi":"Malachi",
 "Matthew":"Matthew","Mark":"Mark","Luke":"Luke","John":"John","Acts":"Acts","Romans":"Romans","1Corinthians":"1 Corinthians","2Corinthians":"2 Corinthians",
 "Galatians":"Galatians","Ephesians":"Ephesians","Philippians":"Philippians","Colossians":"Colossians","1Thessalonians":"1 Thessalonians","2Thessalonians":"2 Thessalonians",
 "1Timothy":"1 Timothy","2Timothy":"2 Timothy","Titus":"Titus","Philemon":"Philemon","Hebrews":"Hebrews","James":"James","1Peter":"1 Peter","2Peter":"2 Peter",
 "1John":"1 John","2John":"2 John","3John":"3 John","Jude":"Jude","Revelations":"Revelation","Revelation":"Revelation",
 # Apocrypha (KJV 1611 names)
 "Ecclesiasticus (Sirach)":"Sirach","Ecclesiasticus":"Sirach","Sirach":"Sirach","Wisdom of Solomon":"Wisdom of Solomon","Wisdom":"Wisdom of Solomon","Tobit":"Tobit","Judith":"Judith",
 "Baruch":"Baruch","1Maccabees":"1 Maccabees","2Maccabees":"2 Maccabees","1Esdras":"1 Esdras","2Esdras":"2 Esdras","Susanna":"Susanna","Bel and the Dragon":"Bel and the Dragon",
 "Prayer of Manasseh":"Prayer of Manasseh","Esther (Greek)":"Esther (Greek)","Epistle of Jeremiah":"Epistle of Jeremiah","Song of the Three":"Song of the Three Children","Prayer of Azariah":"Song of the Three Children",
}
REF = re.compile(r"^\**\s*(.+?)\s+(\d+):\s*(\d+(?:\s*-\s*\d+)?)?\s*\**\s*$")

lines = [l.strip() for l in open(sys.argv[1], encoding="utf-8") if l.strip()]
topics, cur, unknown = [], None, set()
for l in lines:
    m = REF.match(l)
    if m and m.group(1).strip() in BOOKS:
        if cur is None: continue
        cur["refs"].append({"book": BOOKS[m.group(1).strip()], "chapter": int(m.group(2)), "verses": (m.group(3) or "").replace(" ", ""), "key": l.startswith("**")})
    elif m and re.match(r"^[A-Z0-9]", m.group(1)) and m.group(1).strip() not in BOOKS and cur is not None:
        unknown.add(m.group(1).strip()); 
    else:
        title = l.strip("*").strip()
        cur = {"title": title, "slug": re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-"), "refs": []}
        topics.append(cur)

# drop accidental empty topics that are really bold refs we couldn't parse
topics = [t for t in topics if t["refs"]]
# merge duplicate titles
seen = {}
for t in topics:
    if t["slug"] in seen: seen[t["slug"]]["refs"].extend(t["refs"])
    else: seen[t["slug"]] = t
topics = list(seen.values())
json.dump({"title": "Precepts", "topics": topics}, sys.stdout, separators=(",", ":"))
sys.stderr.write(f"topics={len(topics)} refs={sum(len(t['refs']) for t in topics)} key={sum(r['key'] for t in topics for r in t['refs'])} unknown={sorted(unknown)}\n")
