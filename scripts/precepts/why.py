#!/usr/bin/env python3
"""
The "Precept(s)" breakdowns: for every precept a class note lined up with a scripture, a
line or two on why it is there, written from the class. The Bible app shows them when a
reader taps "Precept(s)" under a verse; the engine attaches them to the precepts it reads
from the notes (engine/library.mjs, scanPrecepts).

    python3 scripts/precepts/why.py --plan            what is missing, and the cost
    python3 scripts/precepts/why.py --limit 20        write the first 20 passages' breakdowns
    python3 scripts/precepts/why.py                   write every missing one

Each request is one passage of one note: the scripture opened, the teacher's points, and
every precept under it with its verse and the note's line on it, with a few minutes of the
class's own words around that moment. Claude answers with one breakdown per precept. They
are kept in data/precepts/why.json, keyed "<note file>|<scripture opened>|<precept>", so a
note that changes only needs its new precepts written. Runs through the Message Batches API
(half price); needs ANTHROPIC_API_KEY.
"""
import argparse
import glob
import json
import os
import re
import sys
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "data", "precepts", "why.json")
MODEL = "claude-opus-5"
# Batch prices for claude-opus-5: half of $5 / $25 per million input / output tokens.
PRICE_IN, PRICE_OUT = 2.5 / 1e6, 12.5 / 1e6

HEAD = re.compile(r"^\*\*\[([^\]]+)\]\(/bible/([a-z0-9-]+)/(\d+)(?:#v(\d+))?\)\*\*(?:\s+\*\[\[?([\d:]+)\]?\(https://www\.youtube\.com/watch\?v=([A-Za-z0-9_-]{11})[^)]*\)\]\*)?")
PRECEPT = re.compile(r"^\s+-\s+\*\*\[([^\]]+)\]\(/bible/([a-z0-9-]+)/(\d+)(?:#v(\d+))?\)\*\*")
QUOTE = re.compile(r"^\s*>\s*(?:<sup>.*?</sup>\s*)?(.*)$")


def plain(s):
    s = re.sub(r"\*\[\[?[\d:]+\]?\([^)]*\)\]\*", "", s)
    s = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", s)
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", s.replace("**", "").replace("*", "")).strip()


def front(text):
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    meta = {}
    if m:
        for line in m.group(1).split("\n"):
            k, _, v = line.partition(":")
            meta[k.strip()] = v.strip().strip('"')
    return meta, text[m.end():] if m else text


def seconds(ts):
    n = 0
    for p in (ts or "").split(":"):
        n = n * 60 + int(p or 0)
    return n


def passages():
    """Every passage with precepts, in every class and Captains note, as the engine reads them."""
    out = []
    for path in sorted(glob.glob(os.path.join(ROOT, "blog", "*", "*.md")) + glob.glob(os.path.join(ROOT, "captains", "*", "*.md"))):
        meta, body = front(open(path, encoding="utf-8").read())
        rel = os.path.relpath(path, ROOT)
        cur = None
        precept = None

        def close():
            nonlocal precept
            if cur is not None and precept is not None:
                cur["precepts"].append(precept)
            precept = None

        for raw in body.split("\n"):
            h = HEAD.match(raw)
            if h:
                close()
                if cur and cur["precepts"]:
                    out.append(cur)
                cur = {"file": rel, "slug": h.group(2), "title": meta.get("title", ""), "teacher": meta.get("teacher", ""), "opened": h.group(1).strip(),
                       "ts": h.group(5) or "", "video": h.group(6) or "", "verse": "", "points": [], "precepts": []}
                continue
            if cur is None:
                continue
            pm = PRECEPT.match(raw)
            if pm:
                close()
                precept = {"label": pm.group(1).strip(), "slug": pm.group(2), "verse": "", "line": ""}
                continue
            if raw.startswith("- "):
                close()
                cur["points"].append(plain(raw[2:]))
                continue
            if re.match(r"^\S", raw) and not raw.startswith(">"):
                close()
                if raw.startswith("#"):
                    if cur["precepts"]:
                        out.append(cur)
                    cur = None
                continue
            q = QUOTE.match(raw)
            if raw.lstrip().startswith(">") and q:
                if precept is not None:
                    precept["verse"] = (precept["verse"] + " " + plain(q.group(1))).strip()
                elif not cur["precepts"]:
                    cur["verse"] = (cur["verse"] + " " + plain(q.group(1))).strip()
                continue
            if precept is not None and re.match(r"^\s{4}\S", raw) and not raw.strip().startswith("Precepts:"):
                precept["line"] = (precept["line"] + " " + plain(raw)).strip()
        close()
        if cur and cur["precepts"]:
            out.append(cur)
    return out


