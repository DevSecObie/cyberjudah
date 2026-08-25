"""Build the Obsidian vault at vault/ from the project data.

  Laws/        one note per handbook section, one heading per law (140 notes, 1,562 headings)
  Precepts/    one note per precept-index topic (445 notes)
  Scripture/   one note per chapter, KJV text with a block id per verse (canon + Apocrypha)
  Cases/       one note per case study, grouped by era (seeded from scripts/cases_*.py)
  Home.md      the index

Everything except Cases/ is regenerated on every run: those notes are derived from the PDFs
and the KJV and are not meant to be edited by hand (a banner at the top of each says so).
Cases/ is the other way round: the vault is the source of truth. The generator only writes a
case note when the file does not exist yet, so your edits survive a rebuild. Pass --force-cases
to overwrite them from the Python seed anyway.

usage: python3 scripts/build_vault.py [--force-cases] [--vault PATH]
then:  python3 scripts/build_cases.py > data/cases.json   (reads the vault back)
"""
import json, os, re, sys, glob, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from cases_lib import ERA_ORDER, VERDICTS

DATA = os.path.join(HERE, "..", "data")
VAULT = os.path.abspath(os.path.join(HERE, "..", "vault"))
if "--vault" in sys.argv: VAULT = os.path.abspath(sys.argv[sys.argv.index("--vault") + 1])
FORCE_CASES = "--force-cases" in sys.argv
# --target cyberjudah: write Law/, Precepts/, Cases/ into an existing CyberJudah-style vault (the
# DevSecObie/cyberjudah layout: Bible/<NN - Book>/<Book N>.md with ^vN verse anchors, Study Bible/,
# Encyclopedia/). Scripture notes are NOT generated; links point at the vault's own Bible files.
TARGET = sys.argv[sys.argv.index("--target") + 1] if "--target" in sys.argv else ("cyberjudah" if os.path.isdir(os.path.join(VAULT, "Bible")) else "standalone")
CJ = TARGET == "cyberjudah"

handbook = json.load(open(os.path.join(DATA, "handbook.json")))
precepts = json.load(open(os.path.join(DATA, "precepts.json")))
BIBLE_INDEX = json.load(open(os.path.join(DATA, "bible", "index.json")))

GEN = "> [!info]- Generated\n> This note is built from the source data by `scripts/build_vault.py` and is overwritten on every run. Put your own notes in a separate file and link here.\n\n"

def safe(name):  # Obsidian filename
    return re.sub(r'[\\/:*?"<>|]', "-", name).strip()

def clip(text, n=110):
    text = text.strip()
    if len(text) <= n: return text
    cut = text[:n].rsplit(" ", 1)[0]
    return cut.rstrip(",;:") + " ..."

def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f: f.write(text)

# ---------- scripture ---------------------------------------------------------------------
ALL_BOOKS = [e["book"] for e in BIBLE_INDEX]
CANON = ALL_BOOKS[:66]
APOCRYPHA = ALL_BOOKS[66:]
apoc = {b: None for b in APOCRYPHA}  # membership only
def testament(b): return "Apocrypha" if b in apoc else ("New Testament" if CANON.index(b) >= 39 else "Old Testament")

def load_bible():
    """book -> {chapter:int -> [verse texts]}"""
    out = {}
    for e in BIBLE_INDEX:
        d = json.load(open(os.path.join(DATA, "bible", e["slug"] + ".json"), encoding="utf-8"))
        out[e["book"]] = {int(c): vs for c, vs in d["chapters"].items()}
    return out
bible = load_bible()

CJ_BOOK = {"Sirach": "Ecclesiasticus", "Esther (Greek)": "Additions to Esther", "Prayer of Manasseh": "Prayer of Manasses",
           "Song of the Three Children": "Prayer of Azariah", "Epistle of Jeremiah": "Baruch"}
def cj_book_chapter(book, ch):
    if book == "Epistle of Jeremiah": return "Baruch", 6   # bound as Baruch 6 in that vault
    return CJ_BOOK.get(book, book), ch
