#!/usr/bin/env python3
"""Evidence from the teachings for glossary terms and encyclopedia subjects.

    python3 scripts/corpus/evidence.py candidates [--top 400] > candidates.tsv
    python3 scripts/corpus/evidence.py pack "Edom" --alias Edomite --alias Edomites > edom.json

`candidates` ranks possible glossary terms by how many recordings use them: proper names
from the KJV (with the Apocrypha) and the titles of the library's own subjects (precepts,
topics, law sections, encyclopedia entries).

`pack` gathers what a writer (or a model) needs to define a term or draft an entry without
going beyond the sources: how often and where it is taught, excerpts with the second each
was said, the KJV verses that contain it, and the scripture most often taught alongside it.
Only spoken passages from recordings with speech and unique text are used.

Both read the built corpus (`npm run corpus:build`, default dist/corpus).
"""

import argparse
import bisect
import gzip
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sources  # noqa: E402

SKIP_FLAGS = {"no_speech_content", "duplicate_content"}
BIBLE = sources.ROOT / "data" / "bible"
DATA = sources.ROOT / "data"
WORD = re.compile(r"[A-Za-z][A-Za-z'-]*")
# Capitalized KJV words that are not names or terms: pronouns, sentence openers, divine titles
# handled as multi-word terms instead.
NOT_NAMES = set("""I O A And The Then But For Now When Thus So Therefore Behold Also Yea Wherefore
Moreover Neither Nor Let If In Is It As All Who Whom Which What Why How Also After Before Then
My Thy Thine Mine His Her Their Our Your Ye Thou He She They We Them Him Me Us This That These
Those There Here Lo Nay Yet Unto Upon By With From Of To At Not No Go Come Hear Know See
Let Blessed Woe Surely Verily Because Howbeit Notwithstanding Until Whosoever Whatsoever Every
Seeing Being Having Now Amen Selah Shall Will Ah Oh Even Though Although Whether Else Only""".split())
EXCERPT_WORDS = 70


def spoken_passages(corpus):
    """(document, passage) for every spoken passage worth quoting, in corpus order."""
    docs = {d["doc_id"]: d for d in map(json.loads, (corpus / "documents.jsonl").open(encoding="utf-8"))}
    with gzip.open(corpus / "segments.jsonl.gz", "rt", encoding="utf-8") as rows:
        for line in rows:
            passage = json.loads(line)
            doc = docs[passage["doc_id"]]
            if passage.get("region") != "speech" or SKIP_FLAGS.intersection(doc["quality_flags"]):
                continue
            yield doc, passage


def seconds_at(passage, position):
    """Recording time of a character position in a passage's normalized text."""
    offsets = passage.get("cue_offsets") or []
    if not offsets:
        return passage["start_seconds"]
    utf16 = len(passage["text_normalized"][:position].encode("utf-16-le")) // 2
    index = bisect.bisect_right([o[0] for o in offsets], utf16) - 1
    return offsets[max(index, 0)][1]


def bible_books():
    for path in sorted(BIBLE.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict) and "chapters" in data:  # index.json lists the books
            yield path.stem, data["book"], data["chapters"]


def term_pattern(terms):
    alternatives = sorted({t.strip() for t in terms if t.strip()}, key=len, reverse=True)
    return re.compile(r"(?<![A-Za-z])(?:" + "|".join(re.escape(t) for t in alternatives) + r")(?![A-Za-z])", re.I)


# ---------------------------------------------------------------- candidates

def kjv_names():
    """Words the KJV capitalizes nearly every time they appear mid-sentence: names of people,
    places, nations and feasts, and titles such as LORD's "God" or "Christ"."""
    capital, lower = Counter(), Counter()
    for _slug, _book, chapters in bible_books():
        for verses in chapters.values():
            for verse in verses:
                for sentence in re.split(r"[.?!:;]\s+", verse):
                    for word in WORD.findall(sentence)[1:]:
                        if word.isupper() or word in NOT_NAMES or len(word) < 3:
                            continue
                        if word[0].isupper():
                            capital[word] += 1
                        else:
                            lower[word.capitalize()] += 1
    return {w for w, n in capital.items() if n >= 2 and n >= 9 * lower[w]}


