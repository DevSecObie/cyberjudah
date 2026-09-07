#!/usr/bin/env python3
"""Score a brief from prep.py against references collected by hand.

    prep-score.py <brief.md> "Book c:v|Book c:v|..."

Prints recall and anything found that is not in the hand list. This is how the numbers in
prep.py's header were measured, and how to tell whether a change to the extraction patterns
is an improvement or a regression -- two of mine were regressions, and only this caught them.
Matching is on the starting verse, since a teacher rarely announces the end of a range.
"""
import re,sys
brief,truth=sys.argv[1],set(sys.argv[2].split("|"))
found=set()
for l in open(brief):
    m=re.match(r"^- `([A-Z0-9].*?)`",l)
    if m: found.add(m.group(1))
base=lambda s:s.split("-")[0]
fb={base(x) for x in found}; tb={base(x) for x in truth}
print(f"  found {len(found)} · recall {len(tb&fb)}/{len(tb)} = {len(tb&fb)/len(tb)*100:.0f}% · wrong-book/extra {len(fb-tb)}")
if tb-fb: print("  missed:",", ".join(sorted(tb-fb)))
if fb-tb: print("  extra :",", ".join(sorted(fb-tb)))