def chapter_note(book, ch):
    if CJ: book, ch = cj_book_chapter(book, ch)
    return f"{book} {ch}"
def book_note(book):
    return f"Book of {CJ_BOOK.get(book, book)}" if CJ else book
def anchor_ok(book, ch):  # Prayer of Manasses is one block in that vault; link the chapter only
    return not (CJ and book == "Prayer of Manasseh")
def first_verse(verses):
    m = re.match(r"(\d+)", verses or "")
    return int(m.group(1)) if m else None
def ref_link(r, label=None):
    """[[Genesis 4#^v3|Genesis 4:3-8]]"""
    text = label or (f"{r['book']} {r['chapter']}:{r['verses']}" if r.get("verses") else f"{r['book']} {r['chapter']}")
    v = first_verse(r.get("verses"))
    if v and anchor_ok(r["book"], r["chapter"]): return f"[[{chapter_note(r['book'], r['chapter'])}#^v{v}|{text}]]"
    return f"[[{chapter_note(r['book'], r['chapter'])}|{text}]]"
def verse_embeds(r, cap=8):
    """![[Genesis 4#^v3]] ... for each verse in the range, the way the CyberJudah study notes do it."""
    if not anchor_ok(r["book"], r["chapter"]): return []
    out = []
    for part in filter(None, (r.get("verses") or "").split(",")):
        lo, _, hi = part.partition("-")
        for v in range(int(lo), int(hi or lo) + 1):
            out.append(f"![[{chapter_note(r['book'], r['chapter'])}#^v{v}]]")
    return out[:cap]

# ---------- CyberJudah vault: study notes and encyclopedia ---------------------------------
STUDY = {}      # (book, chapter) -> ("Judges 5-8 Study Notes", "Judges 5-8")
LEXICON = []    # [(topic, [terms])]
def load_cj(root):
    for path in glob.glob(os.path.join(root, "Study Bible", "*", "*", "* Study Notes.md")):
        stem = os.path.splitext(os.path.basename(path))[0]
        m = re.match(r"^(.*?) (\d+)(?:-(\d+))? Study Notes$", stem)
        if not m: continue
        book, a, b = m.group(1), int(m.group(2)), int(m.group(3) or m.group(2))
        for ch in range(a, b + 1): STUDY[(book, ch)] = (stem, f"{book} {a}-{b}" if b > a else f"{book} {a}")
    lex = os.path.join(root, "..", "_tools", "lexicon.tsv")
    if not os.path.exists(lex): lex = os.path.join(root, "_tools", "lexicon.tsv")
    if os.path.exists(lex):
        import csv
        with open(lex, encoding="utf-8-sig") as f:
            for row in csv.DictReader(f, delimiter="\t"):
                LEXICON.append((row["topic"], [t.strip().lower() for t in row["terms"].split(";") if t.strip()]))
def taught_in(r):
    hit = STUDY.get((CJ_BOOK.get(r["book"], r["book"]), r["chapter"]))
    return f"  taught in [[{hit[0]}|{hit[1]}]]" if hit else ""
def encyclopedia_links(c):
    hay = " ".join([c["charge"], c["summary"], " ".join(c["themes"]), " ".join(c["topics"])]).lower()
    return [t for t, terms in LEXICON if any(re.search(r"\b" + re.escape(term) + r"\b", hay) for term in terms)]

# ---------- indexes of who cites what (for the "Cited by" sections) ----------------------
cited = {}  # (book, ch) -> list of (kind, link, verses)
def cite(book, ch, kind, link, verses): cited.setdefault((book, ch), []).append((kind, link, verses))

# ---------- laws ---------------------------------------------------------------------------
sections_by_id = {}
def law_note_name(sec): return safe(f"{sec['id']} {sec['title']}")
def law_link(id_):
    sid, _, n = id_.partition(".")
    sec = sections_by_id.get(sid.upper())
    if not sec: return id_
    return f"[[{law_note_name(sec)}#{sid.upper()}.{n}|{sid.upper()}.{n}]]" if n else f"[[{law_note_name(sec)}|{sid.upper()} {sec['title']}]]"