def library_subjects():
    """Titles of the library's own subjects, as candidate glossary terms."""
    subjects = {}
    precepts = DATA / "precepts.json"
    if precepts.exists():
        data = json.loads(precepts.read_text(encoding="utf-8"))
        for p in (data if isinstance(data, list) else data.get("topics", [])):
            if p.get("title"):
                subjects[p["title"]] = "precept"
    topics = DATA / "topics.tsv"
    if topics.exists():
        for line in topics.read_text(encoding="utf-8").splitlines()[1:]:
            if line.strip():
                subjects.setdefault(line.split("\t")[0], "topic")
    for path in sorted((sources.ROOT / "docs" / "encyclopedia").glob("*.md")):
        title = re.search(r'^title:\s*"?(.+?)"?\s*$', path.read_text(encoding="utf-8"), re.M)
        if title:
            subjects.setdefault(title.group(1), "encyclopedia")
    return subjects


def candidates(corpus, top):
    names = kjv_names()
    subjects = library_subjects()
    phrases = {s.lower(): (s, kind) for s, kind in subjects.items() if 1 <= len(s.split()) <= 4}
    single = {n.lower(): (n, "kjv-name") for n in names}
    single.update({k: v for k, v in phrases.items() if " " not in k})
    multi = {k: v for k, v in phrases.items() if " " in k}
    by_first = defaultdict(list)
    for phrase in multi:
        by_first[phrase.split()[0]].append(phrase.split())

    recordings, mentions = defaultdict(set), Counter()
    for doc, passage in spoken_passages(corpus):
        words = [w.lower() for w in WORD.findall(passage["text_normalized"])]
        for i, word in enumerate(words):
            if word in single:
                recordings[word].add(doc["doc_id"])
                mentions[word] += 1
            for parts in by_first.get(word, ()):
                if words[i:i + len(parts)] == parts:
                    key = " ".join(parts)
                    recordings[key].add(doc["doc_id"])
                    mentions[key] += 1
    table = {**single, **multi}
    ranked = sorted(recordings, key=lambda k: (-len(recordings[k]), -mentions[k], k))[:top]
    print("term\tkind\trecordings\tmentions")
    for key in ranked:
        term, kind = table[key]
        print(f"{term}\t{kind}\t{len(recordings[key])}\t{mentions[key]}")


# ---------------------------------------------------------------- evidence pack

def kjv_verses(pattern, limit):
    found, total = [], 0
    for slug, book, chapters in bible_books():
        for chapter, verses in chapters.items():
            for number, text in enumerate(verses, 1):
                if pattern.search(text):
                    total += 1
                    if len(found) < limit:
                        found.append({"ref": f"{book} {chapter}:{number}", "url": f"/bible/{slug}/{chapter}#v{number}", "text": text})
    return total, found


