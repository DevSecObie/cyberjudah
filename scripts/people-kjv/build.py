"""Build data/people-kjv/<book>.json from the KJV text and two hand-kept lists in data/people-kjv/sources.

<book>.names.txt: key | Name | forms (;) | verses | type | description
  verses: * = every verse of the book naming one of the forms; c:v,c:v = those verses;
  !c:v leaves a verse out; !c:v=Form leaves out only that form in that verse.
  type: M male, F female, U not stated, G a people, C a creature; P place, T title, X other (not People).
<book>.links.txt: the family links, each with the verses that state it (see the file's header).

Every name in every verse of the book must belong to some record, every record's verses must
name it, and every link must cite verses of the book. Usage: build.py BOOK [--check]
"""
import collections, json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from names import ROOT, chapters, index

ABBR = {'genesis': 'gen'}
TYPES = {'M': 'Male', 'F': 'Female', 'U': 'Unknown', 'G': 'Group', 'C': 'Creature'}
OPS = {'<': 'father', '<<': 'mother', '=': 'partners', '~': 'siblings', '^': 'line', '@': 'nation'}


def vkey(r): return tuple(int(x) for x in r.split('/')[1:])


def records(book, VERSES, errs):
    recs = []
    src = f'{ROOT}/people-kjv/sources/{book}.names.txt'
    for ln, line in enumerate(open(src, encoding='utf-8'), 1):
        line = line.strip()
        if not line or line.startswith('#'): continue
        parts = [p.strip() for p in line.split('|')]
        if len(parts) != 6: errs.append(f'names {ln}: {len(parts)} fields'); continue
        key, name, forms, vs, typ, desc = parts
        forms = [f.strip() for f in forms.split(';') if f.strip()]
        toks = [t.strip() for t in vs.split(',') if t.strip()]
        exc = {}
        for t in toks:
            if t.startswith('!'):
                cv, _, f = t[1:].partition('=')
                exc.setdefault(f'{book}/' + cv.replace(':', '/'), set()).update([f] if f else forms)
        def named(r): return {x[0] for x in VERSES[r]} & (set(forms) - exc.get(r, set()))
        naming = [r for r in VERSES if r.startswith(book + '/') and named(r)]
        inc = [f'{book}/' + t.replace(':', '/') for t in toks if t != '*' and not t.startswith('!')]
        if inc:
            for r in inc:
                if r not in naming: errs.append(f'names {ln} {key}: {r} does not name {forms}')
            verses = inc
        else:
            verses = naming
        if not verses: errs.append(f'names {ln} {key}: no verses')
        if typ not in TYPES and typ not in 'PTX': errs.append(f'names {ln} {key}: type {typ}')
        recs.append(dict(key=key, name=name, forms=forms, verses=sorted(set(verses), key=vkey), type=typ, desc=desc,
                         exc={v: fs for v, fs in exc.items()}))
    keys = collections.Counter(r['key'] for r in recs)
    errs += [f'names: key {k} used {n} times' for k, n in keys.items() if n > 1]
    # every name in the book belongs to a record
    cover = set()
    for r in recs:
        for v in r['verses']:
            cover |= {(v, f) for f in r['forms'] if f not in r['exc'].get(v, ())}
    for v, xs in VERSES.items():
        if v.startswith(book + '/'):
            for w, _ in xs:
                if (v, w) not in cover: errs.append(f'names: {w} in {v} belongs to no record')
    return recs


