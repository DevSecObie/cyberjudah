#!/usr/bin/env python3
"""Draft glossary entries and encyclopedia entries from the teachings, for human review.

    python3 scripts/ai/draft.py glossary --terms terms.tsv --estimate
    python3 scripts/ai/draft.py glossary --terms terms.tsv            # submit, wait, write drafts
    python3 scripts/ai/draft.py encyclopedia --subjects subjects.tsv
    python3 scripts/ai/draft.py collect BATCH_ID                     # resume after a timeout

Each term or subject gets an evidence pack from scripts/corpus/evidence.py (passages from the
recordings with the second each was said, KJV verses, scripture taught alongside), and one
request in a Message Batch to Claude, which may use nothing but that evidence. Results are
written into the working tree (glossary drafts merged into data/glossary.json without touching
entries already there; encyclopedia drafts to docs/encyclopedia/<slug>.md) with a review
report in dist/drafts/. The Draft transcript entries workflow turns them into a pull request;
nothing reaches the site until a person merges it.

Needs ANTHROPIC_API_KEY and the built corpus (npm run corpus:build). The input files are TSV:
term<TAB>aliases separated by ';' (glossary) or title<TAB>aliases (encyclopedia).
"""

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "corpus"))
import evidence  # noqa: E402

MODEL = "claude-opus-5"
# Batch pricing for claude-opus-5: half of $5 / $25 per million input / output tokens.
PRICE_IN, PRICE_OUT = 2.5 / 1e6, 12.5 / 1e6
DRAFTS = ROOT / "dist" / "drafts"
GLOSSARY = ROOT / "data" / "glossary.json"
ENCYCLOPEDIA = ROOT / "docs" / "encyclopedia"

SOURCES_RULES = """You write for CyberJudah, a library of the King James Bible (with the Apocrypha) and \
the teaching given from it in recorded classes (Sabbath classes, 15 Minutes w/ The Captains, and the \
Our Hidden History radio show).

You are given an evidence pack: excerpts from the automatic captions of the recordings, each with an \
id (E1, E2, ...), the recording's title and the second it was said; KJV verses; and the chapters most \
often taught alongside the subject. Use nothing else. No outside knowledge, no other translations, no \
other teachers or reference works.

- State what the teaching holds plainly, in the library's voice, as the notes do. Where the teaching \
goes beyond what the KJV text itself says (an identification, a history, an application), make that \
visible: "the teaching identifies...", "the classes read this as...".
- Captions are automatic and often mishear names, numbers and Hebrew words. Correct an obvious mishearing \
only when the evidence makes the intended word certain; never build a claim on a garbled passage.
- Cite only scripture that appears in the evidence (the KJV verses, the chapters taught alongside, or a \
reference spoken in an excerpt), written as "Book Chapter:Verse" or "Book Chapter:Verse-Verse" with the \
KJV's book names (e.g. "1 Kings 3:5", "Song of Solomon 1:5", "Sirach 26:10").
- If the evidence is too thin or contradictory to write something true, say so in notes_for_reviewer \
and keep the text short rather than filling it in.
- Plain English, no hype, no hedging filler."""

GLOSSARY_RULES = SOURCES_RULES + """

Write one glossary entry: a definition of one to four sentences of what the term means in the teaching, \
grounded in the KJV where the KJV speaks to it. List other spellings or forms the recordings use as \
aliases. Choose two to five excerpt ids where the term is actually taught (not merely mentioned) as \
moments; prefer different recordings."""

ENCYCLOPEDIA_RULES = SOURCES_RULES + """

Write one encyclopedia entry in the library's established shape (Markdown, no front matter):

1. One opening paragraph saying what the subject is and why the teaching returns to it.
2. Then sections headed "## <Book>" in canonical KJV order (Genesis ... Revelation, the Apocrypha after \
Malachi). Under each, one block per passage:

**[Genesis 25:24-26](/bible/genesis/25#v24)**  taught in [<recording title>](<excerpt url>)

- A bullet for each point the teaching makes from that passage, in plain sentences.
- Precept **[Obadiah 1:18](/bible/obadiah/1#v18)**: a supporting scripture the teaching reads with it.

Link scripture as /bible/<book-slug>/<chapter>#v<first verse>, where book-slug is the lower-case book \
name with spaces as hyphens ("1 Kings" -> 1-kings, "Song of Solomon" -> song-of-solomon). Use the \
excerpt's url (it carries the timestamp) for "taught in", with the recording title as link text. Only \
include passages the evidence actually teaches from. Aim for depth over coverage: 8 to 30 passages."""

