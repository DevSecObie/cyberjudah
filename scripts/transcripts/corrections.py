#!/usr/bin/env python3
"""Scripture-aware caption corrections, kept beside the captions, never in place of them.

The transcripts are YouTube auto-captions. They hear a book or a feast word as something else:
"second edges" for 2 Esdras, "villa cos 23" for Leviticus 23, "11 bread" for unleavened bread.
This pass finds only those clear transcription errors and writes each one, with the caption's
own words, to

  data/transcripts/corrections.json
    {"<video>": [[segment index, second, "caption text", "corrected text", "rule"], ...]}

The transcript files are not changed, so nothing is silently rewritten: a reader, a search or a
tool can show the corrected words and the caption side by side. Each rule names a book or term
of the 1611 King James Bible with the Apocrypha, fires only in the setting that makes it
unambiguous (a book name followed by a chapter number, a feast word next to "bread"), and was
counted in the transcripts before it was added. Wording and teaching are never touched:
"holy conversation" (2 Peter 3:11) is the King James, not an error, and stays.

Not corrected here, because they need the audio: names and words that could be either (for
example "Herod's mother and father", which may be "Christ's"). They are listed with --review.

  python3 scripts/transcripts/corrections.py            # write the corrections file
  python3 scripts/transcripts/corrections.py --report   # counts per rule, and examples
"""
import glob, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "data", "transcripts", "corrections.json")
FEEDS = ("blog", "captains", "history")

ORD = r"(first|second|1st|2nd|1|2|i|ii)"
NUMBER_AFTER = r"(?=[\s,.]+(?:chapter\b|\d))"
ORD_WORD = {"first": "1", "1st": "1", "1": "1", "i": "1", "second": "2", "2nd": "2", "2": "2", "ii": "2"}

# (rule id, pattern, replacement): the pattern must match the caption as written (any case).
RULES = [
    ("esdras-edges", re.compile(r"\b" + ORD + r"\s+edges?\b" + NUMBER_AFTER, re.I), lambda m: f"{ORD_WORD[m.group(1).lower()]} Esdras"),
    ("leviticus-villa-cos", re.compile(r"\bvilla\s*c[ou]s\b" + NUMBER_AFTER, re.I), lambda m: "Leviticus"),
    ("unleavened-11-bread", re.compile(r"\b(?:11|eleven)\s+bread\b", re.I), lambda m: "unleavened bread"),
    ("ecclesiasticus-split", re.compile(r"\becclesiastic\s+us\b", re.I), lambda m: "Ecclesiasticus"),
    ("sirach-sirac", re.compile(r"\bsirac\b" + NUMBER_AFTER, re.I), lambda m: "Sirach"),
    ("maccabees-macabees", re.compile(r"\bmacabees\b", re.I), lambda m: "Maccabees"),
]

# Things a reader asked about that only the audio can settle: listed, never changed.
REVIEW = [
    ("herods-mother-and-father", re.compile(r"\bherod'?s mother and father\b", re.I)),
]


def correct(text):
    """(corrected text, [rule ids]) for one caption, or (text, []) when nothing applies."""
    fired = []
    for rid, pat, rep in RULES:
        new = pat.sub(rep, text)
        if new != text:
            fired.append(rid); text = new
    return text, fired


def main(argv):
    report = "--report" in argv
    review = "--review" in argv
    out, counts, examples = {}, {}, {}
    for d in FEEDS:
        for f in sorted(glob.glob(os.path.join(ROOT, d, "transcripts", "*.json"))):
            t = json.load(open(f, encoding="utf-8"))
            vid = t.get("videoId") or os.path.basename(f)[:-5]
            segs = t.get("segments") or []
            for i, (sec, text) in enumerate(segs):
                # A book name and its chapter number can fall in two captions: test the pair.
                nxt = segs[i + 1][1] if i + 1 < len(segs) else ""
                fixed, fired = correct(f"{text} \x00{nxt}")
                fixed = fixed.split(" \x00")[0]
                if review:
                    for rid, pat in REVIEW:
                        if pat.search(text): print(f"{rid}\t{vid}\t{int(sec)}\t{text}")
                if not fired or fixed == text: continue
                out.setdefault(vid, []).append([i, sec, text, fixed, "+".join(fired)])
                for rid in fired:
                    counts[rid] = counts.get(rid, 0) + 1
                    examples.setdefault(rid, []).append((vid, int(sec), text, fixed))
    if review: return
    if report:
        for rid, n in sorted(counts.items(), key=lambda x: -x[1]):
            print(f"{rid}: {n}")
            for vid, sec, a, b in examples[rid][:3]: print(f"   {vid}@{sec}  “{a}” -> “{b}”")
        return
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(dict(sorted(out.items())), open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"{sum(counts.values())} corrections in {len(out)} transcripts: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items(), key=lambda x: -x[1])))


if __name__ == "__main__":
    main(sys.argv[1:])