def part_note_name(p): return safe(f"Part {p['n']:02d} {p['title']}")
LAWS = "Law" if CJ else "Laws"
HOME = "[Home](/)" if CJ else "[[Home]]"

for p in handbook["parts"]:
    for s in p["sections"]: sections_by_id[s["id"]] = s

def build_laws():
    shutil.rmtree(os.path.join(VAULT, LAWS), ignore_errors=True)
    for p in handbook["parts"]:
        pn = part_note_name(p)
        lines = [f"---\npart: {p['n']}\ntitle: \"{p['title']}\"\ntags: [law-part]\n---\n", GEN, f"# Part {p['n']} · {p['title']}\n", f"{HOME}\n"]
        for s in p["sections"]:
            lines.append(f"- [[{law_note_name(s)}|{s['id']} · {s['title']}]] ({len(s['entries'])} laws)")
        write(os.path.join(VAULT, LAWS, pn + ".md"), "\n".join(lines) + "\n")
        for s in p["sections"]:
            nm = law_note_name(s)
            out = [f"---\nid: {s['id']}\npart: {p['n']}\ntitle: \"{s['title']}\"\nlaws: {len(s['entries'])}\ntags: [law-section]\n---\n", GEN,
                   f"# {s['id']} · {s['title']}\n", f"[[{pn}|Part {p['n']} · {p['title']}]] · [[Law Index]] · {HOME}\n"]
            if s.get("seeAlso"):
                out.append("See also: " + ", ".join(law_link(x) if isinstance(x, str) else str(x) for x in s["seeAlso"]) + "\n")
            for e in s["entries"]:
                lid = f"{s['id']}.{e['n']}"
                out.append(f"#### {lid}\n{e['text']}\n")
                if e.get("refs"):
                    out.append("Scripture: " + "; ".join(ref_link(r) for r in e["refs"]) + "\n")
                    for r in e["refs"]: cite(r["book"], r["chapter"], "law", f"[[{nm}#{lid}|{lid}]] {clip(e['text'])}", r.get("verses", ""))
            write(os.path.join(VAULT, LAWS, nm + ".md"), "\n".join(out))

# ---------- precepts -----------------------------------------------------------------------
topic_by_slug = {t["slug"]: t for t in precepts["topics"]}
RESERVED = set(ALL_BOOKS) | {"Home", "Cases index", "Precepts index", "Scripture index"}
def precept_note_name(t):
    n = safe(t["title"])
    return n + " (precept)" if n in RESERVED else n
def precept_link(slug):
    t = topic_by_slug.get(slug)
    if not t:  # mirror the app's loose resolution
        k = re.sub(r"[^a-z0-9]+", "-", slug.lower()).strip("-")
        c = [x for x in precepts["topics"] if x["slug"].startswith(k)] or [x for x in precepts["topics"] if k in x["slug"]]
        t = c[0] if c else None
    return f"[[{precept_note_name(t)}]]" if t else slug

def build_precepts():
    shutil.rmtree(os.path.join(VAULT, "Precepts"), ignore_errors=True)
    for t in precepts["topics"]:
        nm = precept_note_name(t)
        out = [f"---\nslug: {t['slug']}\ntitle: \"{t['title']}\"\nrefs: {len(t['refs'])}\ntags: [precept]\n---\n", GEN, f"# {t['title']}\n", f"[[Precepts index]] · {HOME}\n"]
        for r in t["refs"]:
            star = " **(key)**" if r.get("key") else ""
            out.append(f"- {ref_link(r)}{star}{taught_in(r) if CJ else ''}")
            cite(r["book"], r["chapter"], "precept", f"[[{nm}]]" + (" (key)" if r.get("key") else ""), r.get("verses", ""))
        write(os.path.join(VAULT, "Precepts", nm + ".md"), "\n".join(out) + "\n")
    idx = ["---\ntags: [index]\n---\n", GEN, "# Precepts index\n", f"{HOME}\n"]
    letter = ""
    for t in sorted(precepts["topics"], key=lambda t: t["title"].lower()):
        L = t["title"][0].upper()
        if L != letter: idx.append(f"\n## {L}"); letter = L
        idx.append(f"- [[{precept_note_name(t)}]] ({len(t['refs'])})")
    write(os.path.join(VAULT, "Precepts index.md"), "\n".join(idx) + "\n")

