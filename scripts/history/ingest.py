#!/usr/bin/env python3
"""Turn a YouTube caption file into a verbatim transcript record for the vault.

    python3 scripts/history/ingest.py <caption file> --id VIDEOID --title "..." --date YYYY-MM-DD --duration SECONDS

Accepts YouTube's json3 caption format (yt-dlp --sub-format json3) or the transcriptAPI json
({"transcript":[{"text","start","duration"}]}). Writes history/transcripts/<VIDEOID>.json:

    {"videoId", "title", "episode", "date", "duration", "start", "segments": [[seconds, text], ...]}

Nothing is paraphrased. The only edits: caption noise ([music], [applause]) is dropped,
whitespace is normalised, and `start` marks the second the speakers begin (intro music and
the countdown before it are skipped when the transcript is read on the site).
"""
import argparse, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "history", "transcripts")
NOISE = re.compile(r"\[(music|applause|laughter|inaudible|__)\]|\b(heat\.?\s*)+$", re.I)

def load(path):
    d = json.load(open(path))
    segs = []
    if "events" in d:  # json3
        for e in d["events"]:
            if "segs" not in e: continue
            text = "".join(s.get("utf8", "") for s in e["segs"]).replace("\n", " ")
            segs.append((e.get("tStartMs", 0) / 1000.0, text))
    else:
        c = d.get("content", d)
        for x in c["transcript"]:
            segs.append((float(x.get("start", x.get("offset", 0))), x.get("text", "")))
    out = []
    for t, text in segs:
        text = re.sub(r"\s+", " ", text).strip()
        if not text or text == "[music]" or NOISE.fullmatch(text): continue
        text = re.sub(r"\[(music|applause|laughter)\]", "", text, flags=re.I).strip()
        if text: out.append([round(t, 2), text])
    return out

def speech_start(segs):
    """The first run of five segments of real speech: at least six words, none of them noise."""
    def real(s): return len(s[1].split()) >= 6 and not NOISE.search(s[1])
    for i in range(len(segs) - 5):
        if all(real(segs[i + k]) for k in range(5)): return segs[i][0]
    return segs[0][0] if segs else 0

def episode_number(title):
    m = re.search(r"\bEP(?:ISODE)?\.?\s*(\d+)\b", title, re.I)
    return int(m.group(1)) if m else None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("caption"); ap.add_argument("--id", required=True); ap.add_argument("--title", required=True)
    ap.add_argument("--date", default=None); ap.add_argument("--duration", type=float, default=None); ap.add_argument("--views", type=int, default=None)
    a = ap.parse_args()
    segs = load(a.caption)
    rec = {"videoId": a.id, "title": a.title.strip(), "episode": episode_number(a.title), "date": a.date, "duration": a.duration, "views": a.views,
           "start": speech_start(segs), "words": sum(len(s[1].split()) for s in segs), "segments": segs}
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, f"{a.id}.json")
    with open(p, "w") as f: json.dump(rec, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{p}: {len(segs)} segments, {rec['words']} words, speech from {rec['start']}s")

if __name__ == "__main__": main()
