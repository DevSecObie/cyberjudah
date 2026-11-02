#!/usr/bin/env python3
"""Re-lay a written note verse by verse, the way the class read it, without changing a word.

Older notes quote the whole passage first and list every comment under it. This walks each
passage instead: the verse (or the verses read straight through) is quoted, then the comments
that open on its words ("Lay siege against it: ..."), then the next verse. A comment that does
not open on the words of a verse stays with the one before it; precepts nested under a comment
move with it. The verse text is the note's own quote, cut at each verse, so nothing is re-quoted.

A passage that is already walked, or holds anything but its quote and its bullets, is left as it is.

  scripts/notes/relayout.py FILE...          rewrite in place, print what changed
  scripts/notes/relayout.py --check FILE...  print only; exit 1 if any note would change
"""
import re, sys, os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib  # noqa: E402
from auto import _verses_of  # noqa: E402

HEAD = re.compile(r"^\*\*\[([^\]]+)\]\(/bible/[^)]+\)\*\*")
SUP = re.compile(r"^> <sup>\[(\d+)\]")
# a line that starts the next unit of the note
STOP = re.compile(r"^(\*\*\[|\*\[|<div|<p |## |---|<span)")


def chunks(lines):
    """The block body as ("q", verse, [lines]) and ("b", [lines]) chunks, or None if it holds
    anything else."""
    out = []
    for ln in lines:
        if not ln.strip():
            if out and out[-1][0] == "b": out[-1][2].append(ln)
            continue
        if ln.startswith(">"):
            m = SUP.match(ln)
            if m:
                out.append(["q", int(m.group(1)), [ln]])
            elif ln.strip() == ">" and out and out[-1][0] == "q":
                continue  # the blank quote line between two verses
            elif out and out[-1][0] == "q":
                out[-1][2].append(ln)
            else:
                return None
        elif ln.startswith("- "):
            out.append(["b", None, [ln]])
        elif ln.startswith("  ") and out and out[-1][0] == "b":
            out[-1][2].append(ln)
        else:
            return None
    for c in out:
        if c[0] == "b":
            while c[2] and not c[2][-1].strip(): c[2].pop()
    return out


def walk(head, body):
    """The block re-laid, or None to leave it."""
    m = HEAD.match(head)
    if not m: return None
    try:
        book, ch, vs, _ = lib.parse(m.group(1))
    except SystemExit:
        return None
    cs = chunks(body)
    if not cs: return None
    kinds = "".join(c[0] for c in cs)
    # only the old shape: every verse quoted first, then the comments
    if not re.fullmatch(r"q+b+", kinds): return None
    quotes = {c[1]: c[2] for c in cs if c[0] == "q"}
    if sorted(quotes) != vs: return None
    bullets = [c[2] for c in cs if c[0] == "b"]
    steps = []
    for b in bullets:
        at = _verses_of(b[0][2:], book, ch, vs)
        if at and (not steps or steps[-1][0] != at):
            steps.append([at, [b]])
        elif steps:
            steps[-1][1].append(b)
        else:
            steps.append([None, [b]])
    placed = [at for at, _ in steps if at]
    if not placed: return None
    # verses must be met in reading order, or the class went back: leave it whole
    if any(b[0] < a[1] for a, b in zip(placed, placed[1:])): return None
    if len(steps) == 1 and steps[0][0] == (vs[0], vs[-1]): return None
    parts, quoted = [head], set()

    def q(a, b):
        out = []
        for v in range(a, b + 1):
            if out: out.append(">")
            out += quotes[v]
        return "\n".join(out)

    for at, items in steps:
        if at:
            a, b = at
            while a - 1 in vs and a - 1 not in quoted and a - 1 > max(quoted, default=vs[0] - 1):
                a -= 1
            a = max(a, max(quoted, default=vs[0] - 1) + 1)
            if a <= b:
                parts.append(q(a, b)); quoted.update(range(a, b + 1))
        for it in items:
            parts.append("\n".join(it))
    rest = [v for v in vs if v not in quoted]
    if rest:
        if rest != list(range(rest[0], vs[-1] + 1)): return None
        parts.append(q(rest[0], rest[-1]))
    if len(parts) == len(bullets) + 2 and steps[0][0] is None: return None
    return "\n\n".join(parts)


def relayout(text):
    lines = text.split("\n")
    out, i, n = [], 0, 0
    while i < len(lines):
        ln = lines[i]
        if HEAD.match(ln):
            j = i + 1
            while j < len(lines) and not STOP.match(lines[j]): j += 1
            body = lines[i + 1:j]
            trail = 0
            while body and not body[-1].strip(): body.pop(); trail += 1
            new = walk(ln, body)
            if new:
                out += new.split("\n") + [""] * trail; n += 1
            else:
                out += lines[i:j]
            i = j
            continue
        out.append(ln); i += 1
    return "\n".join(out), n


def main(argv):
    check = "--check" in argv
    files = [a for a in argv if not a.startswith("--")]
    changed = 0
    for f in files:
        t = open(f).read()
        new, n = relayout(t)
        if new != t:
            changed += 1
            print(f"{f}: {n} passage(s) walked")
            if not check: open(f, "w").write(new)
    print(f"{changed} note(s) {'would change' if check else 'changed'}")
    return 1 if check and changed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