def excerpt(text, start, end):
    words = list(re.finditer(r"\S+", text))
    at = next((i for i, w in enumerate(words) if w.end() > start), 0)
    lo = max(0, at - EXCERPT_WORDS // 2)
    hi = min(len(words), lo + EXCERPT_WORDS)
    lead = "… " if lo else ""
    tail = " …" if hi < len(words) else ""
    return lead + text[words[lo].start():words[hi - 1].end()] + tail


def pack(corpus, term, aliases, excerpts, verses):
    return pack_many(corpus, [(term, aliases)], excerpts, verses)[0]


def pack_many(corpus, terms, excerpts, verses):
    """Evidence packs for several (term, aliases) at once, reading the corpus a single time."""
    patterns = [term_pattern([t, *a]) for t, a in terms]
    # One pass: a single pattern of every form of every term, each form mapped back to its term.
    # Where forms overlap, the longest wins ("children of Israel" before "Israel").
    owner = {}
    for i, (t, a) in enumerate(terms):
        for form in [t, *a]:
            owner.setdefault(form.strip().lower(), i)
    combined = term_pattern(list(owner))
    per_recording = [defaultdict(list) for _ in terms]
    related = [Counter() for _ in terms]
    documents = {}
    for doc, passage in spoken_passages(corpus):
        found = set()
        for m in combined.finditer(passage["text_normalized"]):
            i = owner[m.group(0).lower()]
            per_recording[i][doc["doc_id"]].append((passage, m))
            found.add(i)
        if not found:
            continue
        documents[doc["doc_id"]] = doc
        refs = [f"{r['book']} {r['chapter']}" for r in passage.get("scripture_references") or [] if r.get("verified")]
        for i in found:
            related[i].update(refs)
    return [_assemble(term, aliases, patterns[i], per_recording[i], related[i], documents, excerpts, verses)
            for i, (term, aliases) in enumerate(terms)]


def _assemble(term, aliases, pattern, per_recording, related, documents, excerpts, verses):
    feeds, years = Counter(), Counter()
    for doc_id in per_recording:
        doc = documents[doc_id]
        feeds[doc["feed"]] += 1
        years[doc["date"][:4] if doc["date"] else "undated"] += 1

    # Spread excerpts across the recordings that dwell on the term most. From each, take the
    # passage where it is taught rather than merely named: the one with the most mentions,
    # preferring passages that also cite scripture (greetings and openings rarely do).
    def teaching_passage(hits):
        by_passage = defaultdict(list)
        for passage, m in hits:
            by_passage[passage["segment_id"]].append((passage, m))
        return max(by_passage.values(), key=lambda group: (
            len(group) + 3 * bool(group[0][0].get("scripture_references")), -group[0][0]["segment_index"]))

    ranked = sorted(per_recording, key=lambda d: (-len(per_recording[d]), documents[d]["date"] or "", d))
    chosen = []
    for doc_id in ranked[:excerpts]:
        group = teaching_passage(per_recording[doc_id])
        passage, m = group[len(group) // 2]
        doc = documents[doc_id]
        at = seconds_at(passage, m.start())
        chosen.append({
            "id": f"E{len(chosen) + 1}",
            "title": doc["title"],
            "feed": doc["feed"],
            "date": doc["date"],
            "video": doc["video_id"],
            "seconds": round(at, 2),
            "url": f"https://www.youtube.com/watch?v={doc['video_id']}&t={int(at)}s",
            "note": doc["note_path"],
            "text": excerpt(passage["text_normalized"], m.start(), m.end()),
        })
    total_verses, sample = kjv_verses(pattern, verses)
    return {
        "term": term,
        "aliases": aliases,
        "recordings": len(per_recording),
        "mentions": sum(len(h) for h in per_recording.values()),
        "by_feed": dict(feeds.most_common()),
        "by_year": dict(sorted(years.items())),
        "kjv_verse_count": total_verses,
        "kjv_verses": sample,
        "taught_alongside": [{"chapter": c, "passages": n} for c, n in related.most_common(15)],
        "excerpts": chosen,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--corpus", type=Path, default=sources.ROOT / "dist" / "corpus")
    sub = parser.add_subparsers(dest="command", required=True)
    c = sub.add_parser("candidates", help="rank possible glossary terms")
    c.add_argument("--top", type=int, default=400)
    p = sub.add_parser("pack", help="gather the evidence for one term")
    p.add_argument("term")
    p.add_argument("--alias", action="append", default=[], help="another spelling or form; repeatable")
    p.add_argument("--excerpts", type=int, default=24)
    p.add_argument("--verses", type=int, default=20)
    args = parser.parse_args(argv)
    if not (args.corpus / "documents.jsonl").exists():
        parser.error(f"no corpus at {args.corpus}; run npm run corpus:build first")
    if args.command == "candidates":
        candidates(args.corpus, args.top)
    else:
        json.dump(pack(args.corpus, args.term, args.alias, args.excerpts, args.verses), sys.stdout, ensure_ascii=False, indent=1)
        print()


if __name__ == "__main__":
    main()
