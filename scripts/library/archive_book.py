#!/usr/bin/env python3
"""Public-domain books the classes read from, from archive.org into data/library/<slug>/:
the text page by printed page, the chapters, the pictures (fold-out maps, plates, pages
with figures) and a cover, so the app can show the book beside the classes that read it.

  python3 scripts/library/archive_book.py <slug> [<slug> ...]     # one or more books
  python3 scripts/library/archive_book.py --all                   # every book in BOOKS
  python3 scripts/library/archive_book.py --list                  # what is configured

Each book is described in BOOKS: its archive.org items (one per volume), the classes' name
for it (`mention`, used by reads.py), and overrides where the scan needs them. For each
item the script downloads the OCR layout (_djvu.xml) and scan data, numbers the pages from
the printed running heads (the scans' own numbering drifts around fold-outs and skipped
leaves), finds the chapters from the printed headings (or blocks of a dictionary), finds
the pictures, and writes:

  book.json     the book, its chapters and its pictures
  pages.json    [{vol, page, img, words, text}], paragraphs separated by a blank line
                (pages-v<N>.json, one per volume, for a work of several volumes)
  figures/*.webp   the pictures; the page scans themselves come from archive.org on demand

reads.py then finds the moments the classes read from it (reads.json).
"""
import collections
import html
import io
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.environ.get("LIBRARY_CACHE") or os.path.join(ROOT, ".cache", "library")

_R = "I II III IV V VI VII VIII IX X XI XII XIII XIV XV XVI XVII XVIII XIX XX".split()

