"""Edit the `teacher` field across every class and episode note.

    teachers.py                      what every note says now, and what is missing
    teachers.py export [file.tsv]    one editable row per note (default: teachers.tsv)
    teachers.py apply  [file.tsv]    write that file back into the frontmatter
    teachers.py set <slug> <name>    one note, without the round trip
    teachers.py rename <old> <new>   the same person under two spellings, everywhere
    teachers.py variants             names close enough to be the same person

Most notes never say who taught, so the field is filled in by hand. Opening ninety-seven
markdown files to do that is the problem this solves: `export` puts every note on one line
with the evidence already pulled out of it, you edit the second column in one pass, and
`apply` writes the names back.

The frontmatter stays the source of record. Nothing here caches or duplicates it; export
reads it fresh each time, so an exported file that has gone stale can simply be regenerated.
Names are written with their own title -- "Captain Noah", "Deacon Malachi" -- because the
browse pages derive the rank from that leading word to group the filter chips.
"""
import os, re, sys, glob, unicodedata

ROOT = os.environ.get("CJ_ROOT") or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FEEDS = [("blog", "class"), ("captains", "episode")]
TITLES = ("Bishop", "Deacon", "Captain", "Elder", "Officer")
DEFAULT_TSV = os.path.join(ROOT, "teachers.tsv")

MENTION = re.compile(r"\b(%s)\s+([A-Z][A-Za-z]+)(?:'s)?" % "|".join(TITLES))


def notes():
    """Every note, in feed then filename order: (path, slug, title, teacher, body)."""
    out = []
    for feed, kind in FEEDS:
        for path in sorted(glob.glob(os.path.join(ROOT, feed, "*", "*.md"))):
            text = open(path, encoding="utf-8").read()
            if not text.startswith("---\n"):
                continue
            end = text.index("\n---\n", 4)
            head, body = text[4:end].split("\n"), text[end + 5:]
            get = lambda k: next((re.sub(r'^%s:\s*"?(.*?)"?\s*$' % k, r"\1", l)
                                  for l in head if l.startswith(k + ":")), "")
            out.append(dict(path=path, kind=kind, slug=get("slug"), title=get("title"),
                            teacher=get("teacher"), body=body))
    return out


def evidence(n, width=110):
    """The line most likely to say who taught, for a note that does not record it.

    Returns (name, confidence, context). Every title+name in the note is a candidate, but most
    are people greeted, prayed for, or whose *other* class is being referred to. So the verb
    has to be bound to the name, not merely present in the same sentence: "a continuation of
    Deacon Malachi's class" and "Referenced in class: Captain Gideon's class" both name a
    teacher of some other class, and both read as confident if you only look for the word
    "class" nearby.

    "strong" means the sentence says this person taught this class. "weak" means they are in
    the room. A weak suggestion is a place to look, not an answer."""
    body = n["body"]
    # Announcements sit at the end and are full of names from other congregations; the
    # teacher, when named at all, is named as the class opens.
    for tail in ("## Announcements", "## In Closing"):
        cut = body.find(tail)
        if cut > 0:
            body = body[:cut]
    start = body.find("## Introduction")
    hay = body[start:start + 4000] if start >= 0 else body[:4000]
    if not MENTION.search(hay):
        hay = body[:12000]   # nobody named as it opens; he may be named later, or not at all

    scored = []
    for m in MENTION.finditer(hay):
        name = f"{m.group(1)} {m.group(2)}"
        lo, hi = max(0, m.start() - 90), min(len(hay), m.end() + 90)
        ctx = " ".join(hay[lo:hi].split())
        # The possessive is about that person's own class, not this one.
        possessive = hay[m.end():m.end() + 2] == "'s"
        n_re = re.escape(name)
        teaches = re.search(rf"{n_re}\s+(?:teaches|is teaching|taught)\b", hay[lo:hi], re.I)
        by = re.search(rf"(?:taught by|class from)\s+{n_re}", hay[lo:hi], re.I)
        intro = re.search(rf"(?:it is|this is|my name is|i am|i'm)\s+{n_re}", hay[lo:hi], re.I)
        rank = 0 if (teaches or by) and not possessive else 1 if intro else 2 if possessive else 3
        scored.append((rank, m.start(), name, ctx))
    scored.sort()
    if not scored:
        return "", "", ""
    rank, _, name, ctx = scored[0]
    return name, ("strong" if rank <= 1 else "weak"), ctx[:width]


def set_teacher(path, name):
    """Write (or clear, with an empty name) the field, leaving the rest of the file alone."""
    text = open(path, encoding="utf-8").read()
    end = text.index("\n---\n", 4)
    head, body = text[4:end].split("\n"), text[end + 5:]
    head = [l for l in head if not l.startswith("teacher:")]
    if name:
        # After `date:` where there is one, which is where the existing notes carry it.
        at = next((i for i, l in enumerate(head) if l.startswith("date:")), len(head) - 1)
        head.insert(at + 1, 'teacher: "%s"' % name.replace('"', '\\"'))
    out = "---\n" + "\n".join(head) + "\n---\n" + body
    if out == text:
        return False
    open(path, "w", encoding="utf-8").write(out)
    return True


