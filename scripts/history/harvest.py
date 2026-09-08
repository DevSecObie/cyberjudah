#!/usr/bin/env python3
"""Archive a channel's caption tracks into the vault, so no class is lost if a video goes.

    python3 scripts/history/harvest.py --feed classes  --channel IUICintheClassRoom  [--limit 200] [--push]
    python3 scripts/history/harvest.py --feed captains --channel iuiccaptains6939
    python3 scripts/history/harvest.py --feed history  --channel ourhiddenhistoryradio1991

Lists every upload and every past live stream on the channel, skips what the vault already
holds (<feed dir>/transcripts/<id>.json, or a line in <feed dir>/no-captions.tsv), pulls the
English caption track for the rest with yt-dlp, newest first, and runs ingest.py on each.
Every video that YouTube exposes (uploads, streams, clips) is kept: this is an archive, and
the notes are written from it later. --push commits and pushes after every batch, so a run
that is cut off still lands what it fetched. Needs yt-dlp on PATH and a network that can
reach YouTube; GJT in the environment for --push.
"""
import argparse, glob, json, os, re, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ingest import FEEDS

def sh(cmd, **kw):
    return subprocess.run(cmd, text=True, capture_output=True, **kw)

def listing(channel, tab):
    r = sh(["yt-dlp", "--flat-playlist", "--print", "%(id)s\t%(duration)s\t%(title)s", f"https://www.youtube.com/@{channel}/{tab}"])
    rows = []
    for line in r.stdout.splitlines():
        p = line.split("\t")
        if len(p) == 3 and re.fullmatch(r"[\w-]{11}", p[0]): rows.append((p[0], p[1], p[2]))
    return rows

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--feed", required=True, choices=sorted(FEEDS)); ap.add_argument("--channel", required=True)
    ap.add_argument("--limit", type=int, default=100000); ap.add_argument("--batch", type=int, default=25)
    ap.add_argument("--push", action="store_true"); ap.add_argument("--tabs", default="videos,streams")
    a = ap.parse_args()
    fdir = os.path.join(ROOT, FEEDS[a.feed]); tdir = os.path.join(fdir, "transcripts"); os.makedirs(tdir, exist_ok=True)
    nocap = os.path.join(fdir, "no-captions.tsv"); meta_all = os.path.join(fdir, "channel-meta.tsv")
    agegate = os.path.join(fdir, "age-restricted.tsv")  # need a signed-in fetch; listed so they are not retried every run

    seen, rows = set(), []
    for tab in a.tabs.split(","):
        for row in listing(a.channel, tab):
            if row[0] not in seen: seen.add(row[0]); rows.append(row)
    done = {os.path.basename(p)[:-5] for p in glob.glob(os.path.join(tdir, "*.json"))}
    for f in (nocap, agegate):
        if os.path.exists(f): done |= {l.split("\t")[0] for l in open(f) if l.strip()}
    todo = [r for r in rows if r[0] not in done][: a.limit]
    print(f"{a.channel}: {len(rows)} videos on the channel, {sum(1 for r in rows if r[0] in done)} already in the vault, {len(todo)} to fetch", flush=True)

    raw = os.path.join(ROOT, ".harvest-raw"); os.makedirs(raw, exist_ok=True)
    got = nosub = failed = 0
    for i in range(0, len(todo), a.batch):
        batch = todo[i:i + a.batch]
        ids = os.path.join(raw, "ids.txt"); meta = os.path.join(raw, "meta.tsv")
        open(ids, "w").write("".join(f"https://www.youtube.com/watch?v={r[0]}\n" for r in batch))
        if os.path.exists(meta): os.remove(meta)
        y = sh(["yt-dlp", "--ignore-errors", "--skip-download", "--write-subs", "--write-auto-subs", "--sub-langs", "en.*", "--sub-format", "json3",
            "--sleep-requests", "1", "--sleep-subtitles", "1", "--retries", "5", "--extractor-retries", "3",
            "--print-to-file", "%(id)s\t%(upload_date)s\t%(duration)s\t%(title)s\t%(view_count)s\t%(subtitles.en.0.ext)s\t%(automatic_captions.en.0.ext)s", meta, "-o", os.path.join(raw, "%(id)s"), "-a", ids])
        aged = set(re.findall(r"\[youtube\] ([\w-]{11}): Sign in to confirm your age", y.stderr))
        metas = {}
        if os.path.exists(meta):
            for l in open(meta):
                p = l.rstrip("\n").split("\t")
                if len(p) == 7: metas[p[0]] = p
        added = []
        # A batch where YouTube listed captions but handed none over is rate limiting, not a
        # run of caption-less videos. Wait it out once; if it persists, stop rather than
        # mislabel the rest of the channel.
        listed = [v for v, m in metas.items() if m[5] != "NA" or m[6] != "NA"]
        if listed and not any(glob.glob(os.path.join(raw, f"{v}.*.json3")) for v in listed):
            print(f"rate limited: {len(listed)} videos have captions but none came through; sleeping 90s and retrying the batch", flush=True)
            time.sleep(90)
            sh(["yt-dlp", "--ignore-errors", "--skip-download", "--write-subs", "--write-auto-subs", "--sub-langs", "en.*", "--sub-format", "json3",
                "--sleep-requests", "2", "--sleep-subtitles", "3", "--retries", "5", "-o", os.path.join(raw, "%(id)s"), "-a", ids])
            if not any(glob.glob(os.path.join(raw, f"{v}.*.json3")) for v in listed):
                print("still rate limited; stopping this run (rerun later, it resumes)", flush=True)
                break
        for vid, _, title in batch:
            files = sorted(glob.glob(os.path.join(raw, f"{vid}.*.json3")))
            m = metas.get(vid)
            if files and m:
                d = m[1]; date = f"{d[:4]}-{d[4:6]}-{d[6:]}" if re.fullmatch(r"\d{8}", d) else None
                dur = m[2] if m[2] not in ("NA", "") else None; views = m[4] if m[4] not in ("NA", "") else None
                # --id=<vid>: video ids can start with "-", which argparse would read as an option.
                cmd = [sys.executable, os.path.join(ROOT, "scripts", "history", "ingest.py"), files[0], f"--id={vid}", f"--title={m[3]}", f"--feed={a.feed}"]
                if date: cmd.append(f"--date={date}")
                if dur: cmd.append(f"--duration={dur}")
                if views: cmd.append(f"--views={views}")
                r = sh(cmd)
                if r.returncode == 0:
                    got += 1; added.append(vid); open(meta_all, "a").write("\t".join(m[:5]) + "\n"); print(r.stdout.strip(), flush=True)
                else: failed += 1; print(f"{vid}: ingest failed: {r.stderr.strip()[-200:]}", flush=True)
            elif m and m[5] == "NA" and m[6] == "NA":
                nosub += 1; open(nocap, "a").write(f"{vid}\t{m[3]}\n"); print(f"{vid}: no English captions ({m[3]})", flush=True)
            elif m:
                failed += 1; print(f"{vid}: captions listed but not delivered, will retry next run ({m[3]})", flush=True)
            elif vid in aged:
                nosub += 1; open(agegate, "a").write(f"{vid}\t{title}\n"); print(f"{vid}: age-restricted, needs a signed-in fetch ({title})", flush=True)
            else:
                failed += 1; print(f"{vid}: not fetched ({title})", flush=True)
            for f in files: os.remove(f)
        if a.push and (added or nosub):
            sh(["git", "-C", ROOT, "add", "--", *[p for p in (tdir, nocap, agegate, meta_all) if os.path.exists(p)]])
            sh(["git", "-C", ROOT, "commit", "-q", "-m", f"transcripts: {a.feed} +{len(added)} ({got} this run)\n\nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"])
            tok = os.environ.get("GJT", "")
            env = {k: v for k, v in os.environ.items() if k.lower() not in ("https_proxy", "http_proxy")}
            for attempt in range(3):
                r = sh(["git", "-C", ROOT, "-c", "http.proxy=", "-c", "credential.helper=!f() { echo username=x-access-token; echo \"password=$GJT\"; }; f", "push", "origin", "HEAD:main"], env=env)
                if r.returncode == 0: break
                sh(["git", "-C", ROOT, "-c", "http.proxy=", "-c", "credential.helper=!f() { echo username=x-access-token; echo \"password=$GJT\"; }; f", "pull", "--rebase", "-q", "origin", "main"], env=env)
            print(f"push: {'ok' if r.returncode == 0 else re.sub(r'github_pat_[A-Za-z0-9_]*', '[REDACTED]', r.stderr.strip()[-300:])}", flush=True)
    print(f"done: {got} archived, {nosub} without captions or age-restricted, {failed} failed; {len(todo) - got - nosub - failed} untouched", flush=True)

if __name__ == "__main__": main()
