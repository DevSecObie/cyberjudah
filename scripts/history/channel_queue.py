#!/usr/bin/env python3
"""The next IUIC channels to harvest, largest audience first.

    python3 scripts/history/channel_queue.py next [--n 1]   # tab-separated: handle, feed
    python3 scripts/history/channel_queue.py status          # done / remaining, and the next five

Reads data/sources/iuic-channels.tsv (ranked by subscribers) and skips a channel once
harvest.py has written its dashboard/completed-sources/<handle>.json marker.
"""

import argparse
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
QUEUE = os.path.join(ROOT, "data", "sources", "iuic-channels.tsv")
DONE = os.path.join(ROOT, "dashboard", "completed-sources")


def channels():
    rows = []
    with open(QUEUE, encoding="utf-8") as f:
        header = None
        for line in f:
            if line.startswith("#") or not line.strip():
                continue
            cells = line.rstrip("\n").split("\t")
            if header is None:
                header = cells
                continue
            rows.append(dict(zip(header, cells)))
    return sorted(rows, key=lambda r: int(r["rank"]))


def done(handle):
    return os.path.exists(os.path.join(DONE, f"{handle}.json"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=("next", "status"))
    ap.add_argument("--n", type=int, default=1)
    a = ap.parse_args()
    rows = channels()
    todo = [r for r in rows if not done(r["handle"])]
    if a.command == "next":
        for r in todo[: a.n]:
            print(f"{r['handle']}\t{r['feed']}")
        return
    print(f"{len(rows) - len(todo)} of {len(rows)} channels harvested; {len(todo)} to go")
    for r in todo[:5]:
        print(f"  {r['rank']:>3}  {r['handle']}  ({int(r['subscribers']):,} subscribers, ~{int(r['videos']):,} videos)")


if __name__ == "__main__":
    sys.exit(main())
