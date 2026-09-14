#!/usr/bin/env python3
"""Score prep.py's reference extraction against every finished note.

    prep-corpus.py                 the whole corpus
    prep-corpus.py <videoId> ...   just these classes
    prep-corpus.py --worst 15      the classes it does worst on, to find the next pattern

prep-score.py scores one brief against a list typed by hand, which is how the first numbers
were measured and is the right tool when you have just collected a list. This scores against
the notes instead: every scripture block in a finished note was written from the recording
and validated byte-for-byte by check.py, so the notes that have a transcript are a standing
corpus of about 2,600 references that costs nothing to re-run.

Use it the way prep.py's header says: measure, change one thing, measure again. Two pattern
changes that looked obviously right were regressions, and only scoring caught them.

Matching is on (book, chapter, first verse). A range is matched on where it starts because a
teacher rarely announces where it ends.

"found but not in the note" is not an error to drive to zero. A class cites far more than it
stops to read; the note records only what was taught as a block. Watch it for a jump that
means a pattern has started matching things that are not references at all.
"""
import glob, json, os, re, sys

ROOT = os.environ.get("CJ_ROOT") or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "scripts", "notes"))
import prep


def corpus():
    """(videoId, note path, [reference strings]) for every note whose transcript we still have."""
    out = []
    for note in sorted(glob.glob(f"{ROOT}/blog/*/*.md") + glob.glob(f"{ROOT}/captains/*/*.md")):
        body = open(note, encoding="utf-8").read()
        m = re.search(r'data-video-id="([\w-]{11})"', body)
        if not m:
            continue
        vid = m.group(1)
        if not os.path.exists(f"{ROOT}/blog/transcripts/{vid}.json"):
            continue
        refs = re.findall(r"^\*\*\[([^\]]+)\]\(/bible/", body, re.M)
        if refs:
            out.append((vid, os.path.relpath(note, ROOT), refs))
    return out


def key_of(ref):
    """'2 Esdras 9:7-12' -> ('2 Esdras', 9, 7), resolved so 'Ecclesiasticus' scores as Sirach."""
    m = re.match(r"^(.*?)\s+(\d+):(\d+)", ref)
    if not m:
        return None
    return (prep.resolve_book(m.group(1)) or m.group(1), int(m.group(2)), int(m.group(3)))


def main(argv):
    worst = 0
    if "--worst" in argv:
        i = argv.index("--worst")
        worst = int(argv[i + 1])
        del argv[i:i + 2]
    only = set(argv)

    hits = total = found_n = extra_n = 0
    rows = []
    for vid, note, refs in corpus():
        if only and vid not in only:
            continue
        segs = json.load(open(f"{ROOT}/blog/transcripts/{vid}.json"))["segments"]
        found = {(r["book"], r["chapter"], r["first"]) for r in prep.extract(" ".join(t for _, t in segs))}
        want = {k for k in (key_of(r) for r in refs) if k}
        if not want:
            continue
        hit = want & found
        hits += len(hit); total += len(want); found_n += len(found); extra_n += len(found - want)
        rows.append((len(hit) / len(want), vid, len(hit), len(want), len(found - want), note))

    if not rows:
        print("no classes matched"); return 1
    print(f"corpus : {len(rows)} classes · {total} references from the notes")
    print(f"recall : {hits}/{total} = {hits / total * 100:.1f}%")
    print(f"found  : {found_n}  ·  found but not opened in the note: {extra_n}")
    if worst:
        print(f"\nworst {worst}:")
        for r, vid, h, w, x, note in sorted(rows)[:worst]:
            print(f"  {r * 100:5.1f}%  {h:>3}/{w:<3} +{x:<4} {vid}  {os.path.basename(note)[:56]}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