# ---------- cases (seed from Python; the vault owns them afterward) -----------------------
def era_folder(era): return f"{ERA_ORDER.index(era) + 1:02d} {safe(era)}"
def case_note_name(c):
    n = safe(c["name"])
    return n + " (case)" if n in RESERVED or n in PRECEPT_NAMES else n
PRECEPT_NAMES = {safe(t["title"]) for t in precepts["topics"]}
VERDICT_LABEL = {"death": "Put to death", "plague": "Plague", "exile": "Exile", "captivity": "Captivity", "curse": "Cursed", "restitution": "Restitution",
                 "spared": "Spared", "reprieve": "Reprieve", "temporal": "Temporal judgment", "unrecorded": "Sentence not recorded"}

def yaml_list(xs): return "[" + ", ".join(json.dumps(x) if re.search(r"[^A-Za-z0-9._-]", x) else x for x in xs) + "]"

def scripture_block(refs):
    if not CJ: return [f"- {ref_link(r)}" for r in refs]
    out = []
    for r in refs:
        out.append(f"**{ref_link(r)}**{taught_in(r)}")
        out += verse_embeds(r)
        out.append("")
    return out

def case_note_text(c):
    fm = [f"slug: {c['slug']}", f"title: {json.dumps(c['name'])}", f"era: {json.dumps(c['era'])}", f"verdict: {c['verdict']}", f"charge: {json.dumps(c['charge'])}",
          f"laws: {yaml_list(c['laws'])}", f"topics: {yaml_list(c['topics'])}", f"themes: {yaml_list(c['themes'])}",
          "tags: " + yaml_list(["case", f"verdict/{c['verdict']}", f"era/{re.sub(r'[^a-z0-9]+', '-', c['era'].lower()).strip('-')}"] + [f"theme/{t}" for t in c["themes"]])]
    body = ["---", *fm, "---", "", f"# {c['name']}", f"**{c['charge']}** · {VERDICT_LABEL[c['verdict']]} · {c['era']} · [[Cases index]]", "",
            "## Summary", c["summary"], "", "## Offense", c["offense"], "", "## Judgment", c["judgment"], "",
            "## Scripture", *scripture_block(c["refs"]), "",
            "## Statutes", *[f"- {law_link(l)}" + (f" {clip(sections_by_id[l.split('.')[0]]['entries'][int(l.split('.')[1]) - 1]['text'], 120)}" if "." in l and l.split(".")[0] in sections_by_id else "") for l in c["laws"]], "",
            "## Precepts", *[f"- {precept_link(t)}" for t in c["topics"]], ""]
    if CJ:
        enc = encyclopedia_links(c)
        if enc: body += ["## See also", *[f"- [[{t}]] (Encyclopedia)" for t in enc], ""]
    return "\n".join(body)

def seed_cases():
    import cases_primeval, cases_wilderness, cases_united_monarchy, cases_divided_kingdom, cases_exile, cases_apocrypha, cases_apostolic
    import build_cases_seed
    allc = (build_cases_seed.CORE + cases_primeval.CASES + cases_wilderness.CASES + cases_united_monarchy.CASES + cases_divided_kingdom.CASES
            + cases_exile.CASES + cases_apocrypha.CASES + cases_apostolic.CASES)
    n = 0
    for c in allc:
        path = os.path.join(VAULT, "Cases", era_folder(c["era"]), case_note_name(c) + ".md")
        if os.path.exists(path) and not FORCE_CASES: continue
        write(path, case_note_text(c)); n += 1
    return n

