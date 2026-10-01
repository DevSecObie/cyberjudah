# Licensed human KJV recordings

The manifest pins the original audio by checksum and links the LibriVox catalog,
recording rights statement and Internet Archive metadata. It distinguishes a
licensed **source candidate** from a chapter with usable timings. No Bible Strong
content or externally supplied verse text is used.

The repository has 81 books plus `index.json` (82 JSON files). The indexer uses the
actual chapter keys and verse arrays, including sparse Apocrypha chapter numbers.
Display aliases follow the requested 1611 names without renaming scripture files.

## Reproduce

Python 3.11+, FFmpeg and an isolated virtual environment are required for indexing.
`check` and `coverage` require only Python's standard library.

```sh
python3 -m venv .cache/audio/venv
.cache/audio/venv/bin/pip install -r scripts/audio/requirements.txt
python3 scripts/audio/recordings.py download
.cache/audio/venv/bin/python scripts/audio/recordings.py index --model turbo
# Apple Silicon: additionally install mlx-whisper==0.4.3 and use
# --backend mlx --model mlx-community/whisper-large-v3-turbo
python3 scripts/audio/recordings.py check
python3 -m unittest discover -s scripts/audio -p 'test_*.py'
python3 scripts/audio/recordings.py export
```

`--recording <manifest id>` processes one track. Downloads, model results and AAC
exports live in git-ignored `.cache/audio/`. Source bytes are checked before use;
all emitted timing files include a hash of our exact source verses. A changed Bible
chapter fails validation until it is re-aligned.

stable-ts/Whisper independently transcribes each source, finds matching opening and
closing scripture anchors, then force-aligns the exact verse text within those
conservative bounds with original newline segmentation. Cropping before alignment
prevents spoken LibriVox announcements from being mistaken for the opening verse.
An uncertain anchor withholds that source for review; it never guesses a boundary.
The chapter is cut from its first
spoken word to its last, removing source announcements. There is no duration-by-word
count approximation. The independent transcription is compared word-by-word to flag
possible skipped, added or misread words. ASR errors (particularly biblical names)
are expected: a flag is a review request, not an assertion that the reader erred.
Active review flags require ASR word agreement below 90%, a duration outside
0.15–1.0 seconds per word, or at least three consecutive zero-duration words.
Raw per-word confidence, word agreement and zero-duration counts remain in `audit`;
isolated zeroes and low confidence alone do not flag an entire verse. Earlier broad
flags are preserved in `previousChecks` (or the withheld chapter's manifest entry).
The reviewer's `hints` retain readable summaries of those word-level signals and
minor ASR differences; they do not set `check`.
Missing, overlapping, out-of-order or implausibly short timings (below 0.12 seconds
per source-text word) fail both indexing and `check`. Word count is only a rejection
gate, never a way to manufacture or stretch a timestamp. Rejected chapters get one
forced-alignment retry inside independently anchored chapter audio. A failed chapter
is withheld while other valid chapters in that source can still be indexed. Source
ranges that overlap keep the first chapter index and flag the later source for
review. Provenance includes the model, backend, stable-ts version and trimming
pipeline version; incompatible cached alignment results are not reused. `--force`
re-evaluates a source, retaining reusable independent transcription caches.
`--indexed-only --force` re-audits already indexed sources before the longer batch
continues. Only one index process may write the manifest at a time.

Each chapter keeps the requested `audio`, `reader`, `verses` shape and adds source
provenance and `checks: [{verse, check: true, reasons: [...]}]` when review is needed.
The top-level `check: true` indicates at least one flagged verse. `COVERAGE.md` lists
all pending source chapters and every flagged verse. Export retains those flags.
Anonymous/pseudonymous catalog readers display as “LibriVox volunteer”; the original
catalog label is retained as `catalogReader` in the manifest, with stable reader IDs.

## Publishing

`export` validates the index and encodes mono AAC at 64 kbps under
`.cache/audio/export/recordings/<reader>/<slug>/<chapter>.m4a`. It also creates the
chapter indexes and a source/license catalog. It never uploads or deploys.
The app repository's `bot/scripts/deploy-recordings.mjs` consumes this folder through
`RECORDINGS_EXPORT_DIR`, verifies hashes and uploads the catalog last. Its dry-run
mode lists uploads without writing to R2. Never publish an unconfirmed licence.

## Quality and outstanding review

Licensing is verified from the source project; LibriVox states public-domain status
in the USA. This is not a claim about every jurisdiction. Source catalogs identify
these as human KJV readings; spoken-text differences remain explicitly flagged.
Michael Armenta is the consistency-first choice across the 66 books, not a claim
that an unaudited comparison proved his recording cleanest. Wisdom of Solomon's
reader explicitly acknowledges stumblings in the catalog. Noise/level listening
review remains recorded in each source's quality note.

Six Apocrypha books currently have no verified open-license human **KJV** source:
1 Esdras, 2 Esdras, Rest of Esther, Ecclesiasticus (Sirach), Baruch and Epistle of
Jeremiah. Recordings of another translation are not substitutes. Tobit 5 and 13
currently fail the independent opening/closing anchor check; they are withheld,
not assigned estimated verse times. Chapter-only retries corrected Genesis 6 and
42; Genesis 9 and 35 remain withheld for failing the timing floor. See the generated coverage for current progress
and additional chapter-level failures. Alternatives in the manifest are verified
source leads, explicitly not yet indexed or compared by listening.

Open-source aligner: https://github.com/jianfch/stable-ts (MIT).
Source rights: https://librivox.org/pages/public-domain/.
