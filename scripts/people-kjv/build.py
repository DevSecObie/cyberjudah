"""Build data/people-kjv/people.json from the KJV text and the hand-kept lists in data/people-kjv/sources.

Each book has <book>.names.txt and <book>.links.txt, read in Bible order.
<book>.names.txt: key | Name | forms (;) | verses | type | description
  verses: * = every verse of the book naming one of the forms; c:v,c:v = those verses;
  !c:v leaves a verse out; !c:v=Form leaves out only that form in that verse.
  type: M male, F female, U not stated, G a people, C a creature; P place, T title, X other (not People);
  + carries on a record from an earlier book: its verses (and any new forms) in this book are added,
  and Name and description stay empty.
<book>.links.txt: the family links, each with the verses of that book that state it (see the file's header):
  kids op target | verses | note | evidence | sources
  evidence (default scripture): scripture, parallel, history or variant.
  sources: where a link was checked outside the verse, each `Title <https://...>`, joined by ` ; `.

Every name in every verse of a book must belong to some record, every record's verses must name it,
and every link must cite verses. Usage: build.py [--check]
"""
import collections, json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from names import ROOT, chapters, index

# Book codes for record ids (name-book-chapter-verse), the same codes the old catalog's ids use.
ABBR = dict(zip([b['slug'] for b in json.load(open(f'{ROOT}/bible/index.json', encoding='utf-8'))], '''
    gen exo lev num deu jos jdg rut 1sa 2sa 1ki 2ki 1ch 2ch ezr neh est job psa pro
    ecc sng isa jer lam ezk dan hos jol amo oba jon mic nam hab zep hag zec mal mat
    mrk luk jhn act rom 1co 2co gal eph php col 1th 2th 1ti 2ti tit phm heb jas 1pe
    2pe 1jn 2jn 3jn jud rev 1es 2es tob jdt esg wis sir bar s3y sus bel man 1ma 2ma
    lje'''.split()))
TYPES = {'M': 'Male', 'F': 'Female', 'U': 'Unknown', 'G': 'Group', 'C': 'Creature'}
OPS = {'<': 'father', '<<': 'mother', '=': 'partners', '~': 'siblings', '^': 'line', '&': 'tribe', '@': 'nation', '==': 'same'}
EVIDENCE = ('scripture', 'parallel', 'history', 'variant')
ORDER = [b['slug'] for b in json.load(open(f'{ROOT}/bible/index.json', encoding='utf-8'))]
OUT = f'{ROOT}/people-kjv/people.json'


def vkey(r):
    b, c, v = r.split('/')
    return (ORDER.index(b), int(c), int(v))


def source_books():
    have = {f[:-len('.names.txt')] for f in os.listdir(f'{ROOT}/people-kjv/sources') if f.endswith('.names.txt')}
    return [b for b in ORDER if b in have]


def lines(path):
    for ln, line in enumerate(open(path, encoding='utf-8'), 1):
        line = line.strip()
        if line and not line.startswith('#'): yield ln, [p.strip() for p in line.split('|')]


def read_names(book, VERSES, recs, errs):
    cover = set()
    for ln, parts in lines(f'{ROOT}/people-kjv/sources/{book}.names.txt'):
        at = f'{book} names {ln}'
        if len(parts) != 6: errs.append(f'{at}: {len(parts)} fields'); continue
        key, name, forms, vs, typ, desc = parts
        forms = [f.strip() for f in forms.split(';') if f.strip()]
        if typ == '+':
            if key not in recs: errs.append(f'{at}: {key} is not in an earlier book'); continue
            if name or desc: errs.append(f'{at}: a carried-on record keeps its name and description')
            r = recs[key]
            r['forms'] += [f for f in forms if f not in r['forms']]
        else:
            if key in recs: errs.append(f'{at}: key {key} already used'); continue
            if typ not in TYPES and typ not in 'PTX': errs.append(f'{at}: type {typ}')
            r = recs[key] = dict(key=key, name=name, forms=forms, verses=[], type=typ, desc=desc)
        toks = [t.strip() for t in vs.split(',') if t.strip()]
        exc = {}
        for t in toks:
            if t.startswith('!'):
                cv, _, f = t[1:].partition('=')
                exc.setdefault(f'{book}/' + cv.replace(':', '/'), set()).update([f] if f else forms)
        def named(v): return {x[0] for x in VERSES[v]} & (set(forms) - exc.get(v, set()))
        naming = [v for v in VERSES if v.startswith(book + '/') and named(v)]
        inc = [f'{book}/' + t.replace(':', '/') for t in toks if t != '*' and not t.startswith('!')]
        for v in inc:
            if v not in naming: errs.append(f'{at} {key}: {v} does not name {forms}')
        verses = inc or naming
        if not verses: errs.append(f'{at} {key}: no verses')
        r['verses'] = sorted(set(r['verses']) | set(verses), key=vkey)
        cover |= {(v, f) for v in verses for f in forms if f not in exc.get(v, ())}
    for v, xs in VERSES.items():
        if v.startswith(book + '/'):
            for w, _ in xs:
                if (v, w) not in cover: errs.append(f'{book} names: {w} in {v} belongs to no record')


