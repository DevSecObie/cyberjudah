"""Summarise an R2 listing (NDJSON of [key, size, modified]) by folder and file type."""
import json, sys, collections, os
rows = [json.loads(l) for l in open(sys.argv[1])]
total = sum(s for _, s, _ in rows)
def mb(n): return f"{n / 1e6:,.1f} MB"
by_dir, by_ext = collections.Counter(), collections.Counter()
n_dir, n_ext = collections.Counter(), collections.Counter()
for k, s, _ in rows:
    d = "/".join(k.split("/")[:2]) if "/" in k else "(root)"
    e = os.path.splitext(k)[1].lower() or "(none)"
    by_dir[d] += s; n_dir[d] += 1; by_ext[e] += s; n_ext[e] += 1
print(f"# R2 inventory: sabbath-classes-images\n\n{len(rows):,} objects, {mb(total)}.\n")
print("## By folder (first two levels)\n\n| Folder | Files | Size |\n|---|---:|---:|")
for d, s in by_dir.most_common(): print(f"| `{d}` | {n_dir[d]:,} | {mb(s)} |")
print("\n## By file type\n\n| Type | Files | Size |\n|---|---:|---:|")
for e, s in by_ext.most_common(): print(f"| `{e}` | {n_ext[e]:,} | {mb(s)} |")
