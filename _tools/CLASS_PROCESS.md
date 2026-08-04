# Class Notes Process

The complete procedure for converting IUIC in the ClassRoom videos into
class notes on the CyberJudah site. Any session (scheduled or interactive)
follows this spec. The repo is https://github.com/DevSecObie/cyberjudah,
branch v5. All commands run from the repo root.

## The queue

`_tools/class_queue.json` is the single source of truth. Each entry:
`videoId`, `title`, `length`, `status`, and (when done) `note` (the site
slug). Statuses:

- `pending` — not yet converted
- `in_progress` — being written right now
- `done` — note exists, validated, linked
- `blocked` — conversion failed twice on content-filtering or another
  hard blocker; record a short `reason`. NEVER retry a blocked class
  automatically; a human decides.

Take pending classes in list order (newest first). Default batch: up to
2 classes per run. Finish one class completely (through validation)
before starting the next. If usage limits interrupt a class before its
note is complete and validated, delete the partial file and leave the
queue entry `pending` — never commit a partial note, never mark done
without the file verified on disk.

## Per-class procedure

1. TRANSCRIPT. Load `mcp__transcriptAPI__get_youtube_transcript` via
   ToolSearch, call with the videoId, format text, include_timestamp
   true. Large results are saved to a file; read it in chunks until 100%
   is read. On 408 errors wait 5s and retry. If the transcript tool is
   unavailable in this session, stop and report; do not scrape YouTube.
2. DATE. Derive the class date from transcript evidence: dates stated by
   the teacher, sabbath/new moon references, fast announcements, news
   items read in class. Archive classes may be from any year, not just
   the current one. If only approximate, pick the nearest plausible date
   and add `date-estimated: true` to the frontmatter. Do not block on
   the date. (YouTube page fetches are usually rate-limited from the
   sandbox; do not retry them more than twice.)
3. WRITE the note to `content/Class Notes/<year>/<YYYY-MM-DD> - <TITLE>.md`.
   Filename: drop characters illegal on Windows (colons out, ampersands
   stay), matching existing filenames. Format must match the exemplar
   `content/Class Notes/2026/2026-07-26 - Living Your Life As A Hireling.md`
   exactly:
   - YAML frontmatter: `title` (quoted, exact video title), `date`,
     `class: IUIC in the ClassRoom`
   - Hero figure: `<figure class="class-hero"><img src="https://i.ytimg.com/vi/<VIDEOID>/hqdefault.jpg" alt="Class artwork"></figure>`
     (image hosts are egress-blocked in the sandbox; hotlink, do not
     download)
   - `## Introduction`, `## In The News` (only if the class had a news
     segment), `## Scriptures Opened`, and the exemplar's closing/footer
     pattern
   - Scriptures Opened is the spine: one entry per scripture opened, in
     order, heading `**[[<Book> <Ch>#^v<first>|<Book> <Ch>:<range>]]**  *[<timestamp>]*`,
     then one `![[<Book> <Ch>#^v<N>]]` transclusion per verse read, then
     thorough teaching bullets. Precept scriptures read under a main one
     nest as in the exemplar (`  Precepts:` block).
   - Chapter files live at `content/Bible/<NN - Book>/<Book> <Ch>.md`
     with `^vN` anchors on every verse; verify targets exist. KJV
     Apocrypha names (Ecclesiasticus, 2 Esdras, ...).
4. EDITORIAL RULES (non-negotiable): direct teaching voice; "the Most
   High" in commentary; no em dashes; no emojis; exact scripture
   references corrected against the KJV text actually read. Exclude
   songs, announcements, banter, profanity, and asides that insult named
   living people or dehumanize any group; keep identity teaching plainly
   at the level of the scripture cited. Summarize graphic historical
   accounts in one line (what record was read + the teaching point);
   never reproduce step-by-step descriptions of violence or slurs.
5. VALIDATE: `python3 _tools/validate_notes.py "<the note>"` must report
   OK (em-dash findings in Bible source files are pre-existing and not
   yours; your note must have zero problems).
6. If output is blocked by content filtering twice for the same class:
   mark it `blocked` with a reason in the queue and move on.

## After the batch

1. Update `_tools/class_queue.json`: `done` plus `note` slug for each
   completed class. Get the exact slug by building the site and finding
   the emitted file under `public/class-notes/<year>/` (slug =
   `/class-notes/<year>/<filename without .html>`).
2. Add each new note to `content/Class Notes/Class Notes Index.md`,
   newest first, matching the existing line format.
3. Regenerate the dashboard: `python3 _tools/build_backlog.py`.
4. Build must pass: `npm ci` (first run) then `npx quartz build`.
5. Commit everything with a descriptive message and push to `origin v5`.
   Never force-push. If push fails on auth, commit locally and report.

## Coordinator rules

- Do not modify `_tools/*.py` scripts, the exemplar note, or the
  encyclopedia/lexicon as part of class-notes runs.
- Do not touch `content/Study Bible` or `content/Bible`.
- One session at a time: if the latest commit on v5 shows another run
  finished less than 15 minutes ago with the same classes, re-read the
  queue after pulling before choosing a batch.
