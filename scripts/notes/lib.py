import json, re, unicodedata
import os
ROOT = os.environ.get("CJ_ROOT") or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
IDX = json.load(open(f"{ROOT}/data/bible/index.json"))
SLUG = {e["book"]: e["slug"] for e in IDX}
BYLOW = {e["book"].lower(): e["book"] for e in IDX}
ALIAS = {"psalm": "Psalms", "ecclesiasticus": "Sirach"}
_c = {}
def chapters(b):
    if b not in _c: _c[b] = json.load(open(f"{ROOT}/data/bible/{SLUG[b]}.json"))["chapters"]
    return _c[b]
def resolve(n):
    n = " ".join(n.strip().split())
    if n.lower() in ALIAS: return ALIAS[n.lower()]
    if n.lower() in BYLOW: return BYLOW[n.lower()]
    raise SystemExit(f"unknown book {n!r}")
def parse(ref):
    m = re.match(r"^\s*(.+?)\s+(\d+):([\d,\-]+)\s*$", ref)
    if not m: raise SystemExit(f"bad ref {ref!r}")
    book, ch, spec = resolve(m.group(1)), int(m.group(2)), m.group(3)
    vs = []
    for p in spec.split(","):
        if "-" in p:
            a, b = [int(x) for x in p.split("-")]; vs += list(range(a, b+1))
        else: vs.append(int(p))
    return book, ch, vs, spec
def quote(book, ch, vs, indent=""):
    body = chapters(book)[str(ch)]
    out = []
    for v in vs:
        if v > len(body): raise SystemExit(f"{book} {ch} has {len(body)} verses, asked v{v}")
        t = unicodedata.normalize("NFC", body[v-1]).replace("<", "&lt;")
        out.append(f"{indent}> <sup>[{v}](/bible/{SLUG[book]}/{ch}#v{v})</sup> {t}")
    return f"\n{indent}>\n".join(out)
def S(ref, ts=None, notes=()):
    """A main scripture block: linked heading, the verses, then teaching bullets."""
    book, ch, vs, spec = parse(ref)
    head = f"**[{book} {ch}:{spec}](/bible/{SLUG[book]}/{ch}#v{vs[0]})**"
    if ts: head += f"  *[{ts}]*"
    parts = [head, "", quote(book, ch, vs), ""]
    for n in notes: parts += [f"- {n}", ""]
    return "\n".join(parts)
def P(items):
    """A nested Precepts block under the preceding bullet."""
    out = ["  Precepts:"]
    for ref, note in items:
        book, ch, vs, spec = parse(ref)
        out.append(f"  - **[{book} {ch}:{spec}](/bible/{SLUG[book]}/{ch}#v{vs[0]})**")
        out.append(quote(book, ch, vs, indent="    "))
        out.append("")
        out.append(f"    {note}")
    out.append("")
    return "\n".join(out)