def norm(name):
    """A loose key for spotting one person spelled two ways."""
    s = unicodedata.normalize("NFKD", name.lower())
    s = re.sub(r"[^a-z ]", "", s)
    title, _, rest = s.partition(" ")
    # Vowels and doubled letters are where these names disagree: Yawasap / Yahwasap.
    rest = re.sub(r"(.)\1+", r"\1", rest)
    rest = re.sub(r"[aeiou]", "", rest)
    return title + " " + rest


def cmd_list(argv):
    rows = notes()
    named = [n for n in rows if n["teacher"]]
    print(f"{len(rows)} notes · {len(named)} with a teacher · {len(rows) - len(named)} without\n")
    for n in rows:
        mark = " " if n["teacher"] else "?"
        print(f"{mark} {n['slug'][:58]:60} {n['teacher'] or '-'}")
    return 0


def cmd_export(argv):
    dest = argv[0] if argv else DEFAULT_TSV
    rows = notes()
    with open(dest, "w", encoding="utf-8") as f:
        f.write("# Edit the `teacher` column, then: scripts/notes/teachers.py apply\n")
        f.write("# suggested/confidence/evidence are read-only hints; blank teacher = not recorded.\n")
        f.write("# confidence 'strong' = the sentence says he taught; 'weak' = he is only mentioned.\n")
        f.write("slug\tteacher\tsuggested\tconfidence\tevidence\n")
        for n in rows:
            sug, conf, ctx = ("", "", "") if n["teacher"] else evidence(n)
            f.write("\t".join([n["slug"], n["teacher"], sug, conf, ctx]) + "\n")
    missing = sum(1 for n in rows if not n["teacher"])
    print(f"wrote {dest} · {len(rows)} notes, {missing} without a teacher")
    return 0


def cmd_apply(argv):
    src = argv[0] if argv else DEFAULT_TSV
    if not os.path.exists(src):
        print(f"no such file: {src}\nRun `teachers.py export` first.", file=sys.stderr)
        return 1
    want = {}
    for line in open(src, encoding="utf-8"):
        if line.startswith("#") or line.startswith("slug\t") or not line.strip():
            continue
        parts = line.rstrip("\n").split("\t")
        want[parts[0]] = (parts[1].strip() if len(parts) > 1 else "")
    rows = {n["slug"]: n for n in notes()}
    unknown = [s for s in want if s not in rows]
    for s in unknown:
        print(f"  ignored, no note with slug {s!r}", file=sys.stderr)
    changed = cleared = 0
    for slug, name in want.items():
        n = rows.get(slug)
        if not n or name == n["teacher"]:
            continue
        bad = name and not name.startswith(TITLES)
        if bad:
            print(f"  {slug}: {name!r} has no rank title; the browse chips group by it", file=sys.stderr)
        if set_teacher(n["path"], name):
            changed += 1
            if not name:
                cleared += 1
    print(f"{changed} notes updated ({cleared} cleared){', %d unknown slugs skipped' % len(unknown) if unknown else ''}")
    return 0


def cmd_set(argv):
    if len(argv) < 2:
        print("usage: teachers.py set <slug-or-fragment> <name>", file=sys.stderr)
        return 1
    frag, name = argv[0], argv[1]
    hits = [n for n in notes() if frag == n["slug"] or frag in n["slug"]]
    if len(hits) != 1:
        print(f"{len(hits)} notes match {frag!r}" + ("" if not hits else ":"), file=sys.stderr)
        for h in hits[:10]:
            print("   " + h["slug"], file=sys.stderr)
        return 1
    print(("set " if set_teacher(hits[0]["path"], name) else "unchanged ") + hits[0]["slug"] + " -> " + (name or "(cleared)"))
    return 0


def cmd_rename(argv):
    if len(argv) < 2:
        print("usage: teachers.py rename <old> <new>", file=sys.stderr)
        return 1
    old, new = argv[0], argv[1]
    n = sum(1 for x in notes() if x["teacher"] == old and set_teacher(x["path"], new))
    print(f"{n} notes renamed {old!r} -> {new!r}" if n else f"no note has teacher {old!r}")
    return 0


def cmd_variants(argv):
    groups = {}
    for n in notes():
        if n["teacher"]:
            groups.setdefault(norm(n["teacher"]), {}).setdefault(n["teacher"], 0)
            groups[norm(n["teacher"])][n["teacher"]] += 1
    found = 0
    for key, spellings in sorted(groups.items()):
        if len(spellings) < 2:
            continue
        found += 1
        print("possibly one person:")
        for name, count in sorted(spellings.items(), key=lambda x: -x[1]):
            print(f"   {count:3}  {name}")
        keep = max(spellings, key=lambda k: spellings[k])
        for name in spellings:
            if name != keep:
                print(f"   -> scripts/notes/teachers.py rename {name!r} {keep!r}")
    print("no name appears under two spellings" if not found else "")
    return 0


CMDS = {"list": cmd_list, "export": cmd_export, "apply": cmd_apply,
        "set": cmd_set, "rename": cmd_rename, "variants": cmd_variants}

if __name__ == "__main__":
    argv = sys.argv[1:]
    cmd = argv[0] if argv and argv[0] in CMDS else "list"
    sys.exit(CMDS[cmd](argv[1:] if argv and argv[0] in CMDS else argv))
