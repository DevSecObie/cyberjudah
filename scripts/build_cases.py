"""Build data/cases.json from the Obsidian vault.

The vault (vault/Cases/<era>/<name>.md) is the source of truth for the case studies. Each note is
frontmatter + headed sections; this script parses them back into the JSON shape the app uses,
validates every law id, precept slug, and scripture reference, and refuses to write on any error.

usage: python3 scripts/build_cases.py > data/cases.json
       python3 scripts/build_cases.py --check          validate only
       python3 scripts/build_cases.py --vault PATH     read a vault somewhere else

Note format (keys the build reads):
  frontmatter: slug, title, era, verdict, charge, laws [..], topics [..], themes [..]
  body:        # Title, then ## Summary / ## Offense / ## Judgment (prose), ## Scripture (a list of
               links or plain references, one per line: "- [[Joshua 7#^v1|Joshua 7:1]]" or "- Joshua 7:1")
  Anything else (## Statutes, ## Precepts, your own sections) is ignored by the build.
"""
import json, sys, os, re, glob
import yaml
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from cases_lib import ref, ERA_ORDER, VERDICTS

DATA = os.path.join(HERE, "..", "data")
DEFAULT_VAULT = os.path.abspath(os.path.join(HERE, "..", "vault"))

REF_RE = re.compile(r"\[\[[^\]|]*\|([^\]]+)\]\]|\[\[([^\]|#]+)(?:#[^\]|]*)?\]\]")
def _vault_dir(vault, *names):
    """Vault folders were renamed to the site's own wording; accept either spelling."""
    for n in names:
        d = os.path.join(vault, n)
        if os.path.isdir(d):
            return d
    return os.path.join(vault, names[0])

def is_ref_line(line):
    """List items ('- Joshua 7:1', '- [[Joshua 7#^v1|Joshua 7:1]]') and the CyberJudah study-note
    style ('**[[Joshua 7#^v1|Joshua 7:1]]**  taught in [[...]]'). Verse embeds (![[...]]) are skipped."""
    t = line.strip()
    if t.startswith("!["): return False
    return t.startswith(("-", "*")) and not t.startswith("**taught") and bool(re.search(r"[A-Za-z]", t))

def parse_ref_line(line):
    s = line.strip().lstrip("-*").strip().strip("*").strip()
    s = re.split(r"\s{2,}taught in\b|\s+taught in\s+\[\[", s)[0]
    m = REF_RE.search(s)
    if m: s = (m.group(1) or m.group(2)).strip()
    return ref(s)

def parse_note(path):
    text = open(path, encoding="utf-8").read()
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m: raise ValueError(f"{path}: no frontmatter")
    fm = yaml.safe_load(m.group(1)) or {}
    body = m.group(2)
    sections, cur, buf = {}, None, []
    title = fm.get("title")
    for line in body.split("\n"):
        if line.startswith("# ") and title is None: title = line[2:].strip(); continue
        h = re.match(r"^## +(.+?)\s*$", line)
        if h:
            if cur: sections[cur] = "\n".join(buf).strip()
            cur, buf = h.group(1).strip().lower(), []
        elif cur is not None: buf.append(line)
    if cur: sections[cur] = "\n".join(buf).strip()
    def prose(k):
        return re.sub(r"\s*\n\s*", " ", sections.get(k, "")).strip()
    refs = []
    for line in sections.get("scripture", "").split("\n"):
        if is_ref_line(line): refs.append(parse_ref_line(line))
    lst = lambda k: [str(x) for x in (fm.get(k) or [])]
    return {
        "slug": str(fm.get("slug") or re.sub(r"[^a-z0-9]+", "-", os.path.splitext(os.path.basename(path))[0].lower()).strip("-")),
        "name": title or os.path.splitext(os.path.basename(path))[0],
        "era": str(fm.get("era", "")), "charge": str(fm.get("charge", "")), "verdict": str(fm.get("verdict", "")),
        "summary": prose("summary"), "offense": prose("offense"), "judgment": prose("judgment"),
        "refs": refs, "laws": lst("laws"), "topics": lst("topics"), "themes": lst("themes"),
        "_path": path,
    }

def read_vault_cases(vault):
    paths = sorted(glob.glob(os.path.join(_vault_dir(vault, "Case Studies", "Cases"), "**", "*.md"), recursive=True))
    return [parse_note(p) for p in paths]