def key(p, pre):
    return f"{p['file']}|{p['opened']}|{pre['label']}"


_transcripts = {}


def spoken(video, ts, before=90, after=360, max_words=1400):
    """The class's own words around the moment the scripture was opened."""
    if not video:
        return ""
    if video not in _transcripts:
        f = os.path.join(ROOT, "blog", "transcripts", f"{video}.json")
        _transcripts[video] = json.load(open(f, encoding="utf-8")).get("segments", []) if os.path.exists(f) else []
    t0 = seconds(ts)
    words = []
    for s in _transcripts[video]:
        start = s.get("start", s.get("t", 0)) if isinstance(s, dict) else (s[0] if isinstance(s, list) else 0)
        text = s.get("text", "") if isinstance(s, dict) else (s[1] if isinstance(s, list) and len(s) > 1 else "")
        if t0 - before <= float(start) <= t0 + after:
            words.extend(str(text).split())
    return " ".join(words[:max_words])


SYSTEM = """You write the quick breakdowns in CyberJudah's Bible app. Under a verse, a reader taps "Precept(s)" and sees each precept a class lined up with that verse, its words, and your breakdown: why that precept is there.

For each precept you are given, write one or two sentences (at most 45 words) that say why the class paired it with the scripture opened: what the precept shows or proves about that verse, as the class taught it.

- Teach it plainly, as the class's understanding, in warm and simple words. Do not write "the teacher says", "the class teaches" or "this precept"; just say it.
- Stay inside what the class taught (the note's points, its line on the precept, and the class's own words). Never bring in other doctrine, other verses or outside commentary. If the material is thin, keep to what the two verses themselves plainly share.
- You may quote a few words of either verse exactly, in curly quotes. Do not quote anything else.
- Keep proper names and titles exactly as given.

Answer with JSON only: {"breakdowns": [{"precept": "<the precept's label exactly as given>", "why": "<the breakdown>"}]}"""

EXAMPLE_IN = """Scripture opened: Genesis 1:1
"In the beginning God created the heaven and the earth."
Class: The Kingdom Of Adam And The Old World
Points:
- The earth was without form, and the deep is space.
- 'Let there be light' is the first thing created, the light that is Christ, before the sun and moon existed.
Precepts:
1. 2 Esdras 6:38: "And I said, O Lord, thou spakest from the beginning of the creation, even the first day, and saidst thus; Let heaven and earth be made; and thy word was a perfect work." Note's line: God spoke from the beginning, and brought a light out of his treasures.
2. John 1:4: "In him was life; and the life was the light of men." Note's line: In him was life, and the life was the light of men.
3. John 8:12: "Then spake Jesus again unto them, saying, I am the light of the world: he that followeth me shall not walk in darkness, but shall have the light of life." Note's line: I am the light of the world."""
EXAMPLE_OUT = json.dumps({"breakdowns": [
    {"precept": "2 Esdras 6:38", "why": "Ezra says God spoke on the first day and brought a light out of his treasures. That light came before the sun and moon, so the beginning started with God's word and that light, not with the earth."},
    {"precept": "John 1:4", "why": "“In him was life; and the life was the light of men.” The light made first is Christ, so “in the beginning” begins with him."},
    {"precept": "John 8:12", "why": "Christ calls himself “the light of the world”, naming himself as the light God called forth on the first day."},
]}, ensure_ascii=False)


def prompt(p):
    lines = [f"Scripture opened: {p['opened']}"]
    if p["verse"]:
        lines.append(f"\"{p['verse']}\"")
    lines.append(f"Class: {p['title']}" + (f" ({p['teacher']})" if p["teacher"] else ""))
    if p["points"]:
        lines.append("Points:")
        lines += [f"- {x}" for x in p["points"][:8]]
    lines.append("Precepts:")
    for i, pre in enumerate(p["precepts"], 1):
        lines.append(f"{i}. {pre['label']}: \"{pre['verse']}\"" + (f" Note's line: {pre['line']}" if pre["line"] else ""))
    said = spoken(p["video"], p["ts"])
    if said:
        lines.append(f"\nThe class's own words around this moment (captions, unpunctuated and mis-heard in places):\n{said}")
    return "\n".join(lines)


def request(p):
    return {
        "model": MODEL,
        "max_tokens": 1200,
        "system": SYSTEM,
        "messages": [
            {"role": "user", "content": EXAMPLE_IN},
            {"role": "assistant", "content": EXAMPLE_OUT},
            {"role": "user", "content": prompt(p)},
        ],
    }


def load():
    return json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {}


