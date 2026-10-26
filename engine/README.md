# The content engine

The vault is the source of truth: Markdown notes and JSON data, committed to this
repository. This engine turns the vault into one data set that any front end can read.
It has no opinion about the site. Docusaurus, TanStack Start, Astro, a phone app, a
script: all consume the same files.

```
node engine/build.mjs [--out dist] [--site https://cyberjudah.io] [--no-thumbs]
```

Runs in about 30 seconds. Nothing is fetched except class thumbnails (skipped with
`--no-thumbs`). Dependencies live in `engine/package.json` only; the Docusaurus tree is
not needed.

## What it reads

| Source | Meaning |
|---|---|
| `docs/study/<book>/<chapter>.md` | 4 Chapters a Day notes, one per chapter |
| `docs/encyclopedia/<slug>.md` | encyclopedia entries |
| `blog/<year>/*.md` | Sabbath class notes |
| `captains/<year>/*.md` | 15 Minutes w/ The Captains |
| `data/bible/*.json` | the KJV text with the Apocrypha |
| `data/people/people.json`, `data/places/places.json` | the people and places of the Bible, from STEPBible's TIPNR (`scripts/people/tipnr.py`, `scripts/places/tipnr.py`) |
| `data/handbook.json` | the handbook of Bible law |
| `data/precepts.json` | the precept index |
| `data/cases.json` | the case studies |
| `data/topics.tsv`, `data/lexicon.tsv` | topic labels, encyclopedia terms |
| `data/crossrefs.json` | cross references |
| `history/transcripts/<videoId>.json` | Our Hidden History Radio, verbatim captions per episode (`scripts/history/ingest.py` writes them) |
| `history/notes/<videoId>.md` | an episode written up, once it is; frontmatter + markdown with scripture links, cited like a class note |

A note cites scripture by linking to `/bible/<book-slug>/<chapter>#v<n>`. Every such link
becomes a row in the concordance, which is the graph everything else is built from.

## What it writes (the contract)

Paths are relative to the data root. Every path is stable; new fields may be added to a
JSON shape, existing fields are not removed or renamed without a note here.

