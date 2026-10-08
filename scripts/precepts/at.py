#!/usr/bin/env python3
"""The verse each precept explains, when a class opened more than one verse.

A class note opens a passage ("Genesis 4:1-8", or a whole chapter) and lines precepts up
under it. In the Bible app each precept belongs under the verse it explains, not piled on
the first verse of the range. This picks that verse: the verse of the passage that shares
the most words with the precept, its words and the note's line on it. A verse set by hand
(a writer who read the class) is kept; `--redo` recomputes only the ones picked here.

Writes data/precepts/at.json: {"<note file>|<scripture opened>|<precept>": {"v": "5", "by": "words"|"hand"}}.
The engine reads it and shows the precept under that verse.

  python3 scripts/precepts/at.py            # fill in every range precept without a verse
  python3 scripts/precepts/at.py --show 20  # print a sample
  python3 scripts/precepts/at.py --book genesis --export DIR   # briefs for writers to check
  python3 scripts/precepts/at.py --merge FILE                  # {key: "5"} set by hand
"""
import argparse
import json
import os
import random
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
import why  # noqa: E402

ROOT = why.ROOT
OUT = os.path.join(ROOT, "data", "precepts", "at.json")
STOP = set("""a an and are as at be but by for from he her him his i in is it its me my not of on or our shall she so
that the thee their them then there these they thine this thou thy to unto up upon us was we were which who will with ye
you your all also any hath have had did do doth even if into lord god no nor one out said saith say o when what whom""".split())
_bible = {}


def verses_of(slug, ch):
    if slug not in _bible:
        f = os.path.join(ROOT, "data", "bible", f"{slug}.json")
        _bible[slug] = json.load(open(f, encoding="utf-8"))["chapters"] if os.path.exists(f) else {}
    return _bible[slug].get(str(ch), [])


def words(s):
    out = set()
    for w in re.findall(r"[a-z]+", s.lower()):
        if len(w) > 2 and w not in STOP:
            out.add(w[:-1] if w.endswith("s") and len(w) > 4 else w)
    return out


def span(opened):
    """(slug, chapter, [verse numbers]) of a passage label like 'Genesis 4:1-8' or 'Genesis 4'."""
    m = re.match(r"^(.*?)\s+(\d+)(?::([\d,\-]+))?$", opened.strip())
    if not m:
        return None
    return m.group(1), int(m.group(2)), m.group(3)


def rng(spec, n):
    if not spec:
        return list(range(1, n + 1))
    out = []
    for part in spec.split(","):
        a, _, b = part.partition("-")
        if a.isdigit():
            out += list(range(int(a), int(b) + 1 if b.isdigit() else int(a) + 1))
    return [v for v in out if 1 <= v <= n]


def load():
    return json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {}


def save(d):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(d.items())), f, ensure_ascii=False, indent=1)
        f.write("\n")


def ranged():
    """Every precept whose opened passage covers more than one verse, with the verses to choose from."""
    for p in why.passages():
        s = span(p["opened"])
        if not s:
            continue
        _, ch, spec = s
        texts = verses_of(p["slug"], ch)
        vs = rng(spec, len(texts))
        if len(vs) < 2:
            continue
        for pre in p["precepts"]:
            yield p, pre, ch, vs, texts


def pick(pre, vs, texts, point=""):
    want = words(pre["verse"]) | words(pre["line"]) | words(pre["label"])
    best, score = vs[0], 0
    for v in vs:
        s = len(want & words(texts[v - 1]))
        if s > score:
            best, score = v, s
    return best, score


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--show", type=int, default=0)
    ap.add_argument("--redo", action="store_true", help="recompute the verses picked by words (hand-set ones stay)")
    ap.add_argument("--book")
    ap.add_argument("--export")
    ap.add_argument("--merge")
    args = ap.parse_args()
    at = load()

    if args.merge:
        got = json.load(open(args.merge, encoding="utf-8"))
        valid = {why.key(p, pre): vs for p, pre, _, vs, _ in ranged()}
        ok = bad = 0
        for k, v in got.items():
            first = str(v).split("-")[0]
            if k in valid and first.isdigit() and int(first) in valid[k]:
                at[k] = {"v": str(v), "by": "hand"}
                ok += 1
            else:
                bad += 1
        save(at)
        print(f"set {ok} verses by hand; {bad} rejected (unknown key or verse outside the passage)")
        return

    if args.export:
        os.makedirs(args.export, exist_ok=True)
        n = 0
        groups = {}
        for p, pre, ch, vs, texts in ranged():
            if args.book and args.book != p["slug"]:
                continue
            groups.setdefault(id(p), (p, ch, vs, texts, []))[4].append(pre)
        for i, (p, ch, vs, texts, pres) in enumerate(groups.values()):
            lines = [f"Scripture opened: {p['opened']} (class: {p['title']})", "Verses of the passage:"]
            lines += [f"{v}. {texts[v - 1]}" for v in vs]
            lines.append("\nPrecepts (for each, the verse number of the passage it explains; a range like 4-5 if it plainly spans them):")
            for pre in pres:
                k = why.key(p, pre)
                lines.append(f"- KEY {k}\n  {pre['label']}: \"{pre['verse']}\"" + (f"\n  Note's line: {pre['line']}" if pre["line"] else "") + f"\n  Guess by shared words: {at.get(k, {}).get('v', '?')}")
            open(os.path.join(args.export, f"{i:04d}.txt"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
            n += len(pres)
        print(f"{len(groups)} passages, {n} precepts exported to {args.export}")
        return

    set_ = kept = 0
    sample = []
    for p, pre, ch, vs, texts in ranged():
        k = why.key(p, pre)
        if k in at and (at[k].get("by") == "hand" or not args.redo):
            kept += 1
            continue
        v, score = pick(pre, vs, texts)
        if score < 3:  # too little in common to say; a writer places it
            at.pop(k, None)
            continue
        at[k] = {"v": str(v), "by": "words"}
        set_ += 1
        sample.append((p["opened"], pre["label"], v, score, texts[v - 1]))
    save(at)
    print(f"picked {set_} verses by shared words; kept {kept}")
    random.seed(1)
    for o, lab, v, score, t in random.sample(sample, min(args.show, len(sample))):
        print(f"- {o} ← {lab}: verse {v} ({score} words) {t[:90]}")


if __name__ == "__main__":
    main()