GLOSSARY_SCHEMA = {
    "type": "object",
    "properties": {
        "term": {"type": "string"},
        "aliases": {"type": "array", "items": {"type": "string"}},
        "definition": {"type": "string"},
        "scripture": {"type": "array", "items": {"type": "string"}},
        "moments": {"type": "array", "items": {"type": "string"}},
        "notes_for_reviewer": {"type": "string"},
    },
    "required": ["term", "aliases", "definition", "scripture", "moments", "notes_for_reviewer"],
    "additionalProperties": False,
}
ENCYCLOPEDIA_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "description": {"type": "string"},
        "markdown": {"type": "string"},
        "notes_for_reviewer": {"type": "string"},
    },
    "required": ["title", "description", "markdown", "notes_for_reviewer"],
    "additionalProperties": False,
}


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or "entry"


def read_list(path):
    rows = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        cells = line.split("\t")
        rows.append((cells[0].strip(), [a.strip() for a in (cells[1] if len(cells) > 1 else "").split(";") if a.strip()]))
    return rows


def packs(kind, rows, corpus):
    excerpts = 24 if kind == "glossary" else 60
    built = evidence.pack_many(corpus, rows, excerpts, 20 if kind == "glossary" else 40)
    return [(term, pack) for (term, _aliases), pack in zip(rows, built)]


def request_params(kind, pack):
    rules, schema = (GLOSSARY_RULES, GLOSSARY_SCHEMA) if kind == "glossary" else (ENCYCLOPEDIA_RULES, ENCYCLOPEDIA_SCHEMA)
    # The rules are identical across the batch, so they are cached; the pack varies.
    return {
        "model": MODEL,
        "max_tokens": 16000 if kind == "glossary" else 32000,
        "thinking": {"type": "adaptive"},
        "output_config": {"effort": "high", "format": {"type": "json_schema", "schema": schema}},
        "system": [{"type": "text", "text": rules, "cache_control": {"type": "ephemeral"}}],
        "messages": [{"role": "user", "content": "Evidence pack:\n\n" + json.dumps(pack, ensure_ascii=False)}],
    }


def estimate(kind, jobs):
    # Roughly four characters per token; output sized to the task. For a budget, not an invoice.
    tokens_in = sum(len(json.dumps(p["messages"], ensure_ascii=False)) for _id, p in jobs) // 4
    tokens_in += len(jobs[0][1]["system"][0]["text"]) // 4 if jobs else 0
    tokens_out = len(jobs) * (2500 if kind == "glossary" else 12000)
    cost = tokens_in * PRICE_IN + tokens_out * PRICE_OUT
    print(f"{len(jobs)} {kind} requests · ~{tokens_in:,} input tokens · ~{tokens_out:,} output tokens (thinking included) "
          f"· about ${cost:,.2f} at batch prices for {MODEL}")


def submit(kind, jobs):
    import anthropic
    from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
    from anthropic.types.messages.batch_create_params import Request

    client = anthropic.Anthropic()
    batch = client.messages.batches.create(requests=[
        Request(custom_id=custom_id, params=MessageCreateParamsNonStreaming(**params)) for custom_id, params in jobs
    ])
    return batch.id


def wait(batch_id, timeout):
    import anthropic

    client = anthropic.Anthropic()
    deadline = time.time() + timeout
    while True:
        batch = client.messages.batches.retrieve(batch_id)
        if batch.processing_status == "ended":
            return True
        if time.time() > deadline:
            return False
        counts = batch.request_counts
        print(f"batch {batch_id}: {counts.processing} processing, {counts.succeeded} done", flush=True)
        time.sleep(60)


def results(batch_id):
    """{custom_id: (parsed JSON or None, problem or None)}."""
    import anthropic

    client = anthropic.Anthropic()
    out = {}
    for result in client.messages.batches.results(batch_id):
        kind = result.result.type
        if kind != "succeeded":
            detail = getattr(getattr(result.result, "error", None), "type", "") if kind == "errored" else ""
            out[result.custom_id] = (None, f"{kind} {detail}".strip())
            continue
        message = result.result.message
        if message.stop_reason == "refusal":
            category = getattr(message.stop_details, "category", None) if message.stop_details else None
            out[result.custom_id] = (None, f"refused ({category})")
            continue
        if message.stop_reason == "max_tokens":
            out[result.custom_id] = (None, "ran out of output tokens")
            continue
        text = next((b.text for b in message.content if b.type == "text"), "")
        try:
            out[result.custom_id] = (json.loads(text), None)
        except ValueError:
            out[result.custom_id] = (None, "unreadable JSON")
    return out


def moments_from(pack, ids):
    by_id = {e["id"]: e for e in pack["excerpts"]}
    return [{"title": by_id[i]["title"], "video": by_id[i]["video"], "seconds": int(by_id[i]["seconds"])} for i in ids if i in by_id]


