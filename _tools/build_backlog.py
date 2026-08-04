#!/usr/bin/env python3
"""Build the Class Backlog dashboard page from _tools/class_queue.json.

The queue file is the source of truth for which classes have been broken
down into notes. Statuses: pending, in_progress, done. When a class is
completed, set its status to done, add its "note" slug, and rerun:

    python3 _tools/build_backlog.py

The page is generated at "content/Class Notes/Class Backlog.md" with the
data inlined, so it needs no runtime fetches. Search and filters are
plain inline JS; the full table renders statically so the page works
even without scripts.
"""

import json
import html
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
queue = json.loads((root / "_tools" / "class_queue.json").read_text(encoding="utf-8"))
classes = queue["classes"]

done = sum(1 for c in classes if c["status"] == "done")
prog = sum(1 for c in classes if c["status"] == "in_progress")
pend = sum(1 for c in classes if c["status"] == "pending")
total = len(classes)
pct = round(done / total * 100)

STATUS = {
    "done": ("Done", "st-done"),
    "in_progress": ("In progress", "st-prog"),
    "pending": ("Pending", "st-pend"),
}

rows = []
for i, c in enumerate(classes):
    label, cls = STATUS[c["status"]]
    title = html.escape(c["title"], quote=True)
    watch = f"https://www.youtube.com/watch?v={c['videoId']}"
    if c["status"] == "done" and c.get("note"):
        action = f'<a class="cb-note" href="{html.escape(c["note"])}">Read note</a>'
    elif c["status"] == "in_progress":
        action = '<span class="cb-muted">being written</span>'
    else:
        action = (f'<button class="cb-copy" data-title="{title}" data-id="{c["videoId"]}" '
                  f'title="Copy a ready-made request for Claude">Copy request</button>')
    rows.append(
        f'<tr data-status="{c["status"]}" data-search="{title.lower()}">'
        f'<td class="cb-num">{total - i}</td>'
        f'<td class="cb-title"><a href="{watch}" rel="noopener">{title}</a></td>'
        f'<td class="cb-len">{c["length"]}</td>'
        f'<td><span class="cb-st {cls}"><span class="cb-dot"></span>{label}</span></td>'
        f'<td class="cb-act">{action}</td>'
        f"</tr>"
    )

