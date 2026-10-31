#!/usr/bin/env python3
"""Write a 4 Chapters a Day study note from the precept passes (data/precepts/classes).

For a chapter the 4 Chapters a Day session has no note for, this gathers every passage of that
chapter a class opened in a precept pass: the class's own breakdown of each verse (`sense`) and
the precepts it read with it (`precepts`, with their breakdown `why`). It writes them in the
study-note format (docs/study/<book>/<chapter>.md): the verses quoted from data/bible, the
breakdown as bullets, the precepts nested under the verses they were read with. Nothing is
written that is not in the precept data or the KJV.

usage: from_precepts.py TITLES.tsv [--overwrite]  (lines "book slug<TAB>chapter<TAB>title")
A note that already exists is left as it is unless --overwrite is given.
A chapter with no passage in the precept data is skipped and listed.
"""
import argparse
import glob
import json
import os
import re
import unicodedata
from datetime import datetime, timezone

ROOT = os.environ.get("CJ_ROOT") or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
INDEX = json.load(open(f"{ROOT}/data/bible/index.json"))
SLUG = {e["book"]: e["slug"] for e in INDEX}
NAME = {e["slug"]: e["book"] for e in INDEX}
# Names the precept data uses for books data/bible names otherwise.
ALIAS = {
    "Ecclesiasticus": "Sirach",
    "Song of the Three Holy Children": "Song of the Three Children",
    "History of Susanna": "Susanna",
    "Prayer of Manasses": "Prayer of Manasseh",
    "Epistle of Jeremy": "Epistle of Jeremiah",
    "Psalm": "Psalms",
}
# How the study notes name a book in headings and links (the app's names).
SHOWN = {
    "Sirach": "Ecclesiasticus",
    "Song of the Three Children": "Song of the Three Holy Children",
    "Susanna": "History of Susanna",
    "Prayer of Manasseh": "Prayer of Manasses",
}
REF = re.compile(r"^\s*(.+?)\s+(\d+)(?::([\d,\s\-]+))?\s*$")
_chapters = {}
MAX_BULLETS = 4
MAX_PRECEPTS = 3
MAX_WORDS = 7000


def chapter_text(book, ch):
    if book not in _chapters:
        _chapters[book] = json.load(open(f"{ROOT}/data/bible/{SLUG[book]}.json"))["chapters"]
    return _chapters[book].get(str(ch)) or []


def parse(ref):
    """'Romans 8:28-30, 35' -> ('Romans', 8, [28, 29, 30, 35]); a whole chapter -> all verses."""
    m = REF.match(ref.replace("–", "-"))
    if not m:
        return None
    book = ALIAS.get(m.group(1), m.group(1))
    if book not in SLUG:
        return None
    ch = int(m.group(2))
    verses = []
    spec = (m.group(3) or "").strip().strip(",")
    if not spec:
        verses = list(range(1, len(chapter_text(book, ch)) + 1))
    for part in filter(None, (p.strip() for p in spec.split(","))):
        if "-" in part:
            a, b = (int(x) for x in part.split("-")[:2])
            verses += range(a, b + 1)
        else:
            verses.append(int(part))
    count = len(chapter_text(book, ch))
    verses = sorted({v for v in verses if 1 <= v <= count})
    return (book, ch, verses) if verses else None


def spans(verses):
    out, start, prev = [], None, None
    for v in verses:
        if start is None:
            start = prev = v
        elif v == prev + 1:
            prev = v
        else:
            out.append((start, prev))
            start = prev = v
    if start is not None:
        out.append((start, prev))
    return ", ".join(f"{a}" if a == b else f"{a}-{b}" for a, b in out)


def link(book, ch, verses):
    shown = SHOWN.get(book, book)
    return f"[{shown} {ch}:{spans(verses)}](/bible/{SLUG[book]}/{ch}#v{verses[0]})"


def quote(book, ch, verses, indent=""):
    body = chapter_text(book, ch)
    lines = []
    for v in verses:
        text = unicodedata.normalize("NFC", body[v - 1]).replace("<", "&lt;")
        lines.append(f"{indent}> <sup>[{v}](/bible/{SLUG[book]}/{ch}#v{v})</sup> {text}")
    return f"\n{indent}>\n".join(lines)


def paragraphs(text):
    return [" ".join(p.split()) for p in re.split(r"\n\s*\n", text or "") if p.strip()]


def rank(teacher):
    """The Bishops' and Deacons' teaching comes first (AGENTS.md rule 0)."""
    t = (teacher or "").lower()
    return 0 if t.startswith("bishop") else 1 if t.startswith("deacon") else 2


def load_passages():
    """Every passage of the precept passes, keyed by (book, chapter)."""
    found = {}
    for path in sorted(glob.glob(f"{ROOT}/data/precepts/classes/*.json")):
        data = json.load(open(path))
        for passage in data.get("passages", []):
            opened = parse(passage.get("opened", ""))
            if not opened:
                continue
            book, ch, _ = opened
            teacher = passage.get("teacher") or data.get("teacher") or ""
            found.setdefault((book, ch), []).append((rank(teacher), data.get("date", ""), passage))
    return found


