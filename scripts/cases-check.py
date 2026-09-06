#!/usr/bin/env python3
"""Validate a list of case dicts against the KJVA text, the handbook sections and the precept slugs.
Usage: python3 scripts/cases-check.py scripts/cases-add-judgments.py [--quiet]"""
import json, sys, re, importlib.util, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
books = json.load(open(f"{ROOT}/static/api/kjv/books.json"))
slug_of = {b["book"]: b["slug"] for b in books}
handbook = json.load(open(f"{ROOT}/data/handbook.json"))
sections = {s["id"]: s for p in handbook["parts"] for s in p["sections"]}
precepts = [t["slug"] for t in json.load(open(f"{ROOT}/data/precepts.json"))["topics"]]
existing = json.load(open(f"{ROOT}/data/cases.json"))
ex_slugs = {c["slug"] for c in existing["cases"]}
eras = set(existing["eras"])

spec = importlib.util.spec_from_file_location("add", sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
quiet = "--quiet" in sys.argv
chap_cache = {}
def chapter(book, ch):
    k = (book, ch)
    if k not in chap_cache:
        p = f"{ROOT}/static/api/kjv/{slug_of[book]}/{ch}.json"
        chap_cache[k] = json.load(open(p)) if os.path.exists(p) else None
    return chap_cache[k]
def find_precept(name):
    k = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    if k in precepts: return k
    return next((p for p in precepts if p.startswith(k)), None) or next((p for p in precepts if k in p), None)

errs = 0
for c in m.CASES:
    print(f"\n== {c['name']} [{c['era']} / {c['verdict']}]")
    if c["slug"] in ex_slugs: print("  !! slug already exists"); errs += 1
    if c["era"] not in eras: print("  !! unknown era"); errs += 1
    for k in ["slug","name","era","charge","verdict","summary","offense","judgment","refs","laws","topics","themes"]:
        if k not in c: print(f"  !! missing field {k}"); errs += 1
    for r in c["refs"]:
        if r["book"] not in slug_of: print(f"  !! unknown book {r['book']}"); errs += 1; continue
        ch = chapter(r["book"], r["chapter"])
        if not ch: print(f"  !! no chapter {r['book']} {r['chapter']}"); errs += 1; continue
        verses = {v["verse"]: v["text"] for v in ch["verses"]}
        vv = r.get("verses")
        if vv:
            a, b = (vv.split("-") + [None])[:2]; a = int(a); b = int(b) if b else a
            if a not in verses or b not in verses: print(f"  !! {r['book']} {r['chapter']}:{vv} out of range (chapter has {max(verses)} verses)"); errs += 1; continue
            if not quiet: print(f"  {r['book']} {r['chapter']}:{vv}  {verses[a][:90]}")
    for l in c["laws"]:
        sid = l.split(".")[0]
        if sid not in sections: print(f"  !! unknown law section {l}"); errs += 1
    for t in c["topics"]:
        p = find_precept(t)
        if not p: print(f"  !! topic {t} resolves to no precept"); errs += 1
        elif p != t and not quiet: print(f"  (topic {t} -> {p})")
print(f"\n{len(m.CASES)} cases, {errs} problems")
sys.exit(1 if errs else 0)
