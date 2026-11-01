#!/usr/bin/env python3
"""Put the rewritten Volume I cases into data/cases.json ahead of the book.

    python3 scripts/cases-from-drafts.py DRAFTS_DIR [--keep C088 ...] [--check]

The Volume I rewrite (one C###.json per case: code, disp, charge, headnote, the two body
sections and the scripture cited) is finished before the book's HTML is reflowed. This
lays each draft over the case with the same code in data/cases.json, so the site and the
apps carry the new text now:

    charge, verdict (from the draft's disposition), summary (the headnote),
    offenseFull/judgmentFull and offense/judgment (the two sections), refs (scripture cited)

Everything else (slug, name, era, laws, precepts, related cases) stays as the book has it;
the rewrite did not change those panels. Cases named with --keep are left untouched.

Once the drafts are in the book, scripts/cases-from-book.py rebuilds this file from the
book again and this script is no longer needed. Running cases-from-book.py against a book
that does not yet have the drafts would put the old text back.
"""

import argparse
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CASES = ROOT / "data" / "cases.json"

spec = importlib.util.spec_from_file_location("cases_from_book", Path(__file__).with_name("cases-from-book.py"))
book = importlib.util.module_from_spec(spec)
spec.loader.exec_module(book)


def chapter_lengths():
    lengths = {}
    for path in (ROOT / "data" / "bible").glob("*.json"):
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict) and "chapters" in data:
            lengths[data["book"]] = {int(k): len(v) for k, v in data["chapters"].items()}
    return lengths


def clamp(refs, lengths):
    """End a range at its chapter's last verse in the KJV data, as cases-from-book.py does."""
    for r in refs:
        last = lengths.get(r["book"], {}).get(r["chapter"])
        if not last or not r.get("verses"):
            continue
        parts = []
        for part in r["verses"].split(","):
            a, _, b = part.partition("-")
            a, b = int(a), int(b or a)
            b = min(b, last)
            if a <= last:
                parts.append(f"{a}-{b}" if b > a else str(a))
        r["verses"] = ",".join(parts)
    return [r for r in refs if "verses" not in r or r["verses"]]


SINGLE_CHAPTER = ("Obadiah", "Philemon", "Jude", "2 John", "3 John")


def cited(draft):
    """The draft's scripture cited, with a single-chapter book's verse written as chapter 1."""
    out = []
    for ref in draft.get("alsoCited", []):
        book_name, _, rest = ref.rpartition(" ")
        if book_name in SINGLE_CHAPTER and ":" not in rest:
            ref = f"{book_name} 1:{rest}"
        out.append(ref)
    return " · ".join(out)


def typeset(s):
    """The drafts use straight apostrophes (they carry no quotation marks); the book sets them curly."""
    return s.strip().replace("'", "\u2019")


def apply(draft, case, lengths):
    problems = []
    verdict = book.VERDICTS.get(draft["disp"])
    if not verdict:
        problems.append(f"unknown disposition {draft['disp']!r}")
    charge, summary = typeset(draft.get("charge", "")), typeset(draft.get("headnote", ""))
    for field, value in (("charge", charge), ("headnote", summary)):
        if not value:
            problems.append(f"no {field}")
    sections = draft["sections"]
    texts = [[typeset(p) for p in s[1]] for s in sections] if len(sections) == 2 else []
    if not texts or not all(t and all(t) for t in texts):
        problems.append("expected two sections, every paragraph with text")
    refs, bad = book.refs_from(cited(draft))
    if bad:
        problems.append(f"unreadable scripture {bad}")
    unknown = [r for r in refs if r["chapter"] not in lengths.get(r["book"], {})]
    if unknown:
        problems.append("unknown chapters " + ", ".join(f"{r['book']} {r['chapter']}" for r in unknown))
    refs = clamp(refs, lengths)
    if not refs:
        problems.append("no scripture cited")
    if problems:
        return None, problems
    out = dict(case)
    out.update({
        "charge": charge,
        "verdict": verdict,
        "summary": summary,
        "offenseFull": texts[0],
        "judgmentFull": texts[1],
        "refs": refs,
    })
    out["offense"] = out["offenseFull"][0]
    out["judgment"] = out["judgmentFull"][0]
    if verdict == "blessed":
        out["kind"] = "blessing"
    else:
        out.pop("kind", None)
    return out, []


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("drafts", type=Path)
    parser.add_argument("--keep", nargs="*", default=[], help="case codes to leave as they are")
    parser.add_argument("--check", action="store_true", help="report what would change; write nothing")
    args = parser.parse_args(argv)

    data = json.loads(CASES.read_text(encoding="utf-8"))
    by_code = {c["code"]: i for i, c in enumerate(data["cases"]) if c.get("code")}
    lengths = chapter_lengths()
    problems, changed, verdicts = [], [], []
    paths = sorted(args.drafts.glob("C[0-9][0-9][0-9].json")) if args.drafts.is_dir() else []
    if not paths:
        sys.exit(f"no C###.json drafts in {args.drafts}")
    for path in paths:
        draft = json.loads(path.read_text(encoding="utf-8"))
        code = draft.get("code")
        if code != path.stem:
            problems.append(f"{path.name}: its code is {code!r}, not {path.stem}")
            continue
        if code in args.keep:
            continue
        if code not in by_code:
            problems.append(f"{code}: no case with this code in data/cases.json")
            continue
        old = data["cases"][by_code[code]]
        new, errs = apply(draft, old, lengths)
        if errs:
            problems += [f"{code}: {e}" for e in errs]
            continue
        if new != old:
            changed.append(code)
            if new["verdict"] != old["verdict"]:
                verdicts.append(f"{code} {old['name']}: {old['verdict']} -> {new['verdict']}")
            data["cases"][by_code[code]] = new

    print(f"{len(changed)} cases updated from {args.drafts}; kept as they are: {', '.join(args.keep) or 'none'}")
    for v in verdicts:
        print("  verdict:", v)
    if problems:
        print(f"{len(problems)} problems:")
        for p in problems:
            print("  " + p)
        sys.exit("not written")
    if args.check:
        return
    data["source"] = ("Generated by scripts/cases-from-book.py from the Case Studies of the Bible manuscripts, "
                      "with the Volume I rewrite laid over it by scripts/cases-from-drafts.py until the book carries it. "
                      "Edit the book, not this file.")
    CASES.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {CASES.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