def write_glossary(drafts, report):
    data = json.loads(GLOSSARY.read_text(encoding="utf-8")) if GLOSSARY.exists() else {"about": "", "entries": []}
    existing = {e.get("slug") or slugify(e["term"]) for e in data["entries"]}
    added = 0
    for draft, pack in drafts:
        slug = slugify(draft["term"])
        if slug in existing:
            report.append(f"- {draft['term']}: already in the glossary, draft not applied")
            continue
        data["entries"].append({
            "term": draft["term"], "slug": slug, "aliases": draft["aliases"], "definition": draft["definition"],
            "scripture": draft["scripture"], "see": [], "taught": moments_from(pack, draft["moments"]),
        })
        existing.add(slug)
        added += 1
        report.append(f"- **{draft['term']}** ({pack['recordings']} recordings). {draft['notes_for_reviewer'] or 'No notes.'}")
    data["entries"].sort(key=lambda e: e["term"].lower())
    GLOSSARY.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return added


def write_encyclopedia(drafts, report):
    added = 0
    for draft, pack in drafts:
        slug = slugify(draft["title"])
        path = ENCYCLOPEDIA / f"{slug}.md"
        if path.exists():
            report.append(f"- {draft['title']}: docs/encyclopedia/{slug}.md exists, draft not applied")
            continue
        description = draft["description"].replace('"', "'")
        path.write_text(f'---\ntitle: "{draft["title"]}"\nslug: "/encyclopedia/{slug}"\ndescription: "{description}"\n---\n\n'
                        + draft["markdown"].strip() + "\n", encoding="utf-8")
        added += 1
        report.append(f"- **{draft['title']}** → docs/encyclopedia/{slug}.md ({pack['recordings']} recordings). {draft['notes_for_reviewer'] or 'No notes.'}")
    return added


def apply_results(kind, batch_id, state):
    fetched = results(batch_id)
    report = [f"# Drafts from batch {batch_id}", "", f"{kind}, {MODEL}, {datetime.now(timezone.utc):%Y-%m-%d}. Review every entry against the linked moments before merging.", ""]
    drafts, problems = [], []
    for custom_id, (data, problem) in sorted(fetched.items()):
        pack = state["packs"].get(custom_id)
        if problem or pack is None:
            problems.append(f"- {state['names'].get(custom_id, custom_id)}: {problem or 'no evidence pack'}")
        else:
            drafts.append((data, pack))
    added = write_glossary(drafts, report) if kind == "glossary" else write_encyclopedia(drafts, report)
    if problems:
        report += ["", "## Not drafted", "", *problems]
    DRAFTS.mkdir(parents=True, exist_ok=True)
    (DRAFTS / "REPORT.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    print(f"{added} {kind} drafts written, {len(problems)} not drafted; see dist/drafts/REPORT.md")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--corpus", type=Path, default=ROOT / "dist" / "corpus")
    sub = parser.add_subparsers(dest="command", required=True)
    for kind, flag in (("glossary", "--terms"), ("encyclopedia", "--subjects")):
        p = sub.add_parser(kind)
        p.add_argument(flag, dest="list", type=Path, required=True)
        p.add_argument("--limit", type=int)
        p.add_argument("--estimate", action="store_true", help="print the size and cost, send nothing")
        p.add_argument("--wait-minutes", type=int, default=300)
    c = sub.add_parser("collect", help="write the drafts from a finished batch")
    c.add_argument("batch_id")
    args = parser.parse_args(argv)
    DRAFTS.mkdir(parents=True, exist_ok=True)
    state_path = DRAFTS / "state.json"

    if args.command == "collect":
        state = json.loads(state_path.read_text(encoding="utf-8"))
        if state["batch_id"] != args.batch_id:
            parser.error(f"dist/drafts/state.json belongs to batch {state['batch_id']}")
        apply_results(state["kind"], args.batch_id, state)
        return

    rows = read_list(args.list)[: args.limit]
    jobs, state = [], {"kind": args.command, "packs": {}, "names": {}}
    for term, pack in packs(args.command, rows, args.corpus):
        if not pack["recordings"]:
            print(f"skip {term}: never heard in the recordings")
            continue
        custom_id = slugify(term)
        state["packs"][custom_id], state["names"][custom_id] = pack, term
        jobs.append((custom_id, request_params(args.command, pack)))
    if not jobs:
        parser.error("nothing to draft")
    estimate(args.command, jobs)
    if args.estimate:
        return
    state["batch_id"] = submit(args.command, jobs)
    state_path.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
    print(f"submitted batch {state['batch_id']}")
    if wait(state["batch_id"], args.wait_minutes * 60):
        apply_results(args.command, state["batch_id"], state)
    else:
        print(f"still running; later: python3 scripts/ai/draft.py collect {state['batch_id']}")


if __name__ == "__main__":
    main()