def read_vault_cases():
    """The parser the app build uses too; import it from build_cases so the two never drift."""
    import build_cases
    return build_cases.read_vault_cases(VAULT)

def build_cases_index(cases):
    out = ["---\ntags: [index]\n---\n", GEN, "# Cases index\n", f"{HOME}\n",
           "Verdicts: " + " · ".join(f"#verdict/{k} {v}" for k, v in VERDICTS.items()) + "\n"]
    for era in ERA_ORDER:
        items = [c for c in cases if c["era"] == era]
        if not items: continue
        out.append(f"\n## {era}")
        for c in items:
            out.append(f"- [[{case_note_name(c)}]]: {c['charge']} · *{VERDICT_LABEL.get(c['verdict'], c['verdict'])}*")
            for r in c["refs"]: cite(r["book"], r["chapter"], "case", f"[[{case_note_name(c)}]]", r.get("verses", ""))
    write(os.path.join(VAULT, "Cases index.md"), "\n".join(out) + "\n")

# ---------- scripture notes (need the cited index, so run last) ---------------------------
def build_scripture():
    shutil.rmtree(os.path.join(VAULT, "Scripture"), ignore_errors=True)
    for book in ALL_BOOKS:
        chs = bible[book]
        nums = sorted(chs)
        tdir = testament(book)
        bidx = [f"---\nbook: \"{book}\"\ntestament: \"{tdir}\"\ntags: [book]\n---\n", GEN, f"# {book}\n", f"[[Scripture index]] · {HOME}\n",
                " · ".join(f"[[{chapter_note(book, n)}|{n}]]" for n in nums) + "\n"]
        write(os.path.join(VAULT, "Scripture", tdir, book, f"{book}.md"), "\n".join(bidx))
        for i, n in enumerate(nums):
            prev = f"[[{chapter_note(book, nums[i-1])}|← {book} {nums[i-1]}]]" if i else ""
            nxt = f"[[{chapter_note(book, nums[i+1])}|{book} {nums[i+1]} →]]" if i + 1 < len(nums) else ""
            out = [f"---\nbook: \"{book}\"\nchapter: {n}\ntestament: \"{tdir}\"\ntags: [scripture]\n---\n", GEN, f"# {book} {n}\n",
                   " · ".join(x for x in [prev, f"[[{book}]]", nxt] if x) + "\n"]
            for vi, text in enumerate(chs[n], 1):
                out.append(f"**{vi}** {text} ^v{vi}\n")
            cb = cited.get((book, n))
            if cb:
                out.append("\n## Cited by\n")
                for kind, label in (("law", "Laws"), ("precept", "Precepts"), ("case", "Cases")):
                    rows = [(link, vs) for k, link, vs in cb if k == kind]
                    if rows:
                        out.append(f"**{label}**")
                        merged = {}
                        for link, vs in rows: merged.setdefault(link, []).append(vs)
                        for link, vss in merged.items():
                            vss = [v for v in dict.fromkeys(vss) if v]
                            out.append(f"- {link}" + (f" (v. {', '.join(vss)})" if vss else ""))
                        out.append("")
            write(os.path.join(VAULT, "Scripture", tdir, book, f"{chapter_note(book, n)}.md"), "\n".join(out))
    idx = ["---\ntags: [index]\n---\n", GEN, "# Scripture index\n", f"{HOME}\n"]
    for tdir in ("Old Testament", "New Testament", "Apocrypha"):
        idx.append(f"\n## {tdir}")
        for book in ALL_BOOKS:
            if testament(book) == tdir:
                n_cited = sum(1 for ch in bible[book] if (book, ch) in cited)
                idx.append(f"- [[{book}]] ({len(bible[book])} chapters, {n_cited} cited)")
    write(os.path.join(VAULT, "Scripture index.md"), "\n".join(idx) + "\n")