page = f"""---
title: Class Backlog
---

Every full-length class on [@IUICintheClassRoom](https://www.youtube.com/@IUICintheClassRoom) and whether it has been broken down into [[Class Notes Index|class notes]] yet. Newest classes first. The status list lives in the repo at `_tools/class_queue.json`; ask Claude to break down the next batch and this page updates on the next deploy. Last updated {queue["updated"]}.

<div class="class-backlog">
<style>
.class-backlog {{ --cb-line: var(--lightgray); }}
.class-backlog .cb-tiles {{ display: flex; gap: 0.75rem; flex-wrap: wrap; margin: 1rem 0 0.5rem; }}
.class-backlog .cb-tile {{ flex: 1 1 7rem; border: 1px solid var(--cb-line); border-radius: 8px; padding: 0.6rem 0.9rem; }}
.class-backlog .cb-tile b {{ display: block; font-size: 1.6rem; line-height: 1.2; color: var(--dark); }}
.class-backlog .cb-tile span {{ font-size: 0.8rem; color: var(--gray); }}
.class-backlog .cb-meter {{ height: 8px; border-radius: 4px; background: var(--highlight); margin: 0.75rem 0 0.25rem; overflow: hidden; }}
.class-backlog .cb-meter > div {{ height: 100%; width: {pct}%; border-radius: 4px; background: var(--secondary); }}
.class-backlog .cb-meter-label {{ font-size: 0.8rem; color: var(--gray); margin-bottom: 1rem; }}
.class-backlog .cb-controls {{ display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; margin: 0.75rem 0; }}
.class-backlog .cb-controls input {{ flex: 1 1 12rem; padding: 0.45rem 0.7rem; border: 1px solid var(--cb-line); border-radius: 6px; background: var(--light); color: var(--dark); font-size: 0.9rem; }}
.class-backlog .cb-chip {{ border: 1px solid var(--cb-line); background: none; color: var(--darkgray); border-radius: 999px; padding: 0.3rem 0.8rem; font-size: 0.8rem; cursor: pointer; }}
.class-backlog .cb-chip.active {{ background: var(--secondary); border-color: var(--secondary); color: var(--light); }}
.class-backlog table {{ width: 100%; border-collapse: collapse; font-size: 0.88rem; }}
.class-backlog th {{ text-align: left; color: var(--gray); font-weight: 600; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--cb-line); padding: 0.4rem 0.5rem; }}
.class-backlog td {{ border-bottom: 1px solid var(--cb-line); padding: 0.45rem 0.5rem; vertical-align: top; }}
.class-backlog .cb-num {{ color: var(--gray); width: 2.5rem; }}
.class-backlog .cb-len {{ white-space: nowrap; color: var(--darkgray); }}
.class-backlog .cb-title a {{ color: var(--dark); text-decoration: none; }}
.class-backlog .cb-title a:hover {{ color: var(--secondary); }}
.class-backlog .cb-st {{ display: inline-flex; align-items: center; gap: 0.4rem; white-space: nowrap; font-size: 0.82rem; }}
.class-backlog .cb-dot {{ width: 8px; height: 8px; border-radius: 50%; display: inline-block; }}
.class-backlog .st-done {{ color: #15803d; }} .class-backlog .st-done .cb-dot {{ background: #15803d; }}
.class-backlog .st-prog {{ color: #b45309; }} .class-backlog .st-prog .cb-dot {{ background: #b45309; }}
.class-backlog .st-pend {{ color: var(--gray); }} .class-backlog .st-pend .cb-dot {{ background: var(--gray); }}
:root[saved-theme="dark"] .class-backlog .st-done {{ color: #4ade80; }}
:root[saved-theme="dark"] .class-backlog .st-done .cb-dot {{ background: #4ade80; }}
:root[saved-theme="dark"] .class-backlog .st-prog {{ color: #fbbf24; }}
:root[saved-theme="dark"] .class-backlog .st-prog .cb-dot {{ background: #fbbf24; }}
.class-backlog .cb-note {{ color: var(--secondary); font-weight: 600; text-decoration: none; white-space: nowrap; }}
.class-backlog .cb-muted {{ color: var(--gray); font-size: 0.82rem; }}
.class-backlog .cb-copy {{ border: 1px solid var(--cb-line); background: none; color: var(--gray); border-radius: 6px; padding: 0.2rem 0.6rem; font-size: 0.75rem; cursor: pointer; white-space: nowrap; }}
.class-backlog .cb-copy:hover {{ color: var(--secondary); border-color: var(--secondary); }}
.class-backlog .cb-empty {{ color: var(--gray); padding: 1rem 0.5rem; display: none; }}
</style>

<div class="cb-tiles">
<div class="cb-tile"><b>{total}</b><span>Classes</span></div>
<div class="cb-tile"><b>{done}</b><span>Done</span></div>
<div class="cb-tile"><b>{prog}</b><span>In progress</span></div>
<div class="cb-tile"><b>{pend}</b><span>Pending</span></div>
</div>
<div class="cb-meter"><div></div></div>
<div class="cb-meter-label">{done} of {total} classes converted to notes ({pct}%)</div>

<div class="cb-controls">
<input id="cb-search" type="search" placeholder="Search classes..." aria-label="Search classes">
<button class="cb-chip active" data-f="all">All</button>
<button class="cb-chip" data-f="pending">Pending</button>
<button class="cb-chip" data-f="in_progress">In progress</button>
<button class="cb-chip" data-f="done">Done</button>
</div>

<table>
<thead><tr><th>#</th><th>Class</th><th>Length</th><th>Status</th><th></th></tr></thead>
<tbody>
{chr(10).join(rows)}
</tbody>
</table>
<p class="cb-empty">No classes match.</p>

<script>
(function () {{
  function init() {{
    var box = document.querySelector(".class-backlog");
    if (!box || box.dataset.wired) return;
    box.dataset.wired = "1";
    var rows = Array.prototype.slice.call(box.querySelectorAll("tbody tr"));
    var search = box.querySelector("#cb-search");
    var chips = Array.prototype.slice.call(box.querySelectorAll(".cb-chip"));
    var empty = box.querySelector(".cb-empty");
    var filter = "all";
    function apply() {{
      var q = (search.value || "").toLowerCase();
      var shown = 0;
      rows.forEach(function (r) {{
        var ok = (filter === "all" || r.dataset.status === filter) &&
                 (!q || r.dataset.search.indexOf(q) !== -1);
        r.style.display = ok ? "" : "none";
        if (ok) shown++;
      }});
      empty.style.display = shown ? "none" : "block";
    }}
    search.addEventListener("input", apply);
    chips.forEach(function (c) {{
      c.addEventListener("click", function () {{
        chips.forEach(function (x) {{ x.classList.remove("active"); }});
        c.classList.add("active");
        filter = c.dataset.f;
        apply();
      }});
    }});
    box.addEventListener("click", function (e) {{
      var b = e.target.closest ? e.target.closest(".cb-copy") : null;
      if (!b) return;
      var text = 'Break down the class "' + b.dataset.title + '" (YouTube ID ' +
                 b.dataset.id + ") into class notes and update the backlog.";
      if (navigator.clipboard) {{
        navigator.clipboard.writeText(text);
        var old = b.textContent;
        b.textContent = "Copied";
        setTimeout(function () {{ b.textContent = old; }}, 1200);
      }}
    }});
  }}
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("nav", init);
}})();
</script>
</div>
"""

out = root / "content" / "Class Notes" / "Class Backlog.md"
out.write_text(page, encoding="utf-8", newline="\n")
print(f"{out.relative_to(root)}: {total} classes ({done} done, {prog} in progress, {pend} pending, {pct}%)")
