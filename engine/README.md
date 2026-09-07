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
| `data/handbook.json` | the handbook of Bible law |
| `data/precepts.json` | the precept index |
| `data/cases.json` | the case studies |
| `data/topics.tsv`, `data/lexicon.tsv` | topic labels, encyclopedia terms |
| `data/crossrefs.json`, `data/web-translation.json` | cross references, WEB parallel text |

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
| `api/laws/<SECTION>.json` | one section with its laws, references and citations |
| `api/precepts/index.json`, `api/precepts/<slug>.json` | the precept index and each precept's references |
| `api/cases/index.json`, `api/cases/<slug>.json` | the case studies; each case carries its laws, precepts, related cases and where it was taught |
| `api/by-book.json` | which classes and episodes open which book, with the chapters |
| `api/xref/<book-slug>/<chapter>.json` | cross references per verse |
| `api/web/<book-slug>/<chapter>.json` | the World English Bible text, per verse |
| `search/classes.json`, `search/captains.json` | browse feeds: title, url, date, teacher, thumb, books, topics |
| `search/topics.json`, `search/books.json`, `search/laws.json`, `search/precepts.json`, `search/cases.json` | small indexes for browse pages |
| `pagefind/` | a sharded full-text index; load `pagefind/pagefind.js` and search every verse, note, law, precept and case |
| `library.sqlite.gz` | the whole library as SQLite with FTS5 tables (`verses_fts`, `notes_fts`, `laws_fts`, `cases_fts`); import into Cloudflare D1, Turso, or open locally |
| `img/classes/<videoId>.jpg`, `img/captains/<videoId>.jpg` | thumbnails |
| `classes/rss.xml`, `captains/rss.xml`, `study/rss.xml` and `*/feed.json` | feeds |
| `llms.txt` | a summary for language models |
| `manifest.json` | build time, commit, file count, stats |

Site-relative URLs inside the data (`/bible/genesis/1`, `/classes/2026/...`) are routes,
not files: the front end decides how to render them.

## Where it is published

`.github/workflows/data.yml` runs the engine on every push to `main` that touches the
vault and publishes `dist/` to the `data` branch of this repository, a single commit,
history discarded. Anything that can serve a git branch can serve the data set:

- jsDelivr, right now, with no setup: `https://cdn.jsdelivr.net/gh/DevSecObie/cyberjudah@data/api/stats.json`
- Cloudflare Pages or Netlify, connected to the `data` branch with no build step
- a Cloudflare R2 bucket, or any object store, by copying the branch

## SQLite quick start

```
gunzip library.sqlite.gz
sqlite3 library.sqlite "SELECT v.book_slug, v.chapter, v.verse, snippet(verses_fts, 0, '[', ']', '…', 12)
  FROM verses_fts JOIN verses v ON v.id = verses_fts.rowid WHERE verses_fts MATCH 'lamp AND feet' LIMIT 5"
sqlite3 library.sqlite "SELECT kind, label, url, verses FROM citations WHERE book_slug = 'psalms' AND chapter = 119"
```
