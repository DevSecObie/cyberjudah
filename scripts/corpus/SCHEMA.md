# CyberJudah transcript corpus

The corpus is a reproducible analysis layer over the transcript JSON files in `blog/`,
`captains/`, and `history/`. The transcript files remain the evidence layer and are never
rewritten by the corpus builder.

## Build

```bash
npm run corpus:build
```

Outputs are written under `dist/corpus/`, which is intentionally ignored by Git:

- `documents.jsonl`: one metadata record per recording.
- `segments.jsonl.gz`: timestamped passages suitable for full-text search, statistics,
  and retrieval-augmented generation.
- `quality.json`: totals and document-level metadata/transcript problems.
- `README.md`: a copy of this contract alongside the generated data.

Use `python3 scripts/corpus/build.py --limit 10` for a smoke build. Add
`--skip-scriptures` when only testing segmentation performance.

## Data layers

1. **Evidence:** existing caption segments, lightly cleaned during ingestion.
2. **Original corpus text:** caption text joined without spelling or grammar edits.
3. **Normalized corpus text:** Unicode NFC, whitespace, standardized non-speech tags, and
   conservative removal of exact adjacent caption overlap of at least four words.
4. **Annotations:** scripture references extracted with the same resolver used by the note
   preparation pipeline.

Dialect, false starts, fillers, capitalization, names, and recognizer mistakes are preserved.
Corrections belong in annotations or future versioned normalization rules, never in the
evidence layer.

## Stable identifiers

- `doc_id`: `youtube:<videoId>`
- `segment_id`: `youtube:<videoId>:<first-source-caption-index>`

An analysis passage carries its first and last source-caption indexes plus start/end seconds,
so it can be traced back to the exact evidence and recording. A corpus-version change is
required for a breaking normalization or segmentation change.

## Document schema

Important fields include `doc_id`, `video_id`, `feed`, `title`, `date`, `date_source`,
`duration_seconds`, `language`, `transcription_method`, `word_count`, source hashes, and
`quality_flags`. Missing facts are represented as `null`, not guessed.

`channel-meta.tsv` fills missing dates, duration, views, and titles when available. Values in
the transcript record take precedence.

## Segment schema

Each passage contains `segment_id`, `doc_id`, `segment_index`, source-caption boundaries,
timestamps, `text_original`, `text_normalized`, detected `scripture_references`, and a direct
YouTube timestamp URL.

The default target is 450 words, with a 650-word maximum unless a single source cue itself is
larger. A short final passage is merged into its predecessor. These passages are analysis and
retrieval units—not speaker turns or claims that a topic boundary occurred.

## Privacy and publication

The generated corpus is marked `internal`. It is not included in the public site build or data
branch. Publishing complete transcript text requires a separate, explicit policy decision.

## Teaching search

`python3 scripts/corpus/index.py` exports `dist/teachings.sql` for the separate
`teaching_passages` FTS5 table. It links recordings to existing notes and preserves unknown
dates. `/teachings` searches this server-side table with collection filters and 20-result
pages. Quoted phrases are exact; unquoted terms must all match. Captions are displayed as
plain text, never HTML. This is keyword search, not semantic question answering.

Run the **Build teaching search index** workflow manually after publishing code or harvesting
new transcripts. It uses the existing Cloudflare secrets and database. The regular library
index remains separate. The import replaces the teaching index, so schedule rebuilds when
brief search interruption is acceptable. Until imported, the UI displays an unavailable
message with a link to published-note search. The table exposes excerpts through the website;
the generated corpus files are not deployed as downloadable assets.
