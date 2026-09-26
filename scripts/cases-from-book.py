#!/usr/bin/env python3
"""Rebuild data/cases.json from the Case Studies of the Bible manuscripts.

    python3 scripts/cases-from-book.py [--book ../case-studies-of-the-bible] [--check]

The book (the private case-studies-of-the-bible repository) is the authority for the case
studies: Volume I (Old Testament) and Volume II (Apocrypha and New Testament). This reads
both manuscripts and writes every case into data/cases.json in the shape the engine and site
use: code, name, era, verdict, charge, summary, the offense and judgment paragraphs, the
statutes (handbook law IDs), the precepts, the related cases, and the scripture cited.

The book replaces the case data entirely: nothing is carried over from the previous file.
`--check` reports what would change and writes nothing.
"""

import argparse
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CASES = ROOT / "data" / "cases.json"
VOLUMES = ("Case_Studies_of_the_Bible_Volume_I.html", "Case_Studies_of_the_Bible_Volume_II.html")

VERDICTS = {
    "Put to death": "death", "Plague": "plague", "Exile": "exile", "Captivity": "captivity",
    "Cursed": "curse", "Restitution": "restitution", "Spared": "spared", "Reprieve": "reprieve",
    "Temporal judgment": "temporal", "Sentence not recorded": "unrecorded",
    "Sentence deferred": "deferred", "Kept the law": "blessed",
}
VERDICT_MEANINGS = {
    "deferred": "sentence pronounced, carried out after the offender's own death",
}
# The book's book names -> the KJV data's.
BOOK_NAMES = {
    "Ecclesiasticus": "Sirach", "Epistle of Jeremy": "Epistle of Jeremiah", "Prayer of Manasses": "Prayer of Manasseh",
    "Psalm": "Psalms", "Rest of Esther": "Esther (Greek)", "Song of the Three Holy Children": "Song of the Three Children",
    "Wisdom": "Wisdom of Solomon",
}


def text(fragment):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", fragment))).strip()


def refs_from(cited):
    """'Genesis 2:7-9 · Psalm 1 · Genesis 2:25-3:7' -> [{book, chapter, verses?}, ...]."""
    out, bad = [], []
    for part in cited.split("·"):
        part = part.strip().rstrip(".")
        if not part:
            continue
        m = re.fullmatch(r"(.+?) (\d+)(?::(\d+(?:-\d+)?(?:, ?\d+(?:-\d+)?)*))?(?:-(\d+):(\d+))?", part)
        if not m:
            bad.append(part)
            continue
        book = BOOK_NAMES.get(m[1], m[1])
        chapter = int(m[2])
        if book == "Baruch" and chapter == 6:  # the KJV's Baruch 6 is the Epistle of Jeremy
            book, chapter = "Epistle of Jeremiah", 1
        if m[4]:  # runs into the next chapter: Genesis 2:25-3:7
            first = m[3].split("-")[0]
            out.append({"book": book, "chapter": chapter, "verses": f"{first}-999"})  # clamped below
            out.append({"book": book, "chapter": int(m[4]), "verses": f"1-{m[5]}"})
        elif m[3]:
            out.append({"book": book, "chapter": chapter, "verses": m[3].replace(" ", "")})
        else:
            out.append({"book": book, "chapter": chapter})
    return out, bad


def paragraphs(section):
    """The body paragraphs of an offense or judgment section, page-split paragraphs rejoined."""
    out = []
    for m in re.finditer(r"<p(?: class=\"([^\"]*)\")?[^>]*>(.*?)</p>", section, re.S):
        cls, body = m.group(1) or "", text(m.group(2))
        if not body or cls in ("sec", "also", "applbl", "charge"):
            continue
        if "contd" in cls.split() and out:
            out[-1] = f"{out[-1]} {body}"
        else:
            out.append(body)
    return out