def build():
    FORMS, VERSES = index()
    errs = []
    books = source_books()
    recs = {}
    for book in books: read_names(book, VERSES, recs, errs)
    people = {k: r for k, r in recs.items() if r['type'] in TYPES}
    ids, used = {}, collections.Counter()
    for k, r in sorted(people.items(), key=lambda kr: vkey(kr[1]['verses'][0]) if kr[1]['verses'] else (0, 0, 0)):
        if not r['verses']: continue
        b, c, v = r['verses'][0].split('/')
        base = re.sub(r'[^a-z0-9]+', '-', r['name'].lower()).strip('-') + f'-{ABBR[b]}-{c}-{v}'
        used[base] += 1
        ids[k] = base if used[base] == 1 else base + 'abcdefgh'[used[base] - 1]
    out = {k: {'id': ids[k], 'name': r['name'], 'names': list(dict.fromkeys([r['name']] + r['forms'])), 'type': TYPES[r['type']],
               'description': r['desc'], 'verses': r['verses'],
               **{f: [] for f in ('father', 'mother', 'partners', 'siblings', 'children', 'line', 'tribe', 'nation', 'same')}}
           for k, r in people.items() if k in ids}

    def put(lst, k, vs, note, ev, srcs):
        for x in lst:
            if x['id'] == ids[k]:
                x['verses'] = sorted(set(x['verses']) | set(vs), key=vkey)
                if srcs: x['sources'] = x.get('sources', []) + [s for s in srcs if s not in x.get('sources', [])]
                return
        e = {'id': ids[k], 'evidence': ev, 'verses': vs}
        if note: e['note'] = note
        if srcs: e['sources'] = srcs
        lst.append(e)

    def names_in(k, v): return {x[0] for x in VERSES.get(v, [])} & set(recs[k]['forms'])
    for book in books:
        B = chapters(book)
        for ln, parts in lines(f'{ROOT}/people-kjv/sources/{book}.links.txt'):
            at = f'{book} links {ln}'
            m = re.match(r'(.+?)\s+(<<|<|==|=|~|\^|&|@)\s+(\S+)$', parts[0])
            if not m or len(parts) < 2: errs.append(f'{at}: cannot read'); continue
            kids, op, b = m.group(1).split(), m.group(2), m.group(3)
            vs = []
            for cv in parts[1].split(','):
                c, _, v = cv.strip().partition(':')
                if c not in B or not v.isdigit() or not 1 <= int(v) <= len(B[c]): errs.append(f'{at}: no verse {book} {cv.strip()}')
                vs.append(f'{book}/{c}/{v}')
            vs = sorted(set(vs), key=vkey)
            note = parts[2] if len(parts) > 2 else ''
            ev = (parts[3] if len(parts) > 3 else '') or 'scripture'
            if ev not in EVIDENCE: errs.append(f'{at}: evidence {ev}')
            srcs = []
            for src in (parts[4] if len(parts) > 4 else '').split(' ; '):
                if not src.strip(): continue
                sm = re.match(r'(.+?)\s*<(https://[^\s<>]+)>$', src.strip())
                if not sm: errs.append(f'{at}: source {src.strip()!r} is not "Title <https://...>"'); continue
                srcs.append({'title': sm.group(1), 'url': sm.group(2)})
            if ev in ('history', 'variant') and not srcs: errs.append(f'{at}: {ev} evidence needs a source')
            bad = [a for a in kids + [b] if a not in out]
            if bad:
                errs += [f'{at}: {a} is not a person' + (f" (type {recs[a]['type']})" if a in recs else '') for a in bad]
                continue
            for a in kids:
                if a == b: errs.append(f'{at}: {a} linked to itself'); continue
                if op in ('<', '<<') and not note and not any(names_in(a, v) or names_in(b, v) for v in vs):
                    errs.append(f'{at}: no verse names {a} or {b}; say why in a note')
                if op == '<' and recs[b]['type'] not in 'MU': errs.append(f'{at}: father {b} is {recs[b]["type"]}')
                if op == '<<' and recs[b]['type'] not in 'FU': errs.append(f'{at}: mother {b} is {recs[b]["type"]}')
                if op == '@' and recs[b]['type'] != 'G': errs.append(f'{at}: {b} is not a people')
                if op == '&' and recs[b]['type'] != 'M': errs.append(f'{at}: tribe {b} must be a son of Jacob or Joseph')
                put(out[a][OPS[op]], b, vs, note, ev, srcs)
                if op in ('<', '<<'): put(out[b]['children'], a, vs, note, ev, srcs)
                if op in ('=', '~', '=='): put(out[b][OPS[op]], a, vs, note, ev, srcs)
    for k, p in out.items():
        for f in ('father', 'mother'):
            if len(p[f]) > 1: errs.append(f'{k}: {len(p[f])} in {f}')
    byid = {v: k for k, v in ids.items()}
    def up(k, seen):
        for e in out[k]['father'] + out[k]['mother'] + out[k]['line']:
            j = byid[e['id']]
            if j in seen: errs.append(f'{k}: is their own forefather'); return
            up(j, seen | {j})
    for k in out: up(k, {k})
    keep = ('father', 'mother', 'partners', 'siblings', 'children')
    people_out = sorted(({f: v for f, v in p.items() if v != [] or f in keep} for p in out.values()),
                        key=lambda p: vkey(p['verses'][0]) + (p['id'],))
    return {'books': books, 'people': people_out}, errs


def dump(doc):
    rows = ',\n'.join(json.dumps(p, ensure_ascii=False, separators=(',', ':')) for p in doc['people'])
    return '{"books":' + json.dumps(doc['books']) + ',"people":[\n' + rows + '\n]}\n'


if __name__ == '__main__':
    doc, errs = build()
    for e in errs: print('error:', e)
    if errs: sys.exit(1)
    text = dump(doc)
    if '--check' in sys.argv:
        if not os.path.exists(OUT) or open(OUT, encoding='utf-8').read() != text: print(f'{OUT} is out of date: run build.py'); sys.exit(1)
        print(f'{len(doc["people"])} people from {", ".join(doc["books"])}, up to date')
    else:
        open(OUT, 'w', encoding='utf-8').write(text)
        print(f'{len(doc["people"])} people from {", ".join(doc["books"])} written')