# ---------- home + obsidian config --------------------------------------------------------
def build_home(cases):
    n_laws = sum(len(s["entries"]) for p in handbook["parts"] for s in p["sections"])
    out = ["---\ntags: [index]\n---\n", GEN, "# LEX\n",
           f"*A Handbook of Bible Law* as a library: {n_laws:,} laws in {sum(len(p['sections']) for p in handbook['parts'])} sections, {len(precepts['topics'])} precepts, {len(cases)} case studies, and the KJV with Apocrypha, every citation a link.\n",
           "- [[Cases index]]: people and nations who broke the law, and the judgment. **Edit these here; the website is built from them.**",
           "- [[Precepts index]]: the topical precept index",
           "- [[Scripture index]]: every chapter, with what cites it at the bottom",
           "- [[Concordance]]: the same reverse index book by book",
           "\n## The law, by part\n"]
    for p in handbook["parts"]:
        out.append(f"- [[{part_note_name(p)}|Part {p['n']} · {p['title']}]]: " + ", ".join(f"[[{law_note_name(s)}|{s['id']}]]" for s in p["sections"]))
    out += ["\n## How this vault works\n",
            "- Open any chapter note and look at the backlinks pane (or the *Cited by* section): every law, precept, and case that lands on that chapter.",
            "- Open the graph and colour by folder: Cases, Laws, Precepts, Scripture.",
            "- Search `tag:#verdict/death` or `tag:#era/wilderness` to filter cases. `tag:#theme/idolatry` follows a thread across eras.",
            "- To add a case, duplicate any case note into the right era folder. Keep the frontmatter keys and the `## Summary`, `## Offense`, `## Judgment`, `## Scripture` headings; the build reads those. `## Statutes` and `## Precepts` are generated from the `laws:` and `topics:` keys, so edit the keys, not the lists.",
            "- Then run `python3 scripts/build_cases.py > data/cases.json` in the project and the website picks it up. The build validates every law id, precept slug, and scripture reference and refuses to write if one is wrong.",
            "- Laws, Precepts, and Scripture notes are generated; the generator overwrites them. Keep your own commentary in separate notes that link to them.\n"]
    write(os.path.join(VAULT, "Home.md"), "\n".join(out) + "\n")

def build_config():
    cfg = os.path.join(VAULT, ".obsidian")
    os.makedirs(cfg, exist_ok=True)
    write(os.path.join(cfg, "app.json"), json.dumps({"useMarkdownLinks": False, "newLinkFormat": "shortest", "showFrontmatter": False, "alwaysUpdateLinks": True, "readableLineLength": True, "strictLineBreaks": False}, indent=2))
    write(os.path.join(cfg, "appearance.json"), json.dumps({"baseFontSize": 16}, indent=2))
    write(os.path.join(cfg, "graph.json"), json.dumps({
        "collapse-filter": True, "search": "-path:\"Scripture\" OR tag:#scripture", "showTags": False, "showAttachments": False, "hideUnresolved": True, "showOrphans": False,
        "collapse-color-groups": False,
        "colorGroups": [
            {"query": "path:Cases", "color": {"a": 1, "rgb": 11746355}},
            {"query": "path:Laws", "color": {"a": 1, "rgb": 3113124}},
            {"query": "path:Precepts", "color": {"a": 1, "rgb": 5216831}},
            {"query": "path:Scripture", "color": {"a": 1, "rgb": 9013641}},
        ],
        "collapse-display": True, "showArrow": False, "textFadeMultiplier": 0, "nodeSizeMultiplier": 1, "lineSizeMultiplier": 1,
        "collapse-forces": True, "centerStrength": 0.5, "repelStrength": 12, "linkStrength": 1, "linkDistance": 250, "scale": 0.4, "close": True}, indent=2))
    write(os.path.join(cfg, "core-plugins.json"), json.dumps(["file-explorer", "global-search", "switcher", "graph", "backlink", "outgoing-link", "tag-pane", "properties", "page-preview", "note-composer", "command-palette", "outline", "word-count", "file-recovery"], indent=2))