def save(done):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(done.items())), f, ensure_ascii=False, indent=1)
        f.write("\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", action="store_true", help="count what is missing and the cost; send nothing")
    ap.add_argument("--limit", type=int, default=0, help="at most this many passages this run")
    ap.add_argument("--timeout", type=int, default=5400, help="seconds to wait for the batch")
    ap.add_argument("--show", action="store_true", help="print the breakdowns written")
    ap.add_argument("--book", help="only passages where this book (slug, e.g. genesis) is opened or a precept")
    ap.add_argument("--export", help="write the briefs for what is missing to this directory, one file per passage, and stop")
    ap.add_argument("--merge", help="merge breakdowns written by hand: a JSON file {key: why} (keys as in the brief)")
    args = ap.parse_args()

    done = load()
    if args.merge:
        got = json.load(open(args.merge, encoding="utf-8"))
        valid = {key(p, pre) for p in passages() for pre in p["precepts"]}
        bad = [k for k in got if k not in valid]
        ok = {k: v.strip() for k, v in got.items() if k in valid and v.strip() and len(v.split()) <= 70}
        done.update(ok)
        save(done)
        print(f"merged {len(ok)} breakdowns; {len(bad)} keys not found, {len(got) - len(ok) - len(bad)} too long or empty")
        for k in bad[:10]:
            print("  unknown: " + k)
        return
    todo = [p for p in passages() if any(key(p, pre) not in done for pre in p["precepts"])]
    if args.book:
        slug = args.book.lower()
        todo = [p for p in todo if p.get("slug") == slug or any(pre.get("slug") == slug for pre in p["precepts"])]
    if args.export:
        os.makedirs(args.export, exist_ok=True)
        for i, p in enumerate(todo):
            keys = [key(p, pre) for pre in p["precepts"] if key(p, pre) not in done]
            with open(os.path.join(args.export, f"{i:04d}.txt"), "w", encoding="utf-8") as f:
                f.write(prompt(p) + "\n\nKEYS (answer {key: why} for each):\n" + "\n".join(keys) + "\n")
        print(f"{len(todo)} briefs written to {args.export} · {sum(len(p['precepts']) for p in todo)} precepts")
        return
    if args.limit:
        todo = todo[: args.limit]
    precepts = sum(len(p["precepts"]) for p in todo)
    tin = sum(len(json.dumps(request(p))) // 4 for p in todo)
    tout = precepts * 70
    print(f"{len(todo)} passages · {precepts} precepts missing a breakdown · ~{tin:,} input / ~{tout:,} output tokens · about ${tin * PRICE_IN + tout * PRICE_OUT:,.2f} at batch prices for {MODEL}")
    if args.plan or not todo:
        return

    import anthropic
    client = anthropic.Anthropic()
    ids = {f"p{i}": p for i, p in enumerate(todo)}
    batch = client.messages.batches.create(requests=[{"custom_id": cid, "params": request(p)} for cid, p in ids.items()])
    print(f"batch {batch.id} submitted", flush=True)
    deadline = time.time() + args.timeout
    while True:
        b = client.messages.batches.retrieve(batch.id)
        if b.processing_status == "ended":
            break
        if time.time() > deadline:
            print(f"batch {batch.id} still running; run again later to collect", file=sys.stderr)
            sys.exit(1)
        print(f"batch {batch.id}: {b.request_counts.processing} processing, {b.request_counts.succeeded} done", flush=True)
        time.sleep(30)

    wrote, problems = 0, []
    for r in client.messages.batches.results(batch.id):
        p = ids.get(r.custom_id)
        if not p:
            continue
        if r.result.type != "succeeded" or r.result.message.stop_reason in ("refusal", "max_tokens"):
            problems.append(f"{p['file']} {p['opened']}: {r.result.type}")
            continue
        text = next((c.text for c in r.result.message.content if c.type == "text"), "")
        try:
            got = json.loads(text[text.find("{"): text.rfind("}") + 1])
        except ValueError:
            problems.append(f"{p['file']} {p['opened']}: unreadable JSON")
            continue
        by = {str(x.get("precept", "")).strip(): str(x.get("why", "")).strip() for x in got.get("breakdowns", []) if isinstance(x, dict)}
        for pre in p["precepts"]:
            why = by.get(pre["label"])
            if why and len(why.split()) <= 70:
                done[key(p, pre)] = why
                wrote += 1
                if args.show:
                    print(f"- {p['opened']} ← {pre['label']}: {why}")
    save(done)
    print(f"wrote {wrote} breakdowns; {len(problems)} passages had problems")
    for x in problems[:20]:
        print("  " + x)


if __name__ == "__main__":
    main()
