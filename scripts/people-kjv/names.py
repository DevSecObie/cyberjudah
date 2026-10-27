"""The proper names of the KJV with Apocrypha, found in the text itself.

A capitalised word is a name when it is not an ordinary English word (it never appears
in lower case in the KJV) and it is either used mid-sentence or tagged with a Strong's
number in data/strongs/tags (Strong's 1890 concordance, public domain), or it is on the
ALSO list below of names that are also ordinary words somewhere in the KJV.
FORMS: form -> {mid, strongs, verses}; VERSES: book/chapter/verse -> [[form, [strongs]]].
"""
import collections, json, os, re

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'data')
NAME = re.compile(r"\b[A-Z][a-z]+(?:[-–][a-zA-Z]+)*(?:'s)?")
SENT = re.compile(r'(^|[.?!]\s+)$')
# Capitalised words that are not names wherever they stand
NOT = set('''I O God Lord LORD Almighty Highest Holy Ghost Spirit Amen Hallelujah Alleluia Selah Sabbath Sabbaths Passover
Urim Thummim Ah Alas Oh Lo Behold Thou Thee Thy Thine Ye You He She It We They Him Her His Its Our Your Their
Saviour Redeemer Creator Father Son Word Lamb Comforter Messiah Shiloh Most Mighty Everlasting Prince Wonderful Counsellor'''.split())
# Names that are also ordinary words somewhere in the KJV
ALSO = set('''Abarim Abib Adar Addar Adonijah Ammah Ammi Anath Arabah Aram Arba Ashan Aven Azmaveth Baal Baladan Beer Berith Bezek
Cain Dagon Damascus Dan Dor Edom Eglaim Elim Enan Ephah Ephratah Ezel Ezer Gad Gaddi Gamul Gath Geber Gilead Gog Hadad Hanan
Haran Hazor Hen Hepher Heres Hermon Hesed Hoglah Jaakan Jair Jashub Jearim Jesus Jona Judah Lebaoth Lehi Leviathan Lot Maachah
Melech Merodach Mizpeh Mizraim Moab Nahash Naphtali Nebo Necho Nimrah Paran Peor Perazim Pisgah Ram Rapha Rehob Rimmon Serah
Shalisha Sharezer Sheba Sherah Shittim Shua Shual Sodomites Tabor Tamar Tappuah Terah Tob Uzza Uzzah Zephon Zobah Zoheth Zophim Zur'''.split())


def books():
    return sorted(f[:-5] for f in os.listdir(f'{ROOT}/bible') if f.endswith('.json') and f != 'index.json')


def chapters(slug):
    return json.load(open(f'{ROOT}/bible/{slug}.json', encoding='utf-8'))['chapters']


def index():
    H = json.load(open(f'{ROOT}/strongs/hebrew.json', encoding='utf-8')); G = json.load(open(f'{ROOT}/strongs/greek.json', encoding='utf-8'))
    def proper(s):
        d = (H.get(s) or G.get(s) or {}).get('def', '')
        return d[:1].isupper() or 'name' in d
    vocab = collections.Counter()
    forms = collections.defaultdict(lambda: {'strongs': collections.Counter(), 'verses': [], 'mid': 0})
    verses = {}
    for slug in books():
        tagf = f'{ROOT}/strongs/tags/{slug}.json'
        tags = json.load(open(tagf, encoding='utf-8')) if os.path.exists(tagf) else {}
        for c, vs in chapters(slug).items():
            for i, t in enumerate(vs):
                v = str(i + 1); ref = f'{slug}/{c}/{v}'
                vocab.update(re.findall(r'\b[a-z]+', t))
                toks = tags.get(c, {}).get(v, [])
                found = []
                for m in NAME.finditer(t):
                    w = m.group(0)
                    if w.endswith("'s"): w = w[:-2]
                    w = w.replace('–', '-')
                    if w in NOT: continue
                    mid = not SENT.search(t[:m.start()])
                    ss = sorted({s for ph, sl in toks if w.replace('-', '–') in ph or w in ph for s in sl if proper(s)})
                    found.append([w, ss])
                    f = forms[w]; f['verses'].append(ref); f['mid'] += mid
                    for s in ss: f['strongs'][s] += 1
                verses[ref] = found
    def is_name(w, f): return w in ALSO or (vocab.get(w.lower(), 0) < 1 and (f['mid'] or f['strongs'] or '-' in w))
    FORMS = {w: {'mid': f['mid'], 'strongs': dict(f['strongs']), 'verses': list(dict.fromkeys(f['verses']))}
             for w, f in forms.items() if is_name(w, f)}
    VERSES = {r: [x for x in fs if x[0] in FORMS] for r, fs in verses.items()}
    return FORMS, VERSES
