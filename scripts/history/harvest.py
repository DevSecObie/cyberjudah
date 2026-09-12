#!/usr/bin/env python3
"""Archive a channel's transcript files into the vault.

    python3 scripts/history/harvest.py --feed classes  --channel IUICintheClassRoom  [--limit 200] [--push]
    python3 scripts/history/harvest.py --feed captains --channel iuiccaptains6939
    python3 scripts/history/harvest.py --feed history  --channel ourhiddenhistoryradio1991

By default, this uses yt-dlp (legacy behavior). `--backend transcriptapi` pulls
the channel listing and transcripts from transcriptAPI instead.
"""

import argparse
import glob
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ingest import FEEDS

BASE_URL = "https://transcriptapi.com/api/v2"
API_KEY_ENV = ("TRANSCRIPTAPI_KEY", "TRANSCRIPT_API_KEY", "TRANSCRIPTAPI_API_KEY")


def sh(cmd, **kw):
    return subprocess.run(cmd, text=True, capture_output=True, **kw)


def api_key():
    for env in API_KEY_ENV:
        val = os.environ.get(env)
        if val:
            return val.strip()
    return None


def api_get(path, params, *, timeout=60, retries=3):
    key = api_key()
    if not key:
        return None, {
            "error": "missing_api_key",
            "detail": "Set TRANSCRIPTAPI_KEY (or TRANSCRIPT_API_KEY / TRANSCRIPTAPI_API_KEY)."
        }, None

    req = Request(
        f"{BASE_URL}{path}?{urlencode(params)}",
        headers={"Authorization": f"Bearer {key}", "Accept": "application/json"},
    )
    last = None
    for attempt in range(retries):
        try:
            with urlopen(req, timeout=timeout) as r:
                return r.getcode(), json.load(r), dict(r.headers)
        except HTTPError as e:
            payload = {}
            text = e.read().decode("utf-8", errors="replace")
            if text:
                try:
                    payload = json.loads(text)
                except Exception:
                    payload = {"detail": text}
            else:
                payload = {"detail": e.reason}

            if e.code in (408, 429, 502, 503) and attempt < retries - 1:
                wait = float(e.headers.get("Retry-After", "5"))
                time.sleep(min(wait + 1, 20))
                last = e.code
                continue
            return e.code, payload, dict(e.headers)
        except (URLError, TimeoutError) as e:
            last = e
            if attempt < retries - 1:
                time.sleep(min((attempt + 1) * 2, 10))
                continue
            return None, {"error": "network", "detail": str(e)}, None
    return None, {"error": "network", "detail": str(last)}, None


def parse_length(text):
    if not text:
        return None
    s = str(text).strip()
    if not s or not re.fullmatch(r"[\d:]+", s):
        return None
    sec = 0
    for part in s.split(":"):
        sec = sec * 60 + int(part)
    return sec


def parse_views(v):
    if v is None:
        return None
    s = str(v).strip().replace(",", "").replace(" ", "").lower()
    if not s or s == "na":
        return None
    m = re.fullmatch(r"([0-9]+(?:\.[0-9]+)?)([kmb]?)", s)
    if not m:
        digits = re.sub(r"\D", "", s)
        return int(digits) if digits else None
    n, suf = m.groups()
    mult = {"k": 1_000, "m": 1_000_000, "b": 1_000_000_000, "": 1}[suf]
    return int(float(n) * mult)


def parse_date(value):
    if not value:
        return None
    s = str(value)
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return None


def listing_yt(channel, tab):
    r = sh(["yt-dlp", "--flat-playlist", "--print", "%(id)s\t%(duration)s\t%(title)s", f"https://www.youtube.com/@{channel}/{tab}"])
    rows = []
    for line in r.stdout.splitlines():
        p = line.split("\t")
        if len(p) == 3 and re.fullmatch(r"[\w-]{11}", p[0]):
            rows.append((p[0], p[1], p[2], None, None))
    return rows


def listing_api(channel):
    rows = []
    continuation = None
    while True:
        payload_key = "content"
        params = {"continuation": continuation} if continuation else {"channel": channel}
        code, payload, _ = api_get("/youtube/channel/videos", params)
        if code != 200:
            print(f"transcriptAPI listing failed: {code} {payload.get('detail')}", flush=True)
            return rows

        c = payload.get(payload_key, payload)
        if not isinstance(c, dict):
            return rows
        for r in c.get("results", []) or c.get("videos", []):
            vid = r.get("videoId") or r.get("video_id")
            if not vid:
                continue
            rows.append((
                vid,
                r.get("lengthText"),
                r.get("title"),
                parse_date(r.get("published") or r.get("publishedAt")),
                parse_views(r.get("viewCount") or r.get("viewCountText"))
            ))

        if not c.get("has_more") or not c.get("continuation_token"):
            break
        continuation = c.get("continuation_token")
        time.sleep(1)
    return rows


