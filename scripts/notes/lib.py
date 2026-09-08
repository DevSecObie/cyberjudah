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

def W(ref, ts=None, walk=()):
    """A scripture walked verse by verse, the way it is taught on air: one linked heading for
    the whole passage, then each verse (or the small group he read together) quoted, followed
    at once by what he said about it. walk = [("1", [notes]), ("3-4", [notes]), ...]. The
    commentary is his words about the verse; it never re-reads the verse.
    A note that starts "**Name:** " is that speaker's line; unlabelled lines are the teacher's."""
    book, ch, vs, spec = parse(ref)
    head = f"**[{book} {ch}:{spec}](/bible/{SLUG[book]}/{ch}#v{vs[0]})**"
    if ts: head += f"  *[{ts}]*"
    parts = [head, ""]
    covered = []
    for vspec, notes in walk:
        _, _, gv, _ = parse(f"{book} {ch}:{vspec}")
        covered += gv
        parts += [quote(book, ch, gv), ""]
        for n in notes: parts += [f"- {n}", ""]
    missing = [v for v in vs if v not in covered]
    if missing: raise SystemExit(f"{ref}: verses {missing} in the heading but not walked")
    return "\n".join(parts)

def R(source, ts=None, walk=(), reader=None):
    """A reading from a book, article or clip: the source line, then each stretch read as a
    blockquote followed at once by the commentary on it. source is the citation as stated on
    air ("*History of the Jews*, Heinrich Graetz, on the Greek games"); reader names who is
    reading when it is not the teacher. walk = [([paragraphs], [notes]), ...]."""
    head = f"Reading from {source}"
    if reader: head += f" · read by {reader}"
    if ts: head += f"  *[{ts}]*"
    parts = ['<div class="reading">', "", head, ""]
    for paras, notes in walk:
        parts += ["\n>\n".join(f"> {p}" for p in paras), ""]
        for n in notes: parts += [f"- {n}", ""]
    parts += ["</div>", ""]
    return "\n".join(parts)
