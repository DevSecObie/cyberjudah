#!/usr/bin/env python3
"""Collapse a per-line timestamped transcript into timestamped paragraphs."""
import re, sys
src = open(sys.argv[1], encoding='utf-8').read()
body = src.split('# Transcript', 1)[1] if '# Transcript' in src else src
rows = []
for line in body.split('\n'):
    m = re.match(r'^\[(\d+(?:\.\d+)?)s\]\s*(.*)$', line.strip())
    if m: rows.append((float(m.group(1)), m.group(2).strip()))
def mmss(s):
    s = int(s); h, rem = divmod(s, 3600); m, sec = divmod(rem, 60)
    return f"{h}:{m:02d}:{sec:02d}" if h else f"{m}:{sec:02d}"
out, buf, start = [], [], None
for t, txt in rows:
    if start is None: start = t
    buf.append(txt)
    if sum(len(x)+1 for x in buf) > 700:
        out.append(f"[{mmss(start)}] " + " ".join(buf)); buf, start = [], None
if buf: out.append(f"[{mmss(start)}] " + " ".join(buf))
open(sys.argv[2],'w',encoding='utf-8').write("\n\n".join(out))
print(f"{len(rows)} lines -> {len(out)} paragraphs, {sum(len(o) for o in out)} chars")