def parse_volume(path):
    source = Path(path).read_text(encoding="utf-8")
    starts = [(m.start(), m.group(1)) for m in re.finditer(r'<div class="case-flow" id="c-([^"]+)"', source)]
    cases = []
    for index, (start, slug) in enumerate(starts):
        end = starts[index + 1][0] if index + 1 < len(starts) else len(source)
        # Up to the end of the case: the next case, or an era divider, appendix or back matter.
        chunk = source[start:end]
        cut = re.search(r'<section class="page (?!case)', chunk)
        if cut:
            chunk = chunk[:cut.start()]
        chunk = re.sub(r'<div class="(?:folio|flow-continuation|rh)">.*?</div>', "", chunk, flags=re.S)
        caption = re.search(r'<div class="caption">(.*?)</div>', chunk, re.S)
        code_era = re.match(r"(C\d+)\s*·\s*([^| ]+?)\s*[  ]*\|", text(caption.group(1))) if caption else None
        verdict_label = re.search(r'<span class="vm[^"]*">([^<]+)</span>', chunk)
        name = re.search(r"<h2>(.*?)</h2>", chunk, re.S)
        charge = re.search(r'<p class="charge">(.*?)</p>', chunk, re.S)
        summary = re.search(r'<div class="hn">(.*?)</div>', chunk, re.S)
        # First section: The Offense / The Obedience / The Petition; second: The Judgment /
        # The Blessing / The Answer.
        heads = [m.start() for m in re.finditer(r'data-case-heading="(?:offense|obedience|petition|judgment|blessing|answer)"', chunk)]
        offense_at, judgment_at = (heads + [-1, -1])[:2]
        apps_at = chunk.find('<div class="app">')
        body_end = min(x for x in (chunk.find('<p class="also"'), apps_at, len(chunk)) if x >= 0)
        cited = re.search(r'<p class="also">(.*?)</p>', chunk, re.S)
        statutes, precepts, related = [], [], []
        for block in re.finditer(r'<div class="ac[^"]*">(.*?)</div>', chunk[apps_at:] if apps_at >= 0 else "", re.S):
            b = block.group(1)
            label = text((re.search(r'<p class="applbl">(.*?)</p>', b, re.S) or re.search(r"$^", "")).group(1)) if re.search(r'<p class="applbl">', b) else ""
            if "rel" in block.group(0)[:40] or label.startswith("Related"):
                for r in re.finditer(r"<b>(.*?)</b>\s*<a[^>]*data-case-target=\"c-([^\"]+)\"[^>]*>.*?</a>.*?<span class=\"rc\">(.*?)</span>", b, re.S):
                    related.append({"slug": r.group(2), "name": text(r.group(1)), "desc": text(r.group(3))})
            elif label == "Statutes" or (not label and statutes and not precepts):
                statutes += re.findall(r">\s*(\d+[A-Z](?:\.\d+)?)\s*<", b)
            elif label.startswith("See the Precepts") or (not label and precepts):
                precepts += [text(p) for p in re.findall(r"<b>(.*?)</b>", b, re.S)] or [
                    t for t in (text(x) for x in re.findall(r">([^<>]+)<", b)) if t and not t.isdigit() and not t.startswith("See the")]
        refs, bad = refs_from(re.sub(r"^.*?scripture cited\s*", "", text(cited.group(1)))) if cited else ([], [])
        verdict = VERDICTS.get(verdict_label.group(1).strip()) if verdict_label else None
        case = {
            "slug": slug,
            "code": code_era.group(1) if code_era else None,
            "name": text(name.group(1)) if name else slug,
            "era": code_era.group(2).strip() if code_era else None,
            "charge": text(charge.group(1)) if charge else "",
            "verdict": verdict,
            "summary": text(summary.group(1)) if summary else "",
            "offenseFull": paragraphs(chunk[offense_at:judgment_at]) if offense_at >= 0 and judgment_at > offense_at else [],
            "judgmentFull": paragraphs(chunk[judgment_at:body_end]) if judgment_at >= 0 else [],
            "refs": refs,
            "laws": list(dict.fromkeys(statutes)),
            "topics": list(dict.fromkeys(p for p in precepts if p)),
            "relatedCases": related,
            "_unparsed_refs": bad,
            "_verdict_label": verdict_label.group(1).strip() if verdict_label else None,
        }
        if verdict == "blessed":
            case["kind"] = "blessing"
        case["offense"] = case["offenseFull"][0] if case["offenseFull"] else ""
        case["judgment"] = case["judgmentFull"][0] if case["judgmentFull"] else ""
        cases.append(case)
    return cases


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--book", type=Path, default=ROOT.parent / "case-studies-of-the-bible")
    parser.add_argument("--check", action="store_true", help="report what would change; write nothing")
    args = parser.parse_args(argv)
    missing = [v for v in VOLUMES if not (args.book / v).exists()]
    if missing:
        parser.error(f"not found in {args.book}: {', '.join(missing)}")

    current = json.loads(CASES.read_text(encoding="utf-8"))
    old = {c["slug"]: c for c in current["cases"]}
    book = [c for v in VOLUMES for c in parse_volume(args.book / v)]

    problems = []
    for c in book:
        where = f"{c['code']} {c['slug']}"
        if not c["era"] or c["era"] not in current["eras"]:
            problems.append(f"{where}: era {c['era']!r} is not one of the site's eras")
        if not c["verdict"]:
            problems.append(f"{where}: unknown verdict label {c['_verdict_label']!r}")
        for field in ("charge", "summary", "offense", "judgment"):
            if not c[field]:
                problems.append(f"{where}: no {field} found")
        if c["_unparsed_refs"]:
            problems.append(f"{where}: unreadable scripture {c['_unparsed_refs']}")
        if not c["refs"]:
            problems.append(f"{where}: no scripture cited")
    if len({c["slug"] for c in book}) != len(book):
        problems.append("duplicate case slugs in the book")

    # A reference running into the next chapter ends its first part at that chapter's last verse.
    lengths = {}
    for path in (ROOT / "data" / "bible").glob("*.json"):
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict) and "chapters" in data:
            lengths[data["book"]] = {int(k): len(v) for k, v in data["chapters"].items()}
    clamped = []
    for c in book:
        for r in c["refs"]:
            last = lengths.get(r["book"], {}).get(r["chapter"])
            if not last or not r.get("verses"):
                continue
            parts = []
            for part in r["verses"].split(","):
                a, _, b = part.partition("-")
                a, b = int(a), int(b or a)
                if b > last:  # the KJV data numbers some Apocrypha chapters shorter than the book cites
                    if b != 999:
                        clamped.append(f"{c['code']} {r['book']} {r['chapter']}:{part} -> ends at verse {last}")
                    b = last
                if a <= last:
                    parts.append(f"{a}-{b}" if b > a else str(a))
            r["verses"] = ",".join(parts)
    for note in clamped:
        print("  verse range ended at the chapter's last verse in the KJV data:", note)

    # The book replaces the case data entirely; nothing is carried over from the old file.
    out = [{**{k: v for k, v in c.items() if not k.startswith("_")}, "themes": []} for c in book]

    added = sorted(c["slug"] for c in book if c["slug"] not in old)
    dropped = sorted(set(old) - {c["slug"] for c in book})
    print(f"book: {len(book)} cases ({sum(c.get('kind') == 'blessing' for c in book)} kept the law); "
          f"site now: {len(old)}; new {len(added)}, no longer in the book {len(dropped)}")
    if added:
        print("  new:", ", ".join(added))
    if dropped:
        print("  no longer in the book:", ", ".join(dropped))
    if problems:
        print(f"{len(problems)} problems:")
        for p in problems:
            print("  " + p)
        if not args.check:
            sys.exit("not written; fix the book or this importer first")
    if args.check:
        return

    verdicts = dict(current["verdicts"])
    verdicts.update({k: v for k, v in VERDICT_MEANINGS.items() if k not in verdicts})
    data = {"title": current.get("title", "Case Studies of the Bible"), "eras": current["eras"], "verdicts": verdicts,
            "source": "Generated by scripts/cases-from-book.py from the Case Studies of the Bible manuscripts. Edit the book, not this file.",
            "cases": out}
    CASES.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {CASES.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
