#!/usr/bin/env python3
"""Emit exact KJV markdown from the site's own data/bible. Never type scripture by hand.

  v.py "John 5:39"                 -> main heading + blockquote
  v.py "Acts 17:11" --precept      -> nested precept form (2/4 space indents)
  v.py "Jeremiah 48:1-4" -t 18:34  -> heading with a timestamp
"""
import json, os, re, sys, unicodedata

import os
ROOT = os.environ.get("CJ_ROOT") or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
IDX = json.load(open(f"{ROOT}/data/bible/index.json"))
SLUG = {e["book"]: e["slug"] for e in IDX}
BYLOW = {e["book"].lower(): e["book"] for e in IDX}
ALIAS = {"psalm": "Psalms", "song of songs": "Song of Solomon", "ecclesiasticus": "Sirach",
         "sirach": "Sirach", "wisdom": "Wisdom of Solomon", "1 esdras": "1 Esdras", "2 esdras": "2 Esdras"}
_cache = {}
def chapters(book):
    if book not in _cache:
        _cache[book] = json.load(open(f"{ROOT}/data/bible/{SLUG[book]}.json"))["chapters"]
    return _cache[book]

def resolve(name):
    n = " ".join(name.strip().split())
    if n.lower() in ALIAS: return ALIAS[n.lower()]
    if n.lower() in BYLOW: return BYLOW[n.lower()]
    for b in SLUG:
        if b.lower().startswith(n.lower()): return b
    raise SystemExit(f"unknown book: {name!r}")

def parse(ref):
    m = re.match(r"^\s*(.+?)\s+(\d+):([\d,\- ]+)\s*$", ref)
    if not m: raise SystemExit(f"bad reference: {ref!r}  (use 'John 5:39' or 'Acts 17:11-13')")
    book, ch, spec = resolve(m.group(1)), int(m.group(2)), m.group(3)
    vs = []
    for part in spec.split(","):
        part = part.strip()
        if not part: continue
        if "-" in part:
            a, b = [int(x) for x in part.split("-")]
            vs += list(range(a, b + 1))
        else:
            vs.append(int(part))
    return book, ch, vs, spec.replace(" ", "")

def main():
    args = [a for a in sys.argv[1:]]
    precept = "--precept" in args; args = [a for a in args if a != "--precept"]
    ts = None
    if "-t" in args:
        i = args.index("-t"); ts = args[i+1]; del args[i:i+2]
    ref = " ".join(args)
    book, ch, vs, spec = parse(ref)
    body = chapters(book)
    if str(ch) not in body: raise SystemExit(f"{book} has no chapter {ch}")
    verses = body[str(ch)]
    slug, label = SLUG[book], f"{book} {ch}:{spec}"
    url = f"/bible/{slug}/{ch}#v{vs[0]}"
    quote = []
    for v in vs:
        if v > len(verses): raise SystemExit(f"{book} {ch} has only {len(verses)} verses (asked v{v})")
        t = unicodedata.normalize("NFC", verses[v-1]).replace("<", "&lt;")
        quote.append(f"> <sup>[{v}](/bible/{slug}/{ch}#v{v})</sup> {t}")
    q = "\n>\n".join(quote)
    if precept:
        print(f"  - **[{label}]({url})**")
        print("\n".join("    " + l for l in q.split("\n")))
        print()
        print("    ")
    else:
        print(f"**[{label}]({url})**" + (f"  *[{ts}]*" if ts else ""))
        print()
        print(q)
main()