def fetch_transcript(video_id):
    params = {
        "video_url": video_id,
        "format": "json",
        "include_timestamp": "true",
        "send_metadata": "true",
    }
    return api_get("/youtube/transcript", params)


def ingest_payload(raw_path, *, video_id, title, feed, date, duration, views):
    cmd = [sys.executable, os.path.join(ROOT, "scripts", "history", "ingest.py"), raw_path, f"--id={video_id}", f"--title={title}", f"--feed={feed}"]
    if date:
        cmd.append(f"--date={date}")
    if duration is not None:
        cmd.append(f"--duration={duration}")
    if views is not None:
        cmd.append(f"--views={views}")
    return cmd


def commit_and_push(root, fdir, tdir, nocap, agegate, meta_all, added, nosub, feed):
    sh(["git", "-C", root, "add", "--", *[p for p in (tdir, nocap, agegate, meta_all) if os.path.exists(p)]])
    sh([
        "git", "-C", root, "commit", "-q",
        "-m", f"transcripts: {feed} +{len(added)} ({len(added) + nosub} this run)\n\nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
    ])
    tok = os.environ.get("GJT", "")
    env = {k: v for k, v in os.environ.items() if k.lower() not in ("https_proxy", "http_proxy")}
    r = None
    for attempt in range(3):
        r = sh([
            "git", "-C", root, "-c", "http.proxy=", "-c",
            "credential.helper=!f() { echo username=x-access-token; echo \"password=$GJT\"; }; f",
            "push", "origin", "HEAD:main"
        ], env=env)
        if r.returncode == 0:
            break
        sh([
            "git", "-C", root, "-c", "http.proxy=", "-c",
            "credential.helper=!f() { echo username=x-access-token; echo \"password=$GJT\"; }; f",
            "pull", "--rebase", "-q", "origin", "main"
        ], env=env)
    if r is not None:
        print(f"push: {'ok' if r.returncode == 0 else re.sub(r'github_pat_[A-Za-z0-9_]*', '[REDACTED]', r.stderr.strip()[-300:])}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--feed", required=True, choices=sorted(FEEDS))
    ap.add_argument("--channel", required=True)
    ap.add_argument("--backend", default="yt-dlp", choices=("yt-dlp", "transcriptapi"))
    ap.add_argument("--limit", type=int, default=100000)
    ap.add_argument("--batch", type=int, default=25)
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--tabs", default="videos,streams")
    a = ap.parse_args()

    fdir = os.path.join(ROOT, FEEDS[a.feed]); tdir = os.path.join(fdir, "transcripts"); os.makedirs(tdir, exist_ok=True)
    nocap = os.path.join(fdir, "no-captions.tsv"); meta_all = os.path.join(fdir, "channel-meta.tsv")
    agegate = os.path.join(fdir, "age-restricted.tsv")  # still tracked so they are not retried every run

    seen, rows = set(), []
    if a.backend == "yt-dlp":
        for tab in a.tabs.split(","):
            for row in listing_yt(a.channel, tab):
                if row[0] not in seen:
                    seen.add(row[0]); rows.append(row)
    else:
        for row in listing_api(a.channel):
            if row[0] not in seen:
                seen.add(row[0]); rows.append(row)

    done = {os.path.basename(p)[:-5] for p in glob.glob(os.path.join(tdir, "*.json"))}
    for f in (nocap, agegate):
        if os.path.exists(f):
            done |= {l.split("\t")[0] for l in open(f) if l.strip()}
    todo = [r for r in rows if r[0] not in done][: a.limit]
    print(
        f"{a.channel}: {len(rows)} videos on the channel, "
        f"{sum(1 for r in rows if r[0] in done)} already in the vault, {len(todo)} to fetch",
        flush=True
    )

    raw = os.path.join(ROOT, ".harvest-raw"); os.makedirs(raw, exist_ok=True)
    got = nosub = failed = 0

    for i in range(0, len(todo), a.batch):
        batch = todo[i:i + a.batch]
        added = []

        if a.backend == "yt-dlp":
            ids = os.path.join(raw, "ids.txt"); meta = os.path.join(raw, "meta.tsv")
            open(ids, "w").write("".join(f"https://www.youtube.com/watch?v={r[0]}\n" for r in batch))
            if os.path.exists(meta):
                os.remove(meta)
            y = sh([
                "yt-dlp", "--ignore-errors", "--skip-download", "--write-subs", "--write-auto-subs", "--sub-langs", "en.*", "--sub-format", "json3",
                "--sleep-requests", "2", "--sleep-subtitles", "3", "--retries", "5", "--extractor-retries", "3",
                "--print-to-file", "%(id)s\t%(upload_date)s\t%(duration)s\t%(title)s\t%(view_count)s\t%(subtitles.en.0.ext)s\t%(automatic_captions.en.0.ext)s",
                meta, "-o", os.path.join(raw, "%(id)s"), "-a", ids
            ])
            aged = set(re.findall(r"\[youtube\] ([\w-]{11}): Sign in to confirm your age", y.stderr))
            metas = {}
            if os.path.exists(meta):
                for l in open(meta):
                    p = l.rstrip("\n").split("\t")
                    if len(p) == 7:
                        metas[p[0]] = p
            listed = [v for v, m in metas.items() if m[5] != "NA" or m[6] != "NA"]
            if listed and not any(glob.glob(os.path.join(raw, f"{v}.*.json3")) for v in listed):
                print(f"rate limited: {len(listed)} videos have captions but none came through; sleeping 240s and retrying the batch", flush=True)
                time.sleep(240)
                sh(["yt-dlp", "--ignore-errors", "--skip-download", "--write-subs", "--write-auto-subs", "--sub-langs", "en.*", "--sub-format", "json3",
                    "--sleep-requests", "4", "--sleep-subtitles", "6", "--retries", "5",
                    "-o", os.path.join(raw, "%(id)s"), "-a", ids
                ])
                if not any(glob.glob(os.path.join(raw, f"{v}.*.json3")) for v in listed):
                    print("still rate limited; stopping this run (rerun later, it resumes)", flush=True)
                    break

        for vid, duration_hint, title, published, views_hint in batch:
            files = []
            file_date = None
            file_duration = None
            file_views = None
            m = None

            if a.backend == "yt-dlp":
                files = sorted(glob.glob(os.path.join(raw, f"{vid}.*.json3")))
                if files:
                    with open(os.path.join(raw, "meta.tsv")) as mf:
                        for l in mf:
                            p = l.rstrip("\n").split("\t")
                            if len(p) == 7 and p[0] == vid:
                                m = p
                                break
                if m:
                    upload_date = m[1]
                    file_date = f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:]}" if re.fullmatch(r"\d{8}", upload_date) else None
                    file_duration = m[2] if m[2] not in ("NA", "") else None
                    file_views = m[4] if m[4] not in ("NA", "") else None
            else:
                code, payload = fetch_transcript(vid)
                if code == 200:
                    p = payload.get("metadata", payload)
                    raw_path = os.path.join(raw, f"{vid}.transcript.json")
                    with open(raw_path, "w", encoding="utf-8") as fh:
                        json.dump(payload, fh, ensure_ascii=False)
                    files = [raw_path]
                    file_date = published
                    file_duration = p.get("duration") or p.get("length_seconds") or parse_length(duration_hint)
                    file_views = p.get("view_count") or p.get("views") or views_hint
                    title = p.get("title") or title
                    if file_views is None and p.get("views_text"):
                        file_views = parse_views(p.get("views_text"))
                elif code in (400, 404):
                    reason = (payload.get("detail") or payload.get("error") or "").lower() if isinstance(payload, dict) else ""
                    if "captions" in reason or "transcript" in reason:
                        nosub += 1
                        open(nocap, "a").write(f"{vid}\t{title}\n")
                        print(f"{vid}: no transcript track ({title})", flush=True)
                    elif "age" in reason:
                        nosub += 1
                        open(agegate, "a").write(f"{vid}\t{title}\n")
                        print(f"{vid}: age-restricted ({title})", flush=True)
                    else:
                        failed += 1
                        print(f"{vid}: transcript fetch failed ({code}): {reason}", flush=True)
                    continue
                else:
                    failed += 1
                    print(f"{vid}: transcript fetch failed ({code})", flush=True)
                    continue

            if files:
                cmd = ingest_payload(
                    files[0], video_id=vid, title=title, feed=a.feed,
                    date=file_date, duration=file_duration, views=file_views
                )
                r = sh(cmd)
                if r.returncode == 0:
                    got += 1
                    added.append(vid)
                    if file_date is None and duration_hint and duration_hint not in ("NA", ""):
                        file_duration = duration_hint
                    with open(meta_all, "a") as mf:
                        mf.write(f"{vid}\t{file_date or ''}\t{file_duration or ''}\t{title}\t{file_views or ''}\n")
                    print(r.stdout.strip(), flush=True)
                else:
                    failed += 1
                    print(f"{vid}: ingest failed: {r.stderr.strip()[-200:]}", flush=True)
            for f in files:
                if os.path.exists(f):
                    os.remove(f)

        if a.push and (added or nosub):
            commit_and_push(ROOT, fdir, tdir, nocap, agegate, meta_all, added, nosub, a.feed)

    print(f"done: {got} archived, {nosub} without captions or age-restricted, {failed} failed; {len(todo) - got - nosub - failed} untouched", flush=True)


if __name__ == "__main__":
    main()
