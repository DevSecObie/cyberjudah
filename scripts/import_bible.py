"""Import the KJV with Apocrypha from a CyberJudah-style vault into data/bible/<book>.json.

The vault keeps one markdown note per chapter (Bible/<NN - Book>/<Book N>.md) with each verse on
its own paragraph ending in a ^vN block anchor. This reads those files and writes one JSON file per
book, in the book names the rest of this project uses:

  {"book": "Sirach", "chapters": {"1": ["verse text", ...], ...}}

Name differences between that vault and this project are mapped here; Baruch 6 there is the
Epistle of Jeremiah here, and the Prayer of Manasses is a single block there, so its 14-verse
division comes from scripts/prayer-of-manasseh.json.

usage: python3 scripts/import_bible.py <path to Bible folder>
       e.g. python3 scripts/import_bible.py ../cyberjudah/content/Bible
"""
import json, os, re, sys, glob, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "bible")

# vault name -> project name
NAMES = {"Ecclesiasticus": "Sirach", "Additions to Esther": "Esther (Greek)", "Prayer of Manasses": "Prayer of Manasseh",
         "Prayer of Azariah": "Song of the Three Children"}
ORDER = ["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi",
         "Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation",
         "1 Esdras","2 Esdras","Tobit","Judith","Esther (Greek)","Wisdom of Solomon","Sirach","Baruch","Song of the Three Children","Susanna","Bel and the Dragon","Prayer of Manasseh","1 Maccabees","2 Maccabees","Epistle of Jeremiah"]

def slug(book): return re.sub(r"[^a-z0-9]+", "-", book.lower()).strip("-")

def parse_chapter(path):
    """-> list of verse strings, in order; verses may wrap over several lines."""
    verses, cur = {}, None
    for line in open(path, encoding="utf-8-sig").read().splitlines():
        m = re.match(r"^(\d+) (.*)$", line)
        if m and cur is None:
            cur = [int(m.group(1)), m.group(2)]
        elif cur is not None and line.strip():
            cur[1] += " " + line.strip()
        if cur is not None:
            a = re.search(r"\s*\^v(\d+)\s*$", cur[1])
            if a:
                verses[cur[0]] = re.sub(r"\s+", " ", cur[1][:a.start()]).strip()
                cur = None
    if not verses: return []
    n = max(verses)
    return [verses.get(i, "") for i in range(1, n + 1)]

def main(src):
    books = {}
    for folder in sorted(glob.glob(os.path.join(src, "* - *"))):
        vault_name = os.path.basename(folder).split(" - ", 1)[1]
        for path in glob.glob(os.path.join(folder, "*.md")):
            stem = os.path.splitext(os.path.basename(path))[0]
            m = re.match(rf"^{re.escape(vault_name)} (\d+)$", stem)
            if not m: continue
            ch = int(m.group(1))
            book = NAMES.get(vault_name, vault_name)
            if book == "Baruch" and ch == 6: book, ch = "Epistle of Jeremiah", 1
            books.setdefault(book, {})[ch] = parse_chapter(path)
    # Prayer of Manasseh: the vault has one block; keep the 14-verse division if we have it
    man = os.path.join(HERE, "prayer-of-manasseh.json")
    if os.path.exists(man):
        books["Prayer of Manasseh"] = {int(k): v for k, v in json.load(open(man, encoding="utf-8")).items()}
    shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
    index = []
    for book in ORDER:
        if book not in books: sys.stderr.write(f"missing: {book}\n"); continue
        chs = books[book]
        data = {"book": book, "chapters": {str(k): chs[k] for k in sorted(chs)}}
        with open(os.path.join(OUT, slug(book) + ".json"), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        index.append({"book": book, "slug": slug(book), "chapters": len(chs), "verses": sum(len(v) for v in chs.values())})
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, indent=1)
    sys.stderr.write(f"{len(index)} books, {sum(i['chapters'] for i in index)} chapters, {sum(i['verses'] for i in index)} verses -> {os.path.relpath(OUT)}\n")

if __name__ == "__main__":
    main(sys.argv[1])