def build(book):
    FORMS, VERSES = index()
    errs, warns = [], []
    recs = records(book, VERSES, errs)
    B = chapters(book)
    people = {r['key']: r for r in recs if r['type'] in TYPES}
    allkeys = {r['key']: r for r in recs}
    ids, used = {}, collections.Counter()
    for k, r in people.items():
        base = re.sub(r'[^a-z0-9]+', '-', r['name'].lower()).strip('-') + f'-{ABBR[book]}-' + '-'.join(r['verses'][0].split('/')[1:])
        used[base] += 1
        ids[k] = base if used[base] == 1 else base + 'abcdefgh'[used[base] - 1]
    out = {k: {'id': ids[k], 'name': r['name'], 'names': list(dict.fromkeys([r['name']] + r['forms'])), 'type': TYPES[r['type']],
               'description': r['desc'], 'verses': r['verses'],
               **{f: [] for f in ('father', 'mother', 'partners', 'siblings', 'children', 'line', 'nation')}}
           for k, r in people.items()}

    def ref(cv, ln):
        c, _, v = cv.partition(':')
        if c not in B or not v.isdigit() or not 1 <= int(v) <= len(B[c]): errs.append(f'links {ln}: no verse {book} {cv}')
        return f'{book}/{c}/{v}'

    def put(lst, k, vs, note, ev):
        for x in lst:
            if x['id'] == ids[k]:
                x['verses'] = sorted(set(x['verses']) | set(vs), key=vkey)
                return
        e = {'id': ids[k], 'evidence': ev, 'verses': vs}
        if note: e['note'] = note
        lst.append(e)

    def names_in(k, r): return {x[0] for x in VERSES.get(r, [])} & set(people[k]['forms'])
    for ln, line in enumerate(open(f'{ROOT}/people-kjv/sources/{book}.links.txt', encoding='utf-8'), 1):
        line = line.strip()
        if not line or line.startswith('#'): continue
        parts = [p.strip() for p in line.split('|')]
        m = re.match(r'(.+?)\s+(<<|<|=|~|\^|@)\s+(\S+)$', parts[0])
        if not m or len(parts) < 2: errs.append(f'links {ln}: cannot read'); continue
        kids, op, b = m.group(1).split(), m.group(2), m.group(3)
        vs = sorted({ref(x.strip(), ln) for x in parts[1].split(',')}, key=vkey)
        note = parts[2] if len(parts) > 2 else ''
        bad = [a for a in kids + [b] if a not in people]
        if bad:
            errs += [f'links {ln}: {a} is not a person' + (f" (type {allkeys[a]['type']})" if a in allkeys else '') for a in bad]
            continue
        for a in kids:
            if a == b: errs.append(f'links {ln}: {a} linked to itself'); continue
            if op in ('<', '<<') and not any(names_in(a, r) or names_in(b, r) for r in vs):
                if not note: errs.append(f'links {ln}: no verse names {a} or {b}; say why in a note')
            if op == '<' and people[b]['type'] not in 'MU': errs.append(f'links {ln}: father {b} is {people[b]["type"]}')
            if op == '<<' and people[b]['type'] not in 'FU': errs.append(f'links {ln}: mother {b} is {people[b]["type"]}')
            if op == '@' and people[b]['type'] != 'G': errs.append(f'links {ln}: {b} is not a people')
            ev = 'scripture'
            put(out[a][OPS[op]], b, vs, note, ev)
            if op in ('<', '<<'): put(out[b]['children'], a, vs, note, ev)
            if op in ('=', '~'): put(out[b][OPS[op]], a, vs, note, ev)
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
    return {'book': book, 'people': people_out}, errs, warns


def dump(doc):
    lines = ',\n'.join(json.dumps(p, ensure_ascii=False, separators=(',', ':')) for p in doc['people'])
    return '{"book":' + json.dumps(doc['book']) + ',"people":[\n' + lines + '\n]}\n'


if __name__ == '__main__':
    book = sys.argv[1]
    doc, errs, warns = build(book)
    for e in errs: print('error:', e)
    if errs: sys.exit(1)
    path = f'{ROOT}/people-kjv/{book}.json'
    text = dump(doc)
    if '--check' in sys.argv:
        if not os.path.exists(path) or open(path, encoding='utf-8').read() != text: print(f'{path} is out of date: run build.py {book}'); sys.exit(1)
        print(f'{book}: {len(doc["people"])} people, up to date')
    else:
        open(path, 'w', encoding='utf-8').write(text)
        print(f'{book}: {len(doc["people"])} people written')