BOOKS = {
    "lost-tribes-a-myth": {
        "title": "The Lost Tribes a Myth", "subtitle": "Suggestions Towards Rewriting Hebrew History",
        "author": "Allen H. Godbey", "year": 1930, "publisher": "Duke University Press, Durham, North Carolina",
        "license": "Public domain in the United States (published 1930).",
        "items": ["losttribesmythsu00godb"], "mention": r"godb|gadby|god be|lost tribes,? a myth|the red map",
        "chapters": [
            ("I", "The Lost Tribes Theory", 1), ("II", "Many Deportations from Palestine", 8),
            ("III", "Traditions of Palestinian Origin", 15), ("IV", "Hebrews Are Not Israelites", 33),
            ("V", "The Great Schism", 72), ("VI", "Status of Deported Israelites", 118),
            ("VII", "Ethnologists and Jews", 144), ("VIII", "Asmonean Propagandism", 160),
            ("IX", "Yemen Jews and Falashas", 174), ("X", "Berber, Moorish, and Negro Jews", 204),
            ("XI", "Khazars, Scythians, and Tartars", 257), ("XII", "Black Jews of India", 317),
            ("XIII", "Persian, Turkoman, Mongol, and Chinese Jews", 368), ("XIV", "Samaritans, Sadducees, and Karaites", 426),
            ("XV", "Missionaries Who Failed", 451), ("XVI", "Proselytes in the Old Testament", 472),
            ("XVII", "Shrine Levites", 485), ("XVIII", "The City of Refuge", 514),
            ("XIX", "Captivity, Adoption, and Slavery", 531), ("XX", "Badges", 552),
            ("XXI", "The Provenance of Yahwism", 561), ("XXII", "Survivals of Sacrifice", 584),
            ("XXIII", "Exilic Propagandism", 606), ("XXIV", "Ancient Jewish Translations of Their Scriptures", 621),
            ("XXV", "The Babylonian Academies", 651), ("XXVI", "No Lost Tribes in the Prophets", 665),
            ("XXVII", "Post-Exilic References", 674), ("XXVIII", "Rewriting Hebrew History", 686),
            ("", "Bibliography", 711), ("", "Index of Scripture Passages", 757), ("", "Topical Index", 769),
        ],
        "contents_images": (19, 30),
        "figures": [(286, "foldout", "Yemen Jews and Falashas; Berber, Moorish and Negro Jews", "From Palestine across Africa", 256),
                    (346, "foldout", "From Asia Minor to Persia", "From Palestine to Asia Minor, the Caucasus, and Babylonia", 316),
                    (398, "foldout", "From Palestine to India and China", "From Palestine to India and China", 366)],
        "page_at": {303: 274},
    },
    "josephus": {
        "title": "The Works of Flavius Josephus", "subtitle": "The Antiquities of the Jews, the Wars of the Jews, Against Apion and the Life, translated by William Whiston",
        "author": "Flavius Josephus", "year": 1905, "publisher": "S. S. Scranton Company, Hartford (Whiston's translation, 1737)",
        "license": "Public domain.", "items": ["completeworksoff05jose"], "mention": r"josephus|whiston",
        "chapters": [("", "The Life of Flavius Josephus", 7, "The Life of Flavius Josephus"), ("", "Preface to the Antiquities", 37, "The Antiquities of the Jews")]
                    + [(_R[k], "", pg, "The Antiquities of the Jews") for k, pg in enumerate([40, 65, 94, 120, 148, 177, 211, 245, 281, 305, 327, 351, 382, 414, 451, 485, 514, 543, 573, 599])]
                    + [("", "Preface to the Wars", 619, "The Wars of the Jews")]
                    + [(_R[k], "", pg, "The Wars of the Jews") for k, pg in enumerate([622, 682, 729, 758, 795, 830, 857])]
                    + [("I", "", 882, "Flavius Josephus Against Apion"), ("II", "", 904, "Flavius Josephus Against Apion"),
                       ("", "Josephus's Discourse to the Greeks Concerning Hades", 927, "Discourse and Dissertations"), ("", "Dissertation I", 938, "Discourse and Dissertations"),
                       ("", "Dissertation II", 942, "Discourse and Dissertations"), ("", "Dissertation III", 950, "Discourse and Dissertations"),
                       ("", "Tables and Index", 964, "Discourse and Dissertations")],
    },
    "two-babylons": {
        "title": "The Two Babylons", "subtitle": "Or the Papal Worship Proved to be the Worship of Nimrod and His Wife",
        "author": "Alexander Hislop", "year": 1871, "publisher": "S. W. Partridge and Co., London (third edition)",
        "license": "Public domain.", "items": ["cu31924029406448"], "mention": r"two babylons|hislop",
    },
    "history-of-the-american-indians": {
        "title": "The History of the American Indians", "subtitle": "Particularly Those Nations Adjoining to the Mississippi, East and West Florida, Georgia, South and North Carolina, and Virginia",
        "author": "James Adair", "year": 1775, "publisher": "Edward and Charles Dilly, London",
        "license": "Public domain.", "items": ["historyofamerica00adairich"], "mention": r"\badair\b|american indians",
        "long_s": True, "heading": r"ARGUMENT", "heading_anywhere": True,
        "chapters_extra": [("", "Observations on the Origin and Descent of the Indians", 10), ("", "An Account of the Katahba Nation", 225), ("", "An Account of the Cheerake Nation", 227),
                           ("", "An Account of the Muskohge Nation", 257), ("", "An Account of the Choktah Nation", 283), ("", "An Account of the Chikkasah Nation", 353),
                           ("", "General Observations on the North American Indians", 373), ("", "Appendix: Advice to Statesmen", 448)],
    },
    "smiths-dictionary-of-the-bible": {
        "title": "Smith's Dictionary of the Bible", "subtitle": "Comprising Its Antiquities, Biography, Geography and Natural History, in four volumes (Hackett and Abbot's American edition)",
        "author": "William Smith", "year": 1889, "publisher": "Houghton, Mifflin and Company, Boston (first published 1870)",
        "license": "Public domain.", "items": ["1889dictionaryofb01smituoft", "1889dictionaryofb02smituoft", "1889dictionaryofb03smituoft", "1889dictionaryofb04smituoft"],
        "mention": r"smith'?s (bible )?dictionary|dictionary of the bible|william smith", "dictionary": True,
    },
    "international-standard-bible-encyclopaedia": {
        "title": "The International Standard Bible Encyclopaedia", "subtitle": "In five volumes, James Orr, general editor (1915)",
        "author": "James Orr (general editor)", "year": 1915, "publisher": "The Howard-Severance Company, Chicago",
        "license": "Public domain.", "items": ["theinternational01unknuoft", "bibleencyclopedi02orruoft", "internationalsta0003john", "internationalsta0004unse_n9k4", "bibleencyclopedi05orruoft"],
        "mention": r"international standard bible encyclop|\bisbe\b|james orr", "dictionary": True, "not_figures": [(1, 705)],
    },
    "rise-of-christendom": {
        "title": "The Rise of Christendom", "subtitle": "",
        "author": "Edwin Johnson", "year": 1890, "publisher": "Kegan Paul, Trench, Trübner and Co., London",
        "license": "Public domain.", "items": ["riseofchristendo00john"], "mention": r"rise of christendom|edwin johnson",
    },
    "light-and-truth": {
        "title": "Light and Truth", "subtitle": "Collected from the Bible and Ancient and Modern History, Containing the Universal History of the Colored and the Indian Race",
        "author": "R. B. Lewis", "year": 1844, "publisher": "Published by a committee of colored gentlemen, Boston",
        "license": "Public domain.", "items": ["lightandtruthcoll00lewirich"], "mention": r"light and truth|\bb\.? lewis\b|benjamin lewis",
    },
    "dragon-image-and-demon": {
        "title": "The Dragon, Image, and Demon", "subtitle": "Or, the Three Religions of China: Confucianism, Buddhism, and Taoism",
        "author": "Hampden C. DuBose", "year": 1886, "publisher": "S. W. Partridge and Co., London",
        "license": "Public domain.", "items": ["thedragonimage00dubouoft"], "mention": r"dragon,? image,? and demon|dubose|du bose",
    },
    "critical-review-1784": {
        "title": "The Critical Review, or Annals of Literature", "subtitle": "By a Society of Gentlemen, volume the fifty-seventh (January to June 1784)",
        "author": "A Society of Gentlemen", "year": 1784, "publisher": "Printed for A. Hamilton, London",
        "license": "Public domain.",
        "items": [("sim_critical-review-or-annals-of-literature_1784-01_57", "January 1784"), ("sim_critical-review-or-annals-of-literature_1784-02_57", "February 1784"),
                  ("sim_critical-review-or-annals-of-literature_1784-03_57", "March 1784"), ("sim_critical-review-or-annals-of-literature_1784-04_57", "April 1784"),
                  ("sim_critical-review-or-annals-of-literature_1784-05_57", "May 1784"), ("sim_critical-review-or-annals-of-literature_1784-06_57", "June 1784")],
        "mention": r"critical review|annals of literature", "long_s": True, "chapters": "items",
    },
    "jewish-encyclopedia": {
        "title": "The Jewish Encyclopedia", "subtitle": "A Descriptive Record of the History, Religion, Literature, and Customs of the Jewish People, in twelve volumes",
        "author": "Isidore Singer, editor", "year": 1906, "publisher": "Funk and Wagnalls Company, New York (1901 to 1906)",
        "license": "Public domain.",
        "items": ["cu31924091768188", "cu31924091768196", "jewishencycloped0003isid", "cu31924091768212", "cu31924091768220", "cu31924091768238",
                  "cu31924091768246", "cu31924091768253", "cu31924091768261", "cu31924091768279", "jewishencycloped0011isid", "cu31924091768295"],
        "mention": r"jewish encyclop", "dictionary": True,
    },
    "foxes-book-of-martyrs": {
        "title": "Foxe's Book of Martyrs", "subtitle": "A Complete and Authentic Account of the Lives, Sufferings and Triumphant Deaths of the Primitive and Protestant Martyrs",
        "author": "John Foxe", "year": 1856, "publisher": "Knight and Son, London",
        "license": "Public domain.", "items": ["foxesbookofmarty00fo"], "mention": r"fox'?e?'?s book of martyrs|book of martyrs|john fox",
    },
    "hebrewisms-of-west-africa": {
        "title": "Hebrewisms of West Africa", "subtitle": "From Nile to Niger with the Jews",
        "author": "Joseph J. Williams", "year": 1930, "publisher": "Lincoln MacVeagh, The Dial Press, New York",
        "license": "Public domain in the United States (published 1930).", "items": ["hebrewismsofwest00will"], "mention": r"hebrewisms",
    },
    "religious-instruction-of-the-negroes": {
        "title": "The Religious Instruction of the Negroes in the United States", "subtitle": "",
        "author": "Charles Colcock Jones", "year": 1842, "publisher": "Thomas Purse, Savannah",
        "license": "Public domain.", "items": ["religiousinstruc00jone"], "mention": r"religious instruction of the negroes|colcock jones",
    },
}