def units(book, ch, passages):
    """Verse blocks: each verse (or run) a class broke down, with its bullets and precepts."""
    blocks = {}
    # Bullets are (rank, text) and precepts {ref: (rank, why)}, so a Bishop's or Deacon's
    # breakdown stays first even after blocks merge.
    for teacher_rank, _, passage in sorted(passages, key=lambda item: (item[0], item[1])):
        _, _, opened = parse(passage["opened"])
        for sense in passage.get("sense", []):
            at = parse(f"{book} {ch}:{sense.get('at') or spans(opened)}")
            if not at:
                continue
            block = blocks.setdefault(tuple(at[2]), {"bullets": [], "precepts": {}})
            for p in paragraphs(sense.get("text")):
                if p not in [text for _, text in block["bullets"]]:
                    block["bullets"].append((teacher_rank, p))
        for precept in passage.get("precepts", []):
            target = parse(precept.get("ref", ""))
            if not target:
                continue
            at = parse(f"{book} {ch}:{precept.get('at') or spans(opened)}")
            key = tuple(at[2]) if at else tuple(opened)
            block = blocks.setdefault(key, {"bullets": [], "precepts": {}})
            ref_key = (target[0], target[1], tuple(target[2]))
            why = paragraphs(precept.get("why"))
            if ref_key not in block["precepts"] and why:
                block["precepts"][ref_key] = (teacher_rank, why)
    # Classes break a chapter down in different runs (1-3, 1-6, 3): runs that share a verse
    # become one block, so no verse is quoted twice.
    merged = []
    for key, block in sorted(blocks.items(), key=lambda item: (item[0][0], -len(item[0]))):
        verses = set(key)
        into = {"bullets": list(block["bullets"]), "precepts": dict(block["precepts"])}
        # Fold in every block already made that shares a verse with this one (1,4 / 2 / 4-5).
        for other_verses, other in [m for m in merged if verses & m[0]]:
            merged.remove((other_verses, other))
            verses |= other_verses
            seen = [text for _, text in other["bullets"]]
            other["bullets"] += [b for b in into["bullets"] if b[1] not in seen]
            for ref, ranked in into["precepts"].items():
                if ref not in other["precepts"] or ranked[0] < other["precepts"][ref][0]:
                    other["precepts"][ref] = ranked
            into = other
        # Stable sort: higher-ranked teachers first, each teacher's points in class order.
        into["bullets"].sort(key=lambda b: b[0])
        into["precepts"] = dict(sorted(into["precepts"].items(), key=lambda item: item[1][0]))
        merged.append((verses, into))
    return sorted(((tuple(sorted(v)), b) for v, b in merged), key=lambda item: item[0][0])


def write(slug, ch, title, passages, max_bullets=None, max_precepts=None, overwrite=False):
    max_bullets = max_bullets or MAX_BULLETS
    max_precepts = max_precepts or MAX_PRECEPTS
    book = NAME[slug]
    shown = SHOWN.get(book, book)
    blocks = units(book, ch, passages)
    if not blocks:
        return None
    opened = sorted({v for key, _ in blocks for v in key})
    path = f"{ROOT}/docs/study/{slug}/{ch}.md"
    added = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    if os.path.exists(path):
        # A note already written (or edited since) is never overwritten unless asked.
        if not overwrite:
            return path
        old = re.search(r'^added: "(.*)"$', open(path).read(), re.M)
        added = old.group(1) if old else added
    out = [
        "---",
        f'title: "{shown} {ch}: {title}"',
        f'slug: "/study/{slug}/{ch}"',
        f'sidebar_label: "{shown} {ch}"',
        f"sidebar_position: {ch}",
        f'description: "Study notes on {shown} {ch}"',
        f'added: "{added}"',
        "---",
        "",
        f"Read the chapter → [{shown} {ch}](/bible/{slug}/{ch})",
        "",
        "## Introduction",
        "",
        f"These notes gather what the CyberJudah classes taught on {shown} {ch} in their scripture "
        f"breakdowns: verses {spans(opened)}, each with the class's breakdown and the precepts read "
        "with it.",
        "",
    ]
    for key, block in blocks:
        verses = list(key)
        out += [f"**{link(book, ch, verses)}**", "", quote(book, ch, verses), ""]
        # A study guide, not every word: the first points made on the verses, Bishops' and
        # Deacons' first.
        for _, bullet in block["bullets"][:max_bullets]:
            out += [f"- {bullet}"]
        if block["bullets"]:
            out.append("")
        if block["precepts"]:
            if not block["bullets"]:
                out += ["- The class read these precepts with it.", ""]
            out.append("  Precepts:")
            for (pbook, pch, pverses), (_, why) in list(block["precepts"].items())[:max_precepts]:
                out.append(f"  - **{link(pbook, pch, list(pverses))}**")
                out.append(quote(pbook, pch, list(pverses), indent="    "))
                # The line the class drew from it: the breakdown's opening paragraph.
                out += ["", f"    {why[0]}"]
            out.append("")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    text = "\n".join(out).rstrip() + "\n"
    # A chapter the classes opened verse by verse runs long: keep it to a study guide's length
    # by taking fewer points and precepts on each verse.
    if len(text.split()) > MAX_WORDS and (max_bullets > 2 or max_precepts > 1):
        return write(slug, ch, title, passages, max(2, max_bullets - 1), max(1, max_precepts - 1), overwrite)
    open(path, "w").write(text)
    return path


def main():
    parser = argparse.ArgumentParser(description="Write study notes from precept-pass breakdowns.")
    parser.add_argument("titles", help="TSV of slug, chapter, title")
    parser.add_argument("--overwrite", action="store_true", help="rewrite notes that already exist")
    args = parser.parse_args()
    overwrite = args.overwrite
    found = load_passages()
    skipped = []
    for line in open(args.titles):
        if not line.strip() or line.startswith("#"):
            continue
        slug, ch, title = line.rstrip("\n").split("\t")
        if not write(slug, int(ch), title, found.get((NAME[slug], int(ch)), []), overwrite=overwrite):
            skipped.append(f"{slug} {ch}")
    print("no precept data:", ", ".join(skipped) or "none")


if __name__ == "__main__":
    main()