def build_concordance():
    """Law/Concordance/<Book>.md: for every chapter, the laws, precepts, and cases that cite it. This is
    the site's reverse index (the LEX `ref` command) for a vault whose Bible files we do not edit."""
    shutil.rmtree(os.path.join(VAULT, LAWS, "Concordance"), ignore_errors=True)
    idx = ["---\ntitle: Concordance\n---\n", GEN, "# Concordance\n", "Every chapter of scripture that a law, a precept, or a case study cites, book by book. Open a chapter here to see everything in the law library that lands on it.\n", f"[[Law Index]] · {HOME}\n"]
    for tdir in ("Old Testament", "New Testament", "Apocrypha"):
        idx.append(f"\n## {tdir}")
        for book in ALL_BOOKS:
            if testament(book) != tdir: continue
            chs = sorted(ch for (b, ch) in cited if b == book)
            if not chs: continue
            cjb = CJ_BOOK.get(book, book) if CJ else book
            nm = safe(cjb)
            idx.append(f"- [[{nm}|{cjb}]] ({len(chs)} chapters)")
            out = [f"---\ntitle: \"{cjb} concordance\"\nbook: \"{cjb}\"\n---\n", GEN, f"# {cjb}\n", f"[[Concordance]] · [[{book_note(book)}|read {cjb}]] · {HOME}\n"]
            for ch in chs:
                cb = cited[(book, ch)]
                out.append(f"\n## [[{chapter_note(book, ch)}]]\n")
                for kind, label in (("law", "Laws"), ("precept", "Precepts"), ("case", "Cases")):
                    rows = [(link, vs) for k, link, vs in cb if k == kind]
                    if not rows: continue
                    out.append(f"**{label}**")
                    merged = {}
                    for link, vs in rows: merged.setdefault(link, []).append(vs)
                    for link, vss in merged.items():
                        vss = [v for v in dict.fromkeys(vss) if v]
                        out.append(f"- {link}" + (f" (v. {', '.join(vss)})" if vss else ""))
                    out.append("")
            write(os.path.join(VAULT, LAWS, "Concordance", nm + ".md"), "\n".join(out))
    write(os.path.join(VAULT, LAWS, "Concordance", "Concordance.md"), "\n".join(idx) + "\n")

def build_law_index():
    n_laws = sum(len(s["entries"]) for p in handbook["parts"] for s in p["sections"])
    out = ["---\ntitle: Law Index\ndescription: A Handbook of Bible Law as linked notes, with the precept index and the case studies.\n---\n", GEN,
           "# Law Index\n",
           f"*A Handbook of Bible Law* as a library: {n_laws:,} laws in {len(sections_by_id)} sections, {len(precepts['topics'])} precepts, and the case studies, every citation a link into the Bible here.\n",
           "[[Cases index|Cases]] · [[Precepts index|Precepts]] · [[Concordance]] · [Home](/)\n", "## The law, by part\n"]
    for p in handbook["parts"]:
        out.append(f"- [[{part_note_name(p)}|Part {p['n']} · {p['title']}]]: " + ", ".join(f"[[{law_note_name(s)}|{s['id']}]]" for s in p["sections"]))
    write(os.path.join(VAULT, "Law Index.md"), "\n".join(out) + "\n")

if __name__ == "__main__":
    os.makedirs(VAULT, exist_ok=True)
    if CJ: load_cj(VAULT)
    build_laws()
    build_precepts()
    n = seed_cases()
    cases = read_vault_cases()
    build_cases_index(cases)
    build_concordance()
    if CJ:
        build_law_index()
    else:
        build_scripture()
        build_home(cases)
        build_config()
    n_ch = 0 if CJ else sum(len(v) for v in bible.values())
    sys.stderr.write(f"[{TARGET}] vault at {VAULT}: {len(sections_by_id)} law notes, {len(precepts['topics'])} precept notes, {n_ch} chapter notes, {len(cases)} cases ({n} written from seed)"
                     + (f", {len(STUDY)} chapters with study notes, {len(LEXICON)} encyclopedia topics\n" if CJ else "\n"))