FIGURE_TYPES = {"Foldout": "foldout", "Plate": "plate", "Illustration": "plate", "Illustrations": "plate", "Map": "foldout", "Frontispiece": "plate", "Chart": "plate"}
HEADING = re.compile(r"^\s*(CH\w{2,5}TER|CHAP\.?|B[O0]{2}[KR]|PART|SECTION|SECT\.?|LETTER|ARTICLE|DISSERTATION)\s+(?:THE\s+)?([IVXLCivxlc1lyj|]{1,8}|\d{1,3})\b\.?[\s:—\-]*(.*)$", re.I)
ROMAN = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}


def roman(s):
    if s.isdigit():
        return int(s)
    s = s.upper().replace("1", "I").replace("L", "I").replace("|", "I").replace("Y", "V").replace("J", "I")
    if not re.fullmatch(r"[IVXLC]+", s):
        return None
    t, prev = 0, 0
    for ch in reversed(s):
        v = ROMAN.get(ch, 0)
        t, prev = (t - v if v < prev else t + v), max(prev, v)
    return t


def to_roman(n):
    out = ""
    for v, r in ((100, "C"), (90, "XC"), (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")):
        while n >= v:
            out += r; n -= v
    return out


def caps_topics(vol_pages, chapters, book_title):
    """Each chapter's section headings: the short all-capitals lines in its pages, less the running heads."""
    bt = re.sub(r"\W", "", book_title.lower())
    ok = lambda t: 6 <= len(t) <= 60 and t.isupper() and re.search(r"[A-Z]{3}", t) and not HEADING.match(t) and not re.search(r"\d|CONTENTS", t) and re.sub(r"\W", "", t.lower()) not in bt
    lines = collections.Counter(t for p in vol_pages for t in p["paras"][:6] if ok(t))
    for k, c in enumerate(chapters):
        end = chapters[k + 1]["img"] if k + 1 < len(chapters) else 10 ** 9
        seen, out = set(), []
        for p in vol_pages:
            if not (c["img"] <= p["img"] < end):
                continue
            for t in p["paras"][:6]:
                if lines.get(t, 0) in (1, 2) and t not in seen and re.sub(r"\W", "", t.lower()) != re.sub(r"\W", "", c["title"].lower()):
                    seen.add(t); out.append(t.strip(" .,;:").title())
        c["topics"] = ". ".join(out[:40]) + ("." if out else "")


def fetch(url, binary=False):
    key = re.sub(r"[^\w.-]+", "_", url.split("/download/")[-1])
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, key)
    if not os.path.exists(path):
        import time
        for attempt in range(6):
            try:
                with urllib.request.urlopen(url, timeout=900) as r, open(path + ".part", "wb") as f:
                    while True:
                        chunk = r.read(1 << 20)
                        if not chunk:
                            break
                        f.write(chunk)
                os.rename(path + ".part", path)
                break
            except Exception as e:  # archive.org answers 5xx now and then; wait and try again
                if attempt == 5:
                    raise
                print(f"    {url.split('/download/')[-1]}: {e}; retrying", flush=True)
                time.sleep(5 * 2 ** attempt)
    data = open(path, "rb").read()
    return data if binary else data.decode("utf-8", "replace")


_VOCAB = None


def vocab():
    """The words the classes and the King James text use, for repairing the long s of old printings."""
    global _VOCAB
    if _VOCAB is None:
        cache = os.path.join(CACHE, "vocab.json")
        if os.path.exists(cache):
            _VOCAB = set(json.load(open(cache, encoding="utf-8")))
        else:
            import glob
            _VOCAB = set()
            for f in glob.glob(os.path.join(ROOT, "blog", "transcripts", "*.json")):
                for seg in json.load(open(f, encoding="utf-8")).get("segments") or []:
                    _VOCAB.update(re.findall(r"[a-z]+", seg[1].lower()))
            for f in glob.glob(os.path.join(ROOT, "data", "bible", "*.json")):
                if not f.endswith("index.json"):
                    for ch in json.load(open(f, encoding="utf-8"))["chapters"].values():
                        _VOCAB.update(re.findall(r"[a-z]+", " ".join(ch).lower()))
            os.makedirs(CACHE, exist_ok=True)
            json.dump(sorted(_VOCAB), open(cache, "w", encoding="utf-8"))
    return _VOCAB


def repair_long_s(text):
    """'thofe' -> 'those': an old printing's long s, read by the OCR as f, put back wherever the
    f-spelling is no word the classes or the King James use and the s-spelling is."""
    import itertools
    v = vocab()

    def fix(m):
        w = m.group(0)
        lw = w.lower()
        if lw in v or "f" not in lw[:-1]:
            return w
        spots = [i for i, ch in enumerate(lw[:-1]) if ch == "f"][:4]
        for k in range(1, len(spots) + 1):
            for combo in itertools.combinations(spots, k):
                c = "".join("s" if i in combo else ch for i, ch in enumerate(lw))
                if c in v:
                    return (c[0].upper() + c[1:]) if w[0].isupper() else c
        return w
    return re.sub(r"[A-Za-z]+", fix, text)


def paragraphs(block):
    out = []
    for p in re.findall(r"<PARAGRAPH>(.*?)</PARAGRAPH>", block, re.S):
        t = ""
        for line in re.findall(r"<LINE>(.*?)</LINE>", p, re.S):
            ln = " ".join(html.unescape(w) for w in re.findall(r"<WORD[^>]*>(.*?)</WORD>", line, re.S))
            t = t[:-1] + ln if t.endswith("-") and ln[:1].islower() else (t + " " + ln).strip()
        t = re.sub(r"\s+", " ", t).strip()
        if t:
            out.append(t)
    return out


def head_number(paras):
    """The printed page number in a running head: '258 THE LOST TRIBES', 'AND TARTARS 261', '[ 257 ]'."""
    for t in paras[:2]:
        t = t.strip()
        if len(t) > 90:
            break
        m = re.fullmatch(r"\[?\s*(\d{1,4})\s*\]?", t) or re.match(r"^(\d{1,4})\b\.?\s+\S", t) or re.search(r"\S\s+(\d{1,4})\.?$", t)
        if m and (t.isupper() or not re.search(r"[a-z]{3,}", t) or re.fullmatch(r"\[?\s*\d{1,4}\s*\]?", t) or re.match(r"^\d{1,4}\s+[A-Z]", t) or re.search(r"[A-Z]{3,}\s+\d{1,4}\.?$", t)):
            n = int(m.group(1))
            if 0 < n < 5000:
                return n
    return None


def load_item(ident):
    """Every page image of an archive.org item: its index (page/n<img>), scan type, the scan's page number, and its OCR paragraphs."""
    base = f"https://archive.org/download/{ident}/{ident}"
    meta = json.loads(fetch(f"https://archive.org/metadata/{ident}"))
    files = {f["name"] for f in meta.get("files", [])}
    djvu = fetch(base + "_djvu.xml")
    objects = re.findall(r"<OBJECT[^>]*>(.*?)</OBJECT>", djvu, re.S)
    leaves = []
    if f"{ident}_scandata.xml" in files:
        scan = fetch(base + "_scandata.xml")
        for l, body in re.findall(r'<page leafNum="(\d+)">(.*?)</page>', scan, re.S):
            if re.search(r"<addToAccessFormats>false</", body):
                continue
            t = re.search(r"<pageType>(.*?)</pageType>", body)
            n = re.search(r"<pageNumber>(.*?)</pageNumber>", body)
            leaves.append({"type": t.group(1) if t else "Normal", "scan_no": int(n.group(1)) if n and n.group(1).isdigit() else None})
    pages = []
    for i, block in enumerate(objects):
        ps = paragraphs(block)
        lf = leaves[i] if i < len(leaves) else {"type": "Normal", "scan_no": None}
        pages.append({"img": i, "type": lf["type"], "scan_no": lf["scan_no"], "paras": ps, "words": sum(len(p.split()) for p in ps)})
    return pages


def number_pages(pages, page_at, skip=()):
    """Printed page numbers from the running heads. A head counts only when another head near
    it agrees with it (the OCR misreads some); the pages between two heads are then numbered
    in order, and where the scan has more leaves than the print has numbers (a plate, the back
    of a fold-out) the leaves with the least text go unnumbered. The scan's own numbering is
    used only where no heads can be read."""
    def consistent(cands, span=6, agree=2):
        keep = {}
        for i, h in cands.items():
            if sum(1 for j, hj in cands.items() if j != i and abs(j - i) <= span and (h - hj) == (i - j)) >= agree:
                keep[i] = h
        return keep
    heads = consistent({p["img"]: h for p in pages if p["img"] not in skip and (h := head_number(p["paras"]))})
    scans = consistent({p["img"]: p["scan_no"] for p in pages if p["scan_no"] and p["img"] not in skip})
    for i, n in scans.items():
        if not any(abs(j - i) <= 6 for j in heads):
            heads[i] = n
    for i, n in (page_at or {}).items():
        heads[i] = n
    if not heads:
        return {}, 0
    # Anchors run forward; one that goes back, or leaps further than the leaves allow, is a misread.
    anchors, prev = [], None
    for i in sorted(heads):
        if prev is None or (heads[i] > heads[prev] and heads[i] - heads[prev] <= (i - prev) + 8) or i in (page_at or {}):
            anchors.append(i); prev = i
    heads = {i: heads[i] for i in anchors}
    words = {p["img"]: p["words"] for p in pages}
    nums = dict(heads)
    for a, b in zip(anchors, anchors[1:]):
        between = [i for i in range(a + 1, b) if i not in skip]
        need = heads[b] - heads[a] - 1
        if need < len(between):
            spare = sorted(between, key=lambda i: words.get(i, 0))[:len(between) - max(need, 0)]
            between = [i for i in between if i not in spare]
        for k, i in enumerate(between):
            nums[i] = heads[a] + 1 + k
    first_img, first_no = anchors[0], heads[anchors[0]]
    for i in range(first_img - 1, -1, -1):
        if first_no - (first_img - i) < 1:
            break
        nums[i] = first_no - (first_img - i)
    last_img, last_no = anchors[-1], heads[anchors[-1]]
    n = last_no
    for i in range(last_img + 1, min(len(pages), last_img + 5)):
        if i not in skip:
            n += 1
            nums[i] = n
    first = next((i for i in sorted(nums) if nums[i] == 1), min(nums))
    return {i: n for i, n in nums.items() if i >= first and n > 0}, first


def figure_pages(pages, nums, first, manual):
    """Pictures: fold-outs and plates the scan marks, unnumbered sparse pages between full ones (a plate with its caption), and pages with a figure caption."""
    figs = {}
    words = {p["img"]: p["words"] for p in pages}
    for p in pages:
        i = p["img"]
        kind = FIGURE_TYPES.get(p["type"])
        if not kind and i > first:
            around = [words.get(i - 1, 0), words.get(i + 1, 0), words.get(i - 2, 0), words.get(i + 2, 0)]
            real = [w for w in re.findall(r"[A-Za-z]+", " ".join(p["paras"])) if len(w) >= 4 and re.search(r"[a-z]{3}", w)]
            if 0 < p["words"] <= 30 and len(real) >= 2 and max(around) >= 120 and i in nums:
                kind = "plate"
            elif any(re.match(r"^\s*(Fig\.|FIG\.|Figure|PLATE|Plate)\s*[\dIVX]", t) for t in p["paras"]):
                kind = "figure"
        if kind:
            cap = next((t for t in p["paras"] if re.match(r"^\s*(Fig\.|FIG\.|Figure|PLATE|Plate)\s*[\dIVX]", t)), "") if kind == "figure" else ""
            cap = cap or next((t for t in p["paras"] if 8 <= len(t) <= 140 and re.search(r"[a-z]", t)), "")
            figs[i] = {"img": i, "kind": kind, "title": re.sub(r"\s+", " ", cap)[:100], "caption": re.sub(r"\s+", " ", cap), "page": nums.get(i)}
    for img, kind, title, caption, facing in manual or []:
        figs[img] = {"img": img, "kind": kind, "title": title, "caption": caption, "page": facing}
    order = {"foldout": 0, "plate": 1, "figure": 2}
    return sorted(figs.values(), key=lambda f: (order[f["kind"]], f["img"]))[:150]


def clean_text(paras, chapter_titles):
    """The page's text without its running head, folio and chapter heading."""
    text = [x for x in paras if not re.fullmatch(r"\[?\s*\d{1,4}\s*\]?", x.strip())]
    if text and len(text[0]) < 70 and re.match(r"^\s*(CH\w{2,5}TER|CHAP\.|BOOK|PART|SECT)\b", text[0]):
        text = text[1:]
        if text and len(text[0]) < 60 and not text[0].rstrip().endswith((".", ",", ";")):
            text = text[1:]
    if text and len(text[0]) < 90 and (head_number(text[:1]) or text[0].isupper()):
        text = text[1:]
    if text and re.sub(r"\W", "", text[0].lower()) in chapter_titles:
        text = text[1:]
    return "\n\n".join(text)


def auto_chapters(vol_pages, heading_word, anywhere=False):
    """Chapters from the printed headings ('CHAPTER XI' then its title), the first heading on a page counting."""
    out = []
    for p in vol_pages:
        if sum(1 for t in p["paras"] if HEADING.match(t)) >= 3:
            continue  # a contents page
        for k, t in enumerate(p["paras"] if anywhere else p["paras"][:4]):
            if len(t) > 120:
                continue
            m = HEADING.match(t)
            if not m or (heading_word and not re.match(heading_word, m.group(1), re.I)):
                continue
            if anywhere and not re.fullmatch(r"\s*" + heading_word + r"\.?\s+[IVXLCYl1]+[.\s]*", t):
                continue  # a running head ("Book II. Chap. I.]") is not an opener
            n = roman(m.group(2))
            title = m.group(3).strip(" .:-—")
            if len(title) < 3:
                nxt = [x for x in p["paras"][k + 1:k + 3] if len(x) < 90 and not re.fullmatch(r"\[?\s*\d{1,4}\s*\]?", x.strip())]
                title = nxt[0].strip(" .:-—") if nxt else ""
            title = re.split(r"\s+(?:SECTION|SECT\.|PART)\s+[IVX\d]", title)[0].strip(" .:-—")
            if title.isupper():
                title = re.sub(r"\b(Of|The|And|Or|In|To|A|An|For|On|At|By|With)\b", lambda w: w.group(1).lower(), title.title())
                title = title[0].upper() + title[1:]
            out.append({"ord": n, "title": title[:90], "page": p["page"], "img": p["img"], "word": m.group(1)})
            break
    # Headings run forward (gaps allowed, the OCR misses some); one that goes back is a misprint
    # or a stray mention and is dropped, unless it starts a new sequence a good way on.
    kept = []
    for c in out:
        prev = kept[-1]["ord"] if kept else 0
        if c["ord"] is None:
            c["ord"] = prev + 1
        if c["ord"] > prev or (c["ord"] == 1 and kept and c["page"] - kept[-1]["page"] > 12):
            kept.append(c)
    for c in kept:
        c["n"] = to_roman(c["ord"]) if c["word"].upper().startswith(("CH", "BOOK", "PART", "SECT", "DISS")) else str(c["ord"])
        c["title"] = c["title"] or f"{c['word'].title().rstrip('.')} {c['n']}"
    return kept


def dictionary_chapters(vol_pages, block=40, title=""):
    """A dictionary in blocks of pages, each named by its first and last entry words."""
    stop = set(re.findall(r"[a-z]+", title.lower())) | {"the", "and", "of", "vol"}

    def first_word(p):
        # A dictionary's running head (the entry the page is on) is a short first paragraph of
        # its own: "Acts", "Amos". Take that when it is there; otherwise the first word in capitals.
        head = (p["paras"][0].strip() if p["paras"] else "")
        if head and len(head) <= 28 and re.fullmatch(r"[A-Za-z][A-Za-z'’\- ]*", head) and head.lower() not in stop and not head.isupper():
            return head[0].upper() + head[1:]
        for t in p["paras"][:2]:
            w = [x for x in re.findall(r"\b[A-Z][A-Z'’\-]{2,}\b", t) if x.lower() not in stop]
            if w:
                return w[0].title()
        return None
    out = []
    for s in range(0, len(vol_pages), block):
        chunk = vol_pages[s:s + block]
        a = next((first_word(p) for p in chunk if first_word(p)), None)
        b = next((first_word(p) for p in reversed(chunk) if first_word(p)), None)
        out.append({"n": "", "title": f"{a} – {b}" if a and b else f"Pages {chunk[0]['page']}–{chunk[-1]['page']}", "page": chunk[0]["page"], "img": chunk[0]["img"]})
    return out


def build(slug):
    b = BOOKS[slug]
    items = [(x, "") if isinstance(x, str) else x for x in b["items"]]
    out = os.path.join(ROOT, "data", "library", slug)
    os.makedirs(os.path.join(out, "figures"), exist_ok=True)
    from PIL import Image
    all_pages, chapters, figures, cover = [], [], [], None
    titles = {re.sub(r"\W", "", row[1].lower()) for row in (b.get("chapters") if isinstance(b.get("chapters"), list) else []) if row[1]}
    for vi, (ident, label) in enumerate(items, 1):
        try:
            pages = load_item(ident)
        except Exception as e:  # a volume archive.org cannot serve today is left out; the others stand
            print(f"  {ident}: SKIPPED ({e})", flush=True)
            continue
        # Fold-outs (and the manual pictures), covers and colour cards are not pages of the text.
        skip = {p["img"] for p in pages if FIGURE_TYPES.get(p["type"]) == "foldout" or p["type"] in ("Cover", "Color Card", "Tissue")}
        skip |= {f[0] for f in (b.get("figures") or [])} if vi == 1 else set()
        nums, first = number_pages(pages, {i: n for i, n in (b.get("page_at") or {}).items()} if vi == 1 else None, skip)
        figs = figure_pages(pages, nums, first, b.get("figures") if vi == 1 else None)
        # A page the picture finder took for a plate that is only a stamp or a blank: (volume, image index) pairs to leave out.
        figs = [f for f in figs if (vi, f["img"]) not in {tuple(x) for x in (b.get("not_figures") or [])}]
        for f in figs:
            if f["page"] is None:  # an unnumbered plate faces the last numbered page before it
                f["page"] = max((n for j, n in nums.items() if j < f["img"]), default=None)
        fig_imgs = {f["img"] for f in figs if f["kind"] == "foldout"} | skip
        vol_pages = []
        last = None
        for p in pages:
            i = p["img"]
            if i < first or i in fig_imgs:
                continue
            n = nums.get(i)
            if n is None:  # unnumbered: a plate keeps its caption with the page it faces; a blank page or the back of a fold-out is dropped
                if p["words"] < 40 or not last or (i - 1) in skip:
                    continue
                n = last
            vol_pages.append({"vol": vi, "page": n, "img": i, "words": p["words"], "paras": p["paras"]})
            last = n
        # Contents pages (Godbey's chapter topics) and the cover.
        if cover is None:
            title_img = next((p["img"] for p in pages if p["type"] == "Title"), None)
            if title_img is None:
                title_img = next((p["img"] for p in pages[:14] if 3 <= p["words"] <= 80), 1)
            cover = title_img
        if isinstance(b.get("chapters"), list) and vi == 1:
            ch = []
            for row in b["chapters"]:
                n, t, pg = row[:3]
                c = {"n": n, "title": t, "page": pg, "img": next((p["img"] for p in vol_pages if p["page"] >= pg), vol_pages[-1]["img"])}
                if len(row) > 3:
                    c["volume"] = row[3]
                if not t:  # "Book VI", with the printed summary under the heading ("Containing the interval of…") as its topics
                    paras = next((p["paras"] for p in vol_pages if p["img"] == c["img"]), [])
                    k = next((i for i, x in enumerate(paras) if HEADING.match(x)), -1)
                    lines = [x.strip(" .:-—") for x in paras[k + 1:k + 4] if len(x) < 140 and x.isupper() and re.match(r"(CONTAINING|FROM)\b", x)]
                    c["title"] = f"Book {n}"
                    summary = re.sub(r"\b(Of|The|And|Or|In|To|A|An|For|On|At|By|With|From)\b", lambda w: w.group(1).lower(), " ".join(lines).title())
                    c["topics"] = (summary[0].upper() + summary[1:] + ".") if lines else ""
                ch.append(c)
        elif b.get("chapters") == "items":
            ch = [{"n": "", "title": label or f"Volume {vi}", "page": vol_pages[0]["page"], "img": vol_pages[0]["img"]}]
        elif b.get("dictionary"):
            ch = dictionary_chapters(vol_pages, title=b["title"])
        else:
            ch = auto_chapters(vol_pages, b.get("heading"), b.get("heading_anywhere", False))
            for n, t, pg in b.get("chapters_extra") or []:
                ch.append({"n": n, "title": t, "page": pg, "img": next((p["img"] for p in vol_pages if p["page"] >= pg), vol_pages[-1]["img"]), "ord": 0, "word": ""})
            ch.sort(key=lambda c: c["img"])
            if b.get("parts"):
                k = 0
                for part, count in b["parts"]:
                    for c in ch[k:k + count]:
                        c["volume"] = part
                    k += count
            caps_topics(vol_pages, ch, b["title"])
            if len(ch) < 2:
                ch = [{"n": "", "title": f"Pages {vol_pages[s]['page']}–{vol_pages[min(s + 59, len(vol_pages) - 1)]['page']}", "page": vol_pages[s]["page"], "img": vol_pages[s]["img"]} for s in range(0, len(vol_pages), 60)]
        for c in ch:
            c["vol"] = vi
            if len(items) > 1:
                c["volume"] = label or f"Volume {vi}"
            c.setdefault("topics", "")
            c["topics"] = c["topics"] or ""
        # Long chapters split into parts, so a chapter loads in one tap.
        split = []
        for k, c in enumerate(ch):
            end_img = ch[k + 1]["img"] - 1 if k + 1 < len(ch) and ch[k + 1]["img"] else vol_pages[-1]["img"]
            span = [p for p in vol_pages if (c["img"] or 0) <= p["img"] <= end_img]
            if len(span) <= 100:
                split.append(c)
            else:
                parts = (len(span) + 79) // 80
                for q in range(parts):
                    seg = span[q * 80:(q + 1) * 80]
                    split.append({**c, "title": f"{c['title']} ({q + 1} of {parts})", "page": seg[0]["page"], "img": seg[0]["img"]})
        chapters += split
        for f in figs:
            f["vol"] = vi
        figures += figs
        all_pages += vol_pages
        print(f"  {ident}: {len(vol_pages)} pages ({vol_pages[0]['page']}–{vol_pages[-1]['page']}), {len(split)} chapters, {len(figs)} pictures", flush=True)
    # Chapter ends, by the next chapter's first image in the same volume.
    for k, c in enumerate(chapters):
        nxt = chapters[k + 1] if k + 1 < len(chapters) else None
        vol = [p for p in all_pages if p["vol"] == c["vol"]]
        c["end"] = (next((p["page"] for p in reversed(vol) if p["img"] < nxt["img"]), c["page"]) if nxt and nxt["vol"] == c["vol"] else vol[-1]["page"])
    if b.get("contents_images"):
        lo, hi = b["contents_images"]
        toc = "\n\n".join(t for p in load_item(items[0][0]) if lo <= p["img"] <= hi for t in p["paras"])
        for c in chapters:
            if not c["n"]:
                continue
            words = r"\s+".join(map(re.escape, c["title"].split()))
            m = re.search(r"CHAPTER\s+[IVXLT1l]+\s*[~\s]*" + words + r"\s*(.+?)(?=CHAPTER\s+[IVXLT1l]+\s|Bibliography,|$)", toc, re.S | re.I)
            topics = re.sub(r"\b[a-z]{0,4}\s*CONTENTS\s+[XxIiVvLl1]+\b|\b[XxIiVvLl1]+\s+CONTENTS\b", " ", m.group(1)) if m else ""
            topics = re.sub(r"\s+", " ", topics).strip()
            c["topics"] = re.sub(r"(\d[.?])[^0-9]*$", r"\1", topics)
    # Pictures and the cover, saved small; fold-outs large enough to read.
    for f in figures:
        ident = items[f["vol"] - 1][0]
        w = 2400 if f["kind"] == "foldout" else 900
        img = Image.open(io.BytesIO(fetch(f"https://archive.org/download/{ident}/page/n{f['img']}_w{w}.jpg", binary=True))).convert("RGB")
        f["file"] = f"figures/v{f['vol']}-n{f['img']}.webp"
        img.save(os.path.join(out, f["file"]), "WEBP", quality=74 if f["kind"] == "foldout" else 62)
        f["width"], f["height"] = img.size
    ident = items[all_pages[0]["vol"] - 1][0]
    Image.open(io.BytesIO(fetch(f"https://archive.org/download/{ident}/page/n{cover}_w500.jpg", binary=True))).convert("RGB").save(os.path.join(out, "figures", "cover.webp"), "WEBP", quality=70)
    for f in os.listdir(os.path.join(out, "figures")):
        if f != "cover.webp" and f"figures/{f}" not in {x["file"] for x in figures}:
            os.remove(os.path.join(out, "figures", f))
    doc = {k: b[k] for k in ("title", "subtitle", "author", "year", "publisher", "license")}
    doc.update({
        "slug": slug, "source": f"https://archive.org/details/{ident}", "items": [{"id": i, "label": l} for i, l in items],
        "scan": "https://archive.org/download/{id}/page/n{img}_w1200.jpg", "cover": "figures/cover.webp",
        "pages": len(all_pages), "volumes": len(items),
        "chapters": [{"n": c["n"], "title": c["title"], "vol": c["vol"], "volume": c.get("volume", ""), "page": c["page"], "end": c["end"], "topics": c["topics"]} for c in chapters],
        "figures": [{"kind": f["kind"], "title": f["title"], "caption": f["caption"], "vol": f["vol"], "page": f["page"], "img": f["img"], "file": f["file"], "width": f["width"], "height": f["height"]} for f in figures],
    })
    json.dump(doc, open(os.path.join(out, "book.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    fix = repair_long_s if b.get("long_s") else (lambda t: t)
    rows = [{"vol": p["vol"], "page": p["page"], "img": p["img"], "words": p["words"], "text": fix(clean_text(p["paras"], titles))} for p in all_pages]
    for f in os.listdir(out):
        if f == "pages.json" or re.fullmatch(r"pages-v\d+\.json", f):
            os.remove(os.path.join(out, f))
    if len(items) == 1:
        json.dump(rows, open(os.path.join(out, "pages.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    else:
        for vi in sorted({r["vol"] for r in rows}):
            json.dump([r for r in rows if r["vol"] == vi], open(os.path.join(out, f"pages-v{vi}.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"{slug}: {len(all_pages)} pages in {len(items)} volume(s), {len(chapters)} chapters, {len(figures)} pictures")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args == ["--list"]:
        for s, b in BOOKS.items():
            print(f"{s:40} {b['author']}, {b['year']}: {b['title']} ({len(b['items'])} vol)")
        sys.exit(0)
    failed = []
    for slug in (BOOKS if args == ["--all"] else args):
        try:
            build(slug)
        except Exception as e:
            print(f"{slug}: FAILED ({e})", flush=True)
            failed.append(slug)
    if failed:
        print("failed: " + ", ".join(failed))
        sys.exit(1)
