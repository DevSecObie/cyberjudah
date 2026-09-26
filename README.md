# CyberJudah

The vault behind [cyberjudah.io](https://cyberjudah.io): the King James Bible with the
Apocrypha, and everything taught from it, as one linked library.

```
docs/study/         4 Chapters a Day notes, one file per chapter        (hand-written)
docs/encyclopedia/  standing subjects                                    (hand-written)
blog/               Sabbath class notes                                  (hand-written)
captains/           15 Minutes w/ The Captains                           (hand-written)
data/               the KJV text, the handbook of law, precepts, cross references, the names
                    glossary (names.tsv, how every leader is spelled); cases.json is
                    generated from the Case Studies of the Bible book (scripts/cases-from-book.py)
engine/             turns all of the above into one data set             (node engine/build.mjs)
site/               the front end, a TanStack Start app on Cloudflare    (reads the data set)
scripts/notes/      the editorial spec and helpers for writing a note
scripts/corpus/     builds the private transcript corpus for search and analysis
brand/              the lion, the icons, the social card
```

Nothing is hand-written except the notes and the data. The engine builds the JSON API, the
full-text index, the SQLite library and the feeds on every push to `main` and publishes them
to the `data` branch and to `data.cyberjudah.io`; the site reads them from there. The front
end is replaceable: anything that can read JSON can render this library. The contract is in
[engine/README.md](engine/README.md).

## Working on the notes

```
npm ci --prefix engine        # once
npm run notes:fix             # name spellings, timestamps, topic tags, scripture index
npm run notes:lint            # the shape of every note
npm run check                 # every link resolves to a real chapter, verse, note, law, precept or case
```

The editorial spec is [scripts/notes/README.md](scripts/notes/README.md).

## Building the transcript corpus

The timestamped transcripts remain the evidence layer. A separate, reproducible corpus joins
their metadata, groups caption fragments into useful passages, preserves original and lightly
normalized text, separates intros from speech, identifies language, annotates scripture
references, and validates every record against a data dictionary:

```
npm run corpus:test
npm run corpus:build       # writes dist/corpus/ (private, not published)
npm run corpus:backfill -- --report   # transcripts still missing an upload date
```

The schema, normalization rules, quality flags and change log are in
[scripts/corpus/SCHEMA.md](scripts/corpus/SCHEMA.md).

## The glossary and drafted entries

`data/glossary.json` holds the glossary: each term defined from the teachings and the KJV, with
its scripture and the moments it is taught. The engine checks every reference and moment and
publishes it at `/api/glossary/index.json`; the site renders it at `/glossary`.

New glossary and encyclopedia entries can be drafted from the recordings with Claude and are
always reviewed before they are published:

```
python3 scripts/corpus/evidence.py pack "Edom" --alias Edomites   # what the recordings say
python3 scripts/ai/draft.py glossary --terms data/drafting/glossary-terms.tsv --estimate
```

The **Draft glossary and encyclopedia entries** workflow runs the same drafting on GitHub
Actions (it needs the `ANTHROPIC_API_KEY` secret) and opens a pull request with the drafts and
a review report. Nothing reaches the site until that pull request is merged.

## Working on the site

```
cd site && npm ci && npm run build
```

`site/README.md` covers the app. Deploys run from GitHub Actions on push:
`.github/workflows/data.yml` publishes the data set, `.github/workflows/site.yml` deploys the
Worker. The old GitHub Pages address forwards to cyberjudah.io (`.github/workflows/redirect.yml`).