# ---- validation --------------------------------------------------------------------------
handbook = json.load(open(os.path.join(DATA, "handbook.json")))
precepts = json.load(open(os.path.join(DATA, "precepts.json")))
BIBLE_DIR = os.path.join(DATA, "bible")
def _slug(b): return re.sub(r"[^a-z0-9]+", "-", b.lower()).strip("-")
BIBLE = {}  # book -> {chapter(str): [verses]}
for entry in json.load(open(os.path.join(BIBLE_DIR, "index.json"))):
    BIBLE[entry["book"]] = json.load(open(os.path.join(BIBLE_DIR, entry["slug"] + ".json")))["chapters"]
law_ids = set()
for p in handbook["parts"]:
    for s in p["sections"]:
        law_ids.add(s["id"])
        for e in s["entries"]:
            law_ids.add(f"{s['id']}.{e['n']}")
topics = precepts["topics"]
slugs = {t["slug"] for t in topics}
titles = {t["title"].lower() for t in topics}
def topic_ok(t):  # mirror getTopic in corpus.ts
    k = re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")
    return k in slugs or any(s.startswith(k) for s in slugs) or any(k in s for s in slugs) or t.lower() in titles
def check(cases):
    errs, seen = [], set()
    for c in cases:
        where = os.path.relpath(c.get("_path", c["slug"]))
        for k in ("era", "charge", "verdict", "summary", "offense", "judgment"):
            if not c.get(k): errs.append(f"{where}: empty {k}")
        if not c["refs"]: errs.append(f"{where}: no scripture references")
        if c["slug"] in seen: errs.append(f"{where}: duplicate slug {c['slug']}")
        seen.add(c["slug"])
        if c["era"] not in ERA_ORDER: errs.append(f"{where}: unknown era {c['era']!r} (one of: {', '.join(ERA_ORDER)})")
        if c["verdict"] not in VERDICTS: errs.append(f"{where}: unknown verdict {c['verdict']!r} (one of: {', '.join(VERDICTS)})")
        for l in c["laws"]:
            if l not in law_ids: errs.append(f"{where}: unknown law {l}")
        for t in c["topics"]:
            if not topic_ok(t): errs.append(f"{where}: topic {t!r} resolves to nothing")
        for r in c["refs"]:
            b, ch = r["book"], r["chapter"]
            chs = BIBLE.get(b)
            if chs is None: errs.append(f"{where}: unknown book {b!r}"); continue
            if str(ch) not in chs: errs.append(f"{where}: {b} has no chapter {ch}"); continue
            n = len(chs[str(ch)])
            for part in filter(None, r["verses"].split(",")):
                lo, _, hi = part.partition("-")
                if int(hi or lo) > n: errs.append(f"{where}: {b} {ch}:{part} beyond verse {n}")
    return errs

if __name__ == "__main__":
    vault = os.path.abspath(sys.argv[sys.argv.index("--vault") + 1]) if "--vault" in sys.argv else DEFAULT_VAULT
    if not os.path.isdir(_vault_dir(vault, "Case Studies", "Cases")):
        sys.stderr.write(f"no vault at {vault}; run scripts/build_vault.py first\n"); sys.exit(1)
    CASES = read_vault_cases(vault)
    errs = check(CASES)
    for e in errs: sys.stderr.write("ERROR " + e + "\n")
    if errs: sys.exit(1)
    if "--check" in sys.argv:
        sys.stderr.write(f"ok: {len(CASES)} cases\n"); sys.exit(0)
    order = {e: i for i, e in enumerate(ERA_ORDER)}
    CASES.sort(key=lambda c: (order[c["era"]], c["name"].lower()))
    for c in CASES: c.pop("_path", None)
    json.dump({"title": "Case Studies", "eras": ERA_ORDER, "verdicts": VERDICTS, "cases": CASES}, sys.stdout, ensure_ascii=False, separators=(",", ":"))
    from collections import Counter
    sys.stderr.write(f"cases={len(CASES)} refs={sum(len(c['refs']) for c in CASES)} eras={dict(Counter(c['era'] for c in CASES))} verdicts={dict(Counter(c['verdict'] for c in CASES))}\n")