| Path | Shape |
|---|---|
| `api/index.json` | every endpoint below |
| `api/stats.json` | counts, plus `recent`: the newest classes and episodes |
| `api/kjv/books.json` | `[{book, slug, chapters, verses, testament, url, chapterIds}]` |
| `api/kjv/<book-slug>/index.json` | one book |
| `api/kjv/<book-slug>/<chapter>.json` | `{book, chapter, translation, url, verses: [{verse, text}]}` |
| `api/concordance/<book-slug>/<chapter>.json` | `{book, chapter, cited_by: [{kind, label, url, verses}]}`; emitted for every chapter |
| `api/notes/index.json` | every note: `{kind, title, url, book, chapters, range, date, year, series, teacher, topics, summary, videoId}` |
| `api/notes/<site-path>.json` | one note with its Markdown `body`, e.g. `api/notes/classes/2026/<slug>.json` |
| `api/laws/index.json` | parts and sections of the handbook |
| `api/laws/<SECTION>.json` | one section with its laws; every reference is resolved (`slug`, `url`, `label`, the `study` note that teaches the chapter, the verse `text` up to 12 verses, `more`) |
| `api/precepts/index.json`, `api/precepts/<slug>.json` | the precept index and each precept's references, resolved the same way |
| `api/cases/index.json`, `api/cases/<slug>.json` | the case studies (index rows carry `themes` and `topics`); each case carries its laws, precepts, related cases, resolved references (`refsResolved`), where it was taught and encyclopedia `see` links |
| `api/places/index.json` | every place in the Bible (STEPBible TIPNR, CC BY 4.0): `{id, name, names, region, verses (count), first}` |
| `api/places/<id>.json` | one place: `{id, name, names, region, coords: [lat, lng] or null, strongs, verses, source}`; the chapter files' `places: {verse: [id]}` say which places each verse names |
| `api/concordance/index.json` | per book: which chapters are cited (`cited`) and how many citations |
| `api/concordance/<book-slug>.json` | a whole book: `chapterRows: [{chapter, url, cited_by}]`, one row per citing document with its verse spans merged into `verses: []` |
| `api/history/index.json` | every episode: `{slug, title, url, episode, date, duration, views, videoId, thumb, words, teacher, topics, noted}` |
| `api/history/<slug>.json` | one episode: the row plus `start` (the second the speakers begin), `body` (the write-up, or null) and `turns: [{t, text}]`, the verbatim transcript from `start` in speaker turns |
| `api/encyclopedia/index.json` | `[{slug, title, url, summary}]` |
| `api/topics/index.json`, `api/topics/<slug>.json` | every topic label (class topics, case themes, `verdict-<v>`) with the notes and cases that carry it |
| `downloads/vault.zip` | the Obsidian vault, when `data/downloads/vault.zip` exists in the repository |
| `api/by-book.json` | which classes and episodes open which book, with the chapters |
| `api/xref/<book-slug>/<chapter>.json` | cross references per verse |
| `search/classes.json`, `search/captains.json` | browse feeds: title, url, date, teacher, thumb, books, topics |
| `api/classes/broadcasts.json` | video ID → `{date, broadcastAt}`: the class's calendar date and verified broadcast start in UTC |
| `search/topics.json`, `search/books.json`, `search/laws.json`, `search/precepts.json`, `search/cases.json` | small indexes for browse pages |
| `pagefind/` | a sharded full-text index; load `pagefind/pagefind.js` and search every verse, note, law, precept and case |
| `search.sql.gz` | the search index as SQL: one FTS5 table `search_docs(kind, title, url, sub, text, book, chapter)`, every verse a row, notes split at headings into pieces of a few KB, laws, precepts and cases one row each; the site loads it into Cloudflare D1 on every publish |
| `search-index/parts.json`, `search-index/NN.sql.gz` | the same index in parts, each under 20 MiB gzipped and valid SQL on its own, to run in order (the Telegram bot's D1 load reads these) |
| `library.sqlite.gz` | the whole library as SQLite with FTS5 tables (`verses_fts`, `notes_fts`, `laws_fts`, `cases_fts`); import into Cloudflare D1, Turso, or open locally |
| `img/classes/<videoId>.jpg`, `img/captains/<videoId>.jpg` | thumbnails |
| `classes/rss.xml`, `captains/rss.xml`, `study/rss.xml` and `*/feed.json` | feeds |
| `llms.txt` | a summary for language models |
| `manifest.json` | build time, commit, file count, stats |

Site-relative URLs inside the data (`/bible/genesis/1`, `/classes/2026/...`) are routes,
not files: the front end decides how to render them.

### Strong's concordance pages

`api/strongs/<number>.json` retains its definition, total counts and first 600
`occurrences` for existing clients. `occurrencePages` adds `{revision, pageSize,
pages, nextPage}`. Follow `nextPage` at
`api/strongs/<number>/occurrences/<revision>/<page>.json` until it is `null`.
Each page contains `{number, revision, page, total, occurrences, nextPage}`;
page 0 is embedded only in the entry and has no separate file. `pages` counts all
logical pages, including that initial page; continuation files start at page 1
only when `nextPage` is non-null and contain every remaining occurrence in corpus
order. The revision is the SHA-256 of the full
occurrence array, so a client must retain that revision while paging and reject
a response for another number or revision. A missing historical page should
offer a retry/reload, never silently append data from a newer revision.

Run `node --test engine/strongs-pages.test.mjs` for coverage using the real H430
tagged corpus, including occurrences beyond 600 and exact page boundaries.

## Where it is published

`.github/workflows/data.yml` runs the engine on every push to `main` that touches the
vault, then `engine/publish.mjs` publishes `dist/` to the R2 bucket `cyberjudah-data`, and the
Worker in `engine/worker/` serves the live build at `https://data.cyberjudah.io`. Git holds the
source only; built files are not committed anywhere.

- Each file is stored once under its content hash (`o/<sha256>`). A build uploads only the
  objects the live build does not already have, so a new note uploads a handful of files.
- A build's manifest (`builds/<id>/`, 64 shards of `{path: [sha256, size]}`) lists its files.
  Writing `pointer.json` makes it live: every reader moves to the new build in one step.
- The newest 10 builds are kept; older builds and objects only they used are removed.
  `node engine/publish.mjs --rollback <build-id>` makes a kept build live again.
- No size limit applies to a file (R2 takes up to 5 GB in one upload). The Worker sends CORS,
  cache lifetimes per path, an `ETag` of the content hash, and answers `Range` requests.

The layout is in `engine/worker/layout.mjs`. `node --test engine/publish.test.mjs` covers the
publisher and the Worker against an in-memory bucket; `node --test engine/data-assets.test.mjs`
(after installing the engine and site dependencies) builds the real data set, publishes it to
memory, reads it back through the Worker and packages the Worker with Wrangler's dry run.

## SQLite quick start

Download [library.sqlite.gz](https://data.cyberjudah.io/library.sqlite.gz), then:

```
gunzip library.sqlite.gz
sqlite3 library.sqlite "SELECT v.book_slug, v.chapter, v.verse, snippet(verses_fts, 0, '[', ']', '…', 12)
  FROM verses_fts JOIN verses v ON v.id = verses_fts.rowid WHERE verses_fts MATCH 'lamp AND feet' LIMIT 5"
sqlite3 library.sqlite "SELECT kind, label, url, verses FROM citations WHERE book_slug = 'psalms' AND chapter = 119"
```

### People corrections and pictures

The People CMS changes only summaries, family relationships and optional credited
pictures in `data/people/people.json`. The engine validates those profiles before
building and copies picture metadata into their existing API responses. Picture
URLs and source pages must use HTTPS; caption, credit and licence are required.
No picture or biographical fact is added by the reader itself.

Twenty-one unresolved links already present in the upstream-derived profiles are
recorded in `people-legacy-links.json` with their source revision. They remain
visible for correction; new unresolved relationships fail the gate. Editing one
profile must not require inventing replacements for unrelated historical gaps.

### Admin class metadata corrections

`data/sources/class-teachers.tsv` holds explicit admin corrections with the columns
`video`, `teacher`, `date`, `title` (tabs, one recording per row). Dates are real
`YYYY-MM-DD` dates or blank when unknown. Do not infer a teacher or date. The in-app
CMS also changes a linked note's front matter in the same review.

The library applies these corrections before building note lists, commentary and
precept metadata. Verse readings use the same correction, and
`api/classes/metadata.json` includes both noted and undated recordings for the CMS.
Original note URLs and transcript text stay intact. Invalid or duplicated rows fail
`engine/check.mjs` and the regular `validate` CI check. The table starts empty;
adding this reader changes no class facts.

`api/classes/corrections.json` exposes only explicit corrections so the Telegram
Worker can display the same title/date while its transcript search index awaits a
rebuild. Publishing live content uses the `production` environment. Before enabling
CMS publication, the owner must configure required reviewers for that environment
in this repository; the environment name alone does not enforce approval.

### Precept playback corrections

A pass precept may carry an optional `ts` (`m:ss` or `h:mm:ss`). Its links in both directions use that moment; omitting it retains the opened passage's timestamp. Explanations and references are unchanged. `scripts/precepts/classes.py check` rejects invalid calendar dates and timestamp components and retains the exact KJV quote check. Data edits still require exactly one pass per PR; checker/reader implementation changes without pass data are allowed separately. CMS publication requires both `validate` and `check`. Production approval remains separate.

### Broadcast order

`data/sources/class-broadcasts.json` preserves YouTube's completed-stream
`playerMicroformatRenderer.liveBroadcastDetails.startTimestamp`, verified against
that renderer's `externalVideoId`. This is the broadcast start, not the recording's
upload/publication timestamp. The initial backfill covers 184 completed broadcasts
from the published Sabbath-class catalog plus Haiti: The Rise After the Ruin,
checked on 2026-10-08 UTC. Each source is `https://www.youtube.com/watch?v=<videoId>`.
The stored `date` retains the class's existing calendar day even when a broadcast
crosses midnight UTC. Missing timestamps are left unknown.

The transcript harvester records the same metadata as new transcripts arrive.
A failed metadata lookup does not block transcript ingestion or invent a time.
Consumers can show newest dates first and sort each date by ascending
`broadcastAt`; unavailable metadata must not hide the class or its notes.
