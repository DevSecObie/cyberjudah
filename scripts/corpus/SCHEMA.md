# CyberJudah transcript corpus

The corpus is a reproducible analysis layer over the transcript JSON files in `blog/`,
`captains/`, and `history/`. The transcript files remain the evidence layer and are never
rewritten by the corpus builder.

## Purpose and scope

- **Purpose:** full-text search of what was taught (the `/teachings` page), statistics, and
  retrieval, with every passage traceable to the second it was said.
- **Scope:** every recording with an English or other caption track in the three feeds:
  Sabbath classes (`classes`), 15 Minutes w/ The Captains (`captains`), and the Our Hidden
  History radio show (`history`). Recordings without captions are listed in each feed's
  `no-captions.tsv` and are not in the corpus.
- **Unit of analysis:** the passage, a run of about 450 words cut at a pause or a speaker
  change. Passages are retrieval units, not speaker turns or topic boundaries.
- **Outputs:** the files below, written to `dist/corpus/` (ignored by Git, never published).

## Build

```bash
npm run corpus:test
npm run corpus:build        # all feeds
python3 scripts/corpus/build.py --limit 10 --skip-scriptures --strict   # smoke build
```

| Option | Effect |
|---|---|
| `--feeds classes captains history` | Build only some feeds |
| `--limit N` | Build only the first N recordings |
| `--skip-scriptures` | Skip scripture extraction (much faster) |
| `--target-words`, `--max-words` | Passage size, 450 and 650 by default |
| `--qa-sample N` | Passages drawn for manual review, 100 by default |
| `--jobs N` | Recordings built in parallel, the CPU count by default; output is identical for any N |
| `--strict` | Fail when any transcript file cannot be read |

A transcript that cannot be read is listed in `quality.json` and skipped; with `--strict` the
build then fails. A record that does not match the data dictionary always fails the build.

## Output files

| File | Contents |
|---|---|
| `documents.jsonl` | One metadata record per recording |
| `documents.csv` | The same records as a spreadsheet (lists joined with `; `, objects as JSON) |
| `segments.jsonl.gz` | One record per passage, with original and normalized text |
| `quality.json` | Totals, rule hits, language and date coverage, flagged recordings, unreadable files |
| `qa_sample.jsonl` | A fixed sample of passages for checking captions against the audio |
| `schema.json` | The data dictionary as JSON Schema |
| `manifest.json` | Versions, source commit and time, and a SHA-256 of every file |
| `README.md` | A copy of this file |

Builds are deterministic: the same inputs give byte-identical data files (`manifest.json`
records the commit they were built from).

## Pipeline and data layers

The article-style `raw -> clean -> normalized -> segmented` stages map onto the vault like this:

| Stage | Where it lives |
|---|---|
| Raw | The caption payload as received. Not stored in Git (too large); `source_sha256` records its hash for transcripts harvested since provenance was added. |
| Clean (evidence) | `*/transcripts/<videoId>.json`, written by `scripts/history/ingest.py`: whitespace normalized, `[music]`, `[applause]`, `[laughter]` and whole-cue "Heat" noise dropped, nothing else changed. |
| Normalized | `text_normalized` on every passage, by the rules below. |
| Segmented | `segments.jsonl.gz`, one row per passage, with `text_original` beside `text_normalized`. |
| Annotations | `scripture_references`, `language`, `non_speech_tags`, `speaker_changes` per passage. |
| Metadata | `documents.jsonl` / `documents.csv`, keyed by `doc_id`. |

### Speech start

Each transcript's `start` marks the second the speakers begin (the site skips what comes
before it). Cues before it, such as intro music, theme-song lyrics, countdowns and promos, go
into passages with `region` `pre_speech`; they are kept, not deleted, but are left out of the
teaching search and of `speech_word_count`. When `start` would discard most of the words or
more than half the recording it is ignored (`speech_start_source` is `ignored` and the
recording is flagged `speech_start_suspect`).

## Normalization rules

Normalization level is **light**. It changes how a caption is written, never what was said:
spelling, grammar, dialect, fillers (`um`, `uh`), false starts, repetitions, capitalization,
names and recognizer mistakes are preserved. Numbers stay as spoken ("Isaiah fourteen verse
twelve"); references are resolved into `scripture_references` instead. Rules apply in this
order, and `quality.json` `rule_hits` counts every cue each one changed:

| Rule | What it does |
|---|---|
| `unicode_nfc` | Unicode NFC composition |
| `strip_control_characters` | Removes control, zero-width and direction-override characters |
| `speaker_change_marker` | Removes YouTube's `>>` speaker-change marker, counting it in `speaker_changes` |
| `whole_cue_artifact` | A cue that is only "foreign" becomes `[foreign]`; only "Heat" (the recognizer's rendering of music) becomes `[music]` |
| `non_speech_tag` | Bracketed tags become lower-case English: `[Música]`, `[музыка]`, `[음악]` -> `[music]`; compound tags split: `[Music and singing]` -> `[music] [singing]` |
| `profanity_mask` | YouTube's `[ __ ]` profanity mask becomes `[censored]` |
| `quotes_and_dashes` | Curly quotes become straight; a dash between numbers becomes `-`, elsewhere ` - ` |
| `whitespace` | Collapses runs of whitespace |
| `caption_overlap` | Removes words a cue repeats from the end of the previous one (exact, case-insensitive, at least four words) |

Punctuation policy: punctuation is kept exactly as the captions give it. Older auto-captions
carry none; newer ones do. `caption_style` records which, so analyses can filter rather than
mix the two.

## Segmentation

Passages target 450 words and never exceed 650 unless a single cue is larger. A passage
closes at the target at the next natural break: a pause of at least 1.25 seconds or a marked
speaker change. A final passage under a quarter of the target joins its predecessor. Cues are
never split, so every passage maps back to whole source cues.

## Stable identifiers

- `doc_id`: `youtube:<videoId>`
- `segment_id`: `youtube:<videoId>:<first source cue index, six digits>`

A passage carries its first and last source cue indexes and its start and end times, so it can
be traced to the exact evidence and moment in the recording. A change that would move a
passage boundary or change `text_normalized` requires a new `corpus_version` or
`normalization_version`.

## Speakers

Captions do not name speakers, so `num_speakers` and `speaker_id` are null and `speaker_ids`
is empty. YouTube marks speaker changes with `>>`; those are counted (`speaker_changes`,
`speaker_turns_marked`) and passages prefer to break at them. Labelling speakers (for example
host and caller on the radio show) would be a new annotation layer with role-based ids, not
names.

## Language

Captions are assumed English at harvest, but some classes are taught in Spanish and some tracks
are YouTube translations. Every passage is identified from its own text (function words for
Latin script, the writing system otherwise); the recording's `language` is the language of most
of its identified words. `languages` gives the share per language, so code-switching shows up as
more than one entry. See `language.py`.

## Metadata

Missing facts are `null`, never guessed. The date comes from the transcript, then the feed's
`channel-meta.tsv`, then the date on the recording's written note; `date_source` says which.

## Quality flags

| Flag | Meaning |
|---|---|
| `missing_date` | No source gives a date; see "Backfilling metadata" |
| `missing_duration` | No source gives a duration |
| `missing_provenance` | The transcript predates provenance fields: language, method and source hash unknown |
| `empty_transcript` | No usable caption cues |
| `suspiciously_short` | Fewer than five caption cues |
| `no_speech_content` | Fewer than 30 spoken words (only tags, "foreign", or stray letters) |
| `dropped_captions` | Some cues were malformed or empty and skipped |
| `non_monotonic_timestamps` | Cue times go backwards somewhere |
| `speech_start_suspect` | The transcript's speech start was implausible and ignored |
| `language_declared_mismatch` | The detected language differs from the declared one |
| `language_undetermined` | Enough speech, but no language could be identified |
| `mixed_language` | A second language makes up at least a tenth of the identified words |
| `rebroadcast` | The title says the recording aired before |
| `duplicate_content` | Speech text identical to an earlier recording (`duplicate_of`) |

The teaching search leaves out `pre_speech` passages and recordings flagged
`no_speech_content` or `duplicate_content`.

## Privacy, consent and redaction

The corpus is marked `internal` (`privacy_level`). The recordings were broadcast publicly by
their channels (`consent_status` `public_broadcast`); the corpus is kept for internal search
and analysis and is not part of the public site build or data branch. Publishing complete
transcript text requires a separate, explicit policy decision. No personal data is added:
`location` is not collected and speakers are not identified. The only redaction in the text is
YouTube's own profanity mask (`redaction_applied`). Callers on the radio show are heard in the
captions; any excerpt beyond the search results should be checked for private individuals.

## Manual review

Captions are automatic, so names, Hebrew terms and book names are often misheard. `qa_sample.jsonl`
holds a fixed sample of spoken passages (the same passages on every build of the same inputs)
with a link to each moment in the recording and empty `review_status`, `reviewer` and
`reviewer_notes` fields. Reviewers compare the text with the audio and record the kinds of errors
found; fixes become new normalization or annotation rules, never edits to the evidence layer.
Scripture references carry `verified`, which is false when the chapter or verse does not exist in
the KJV (usually a misheard number).

## Backfilling metadata

Most older transcripts were harvested without a date. `scripts/corpus/backfill_meta.py` fills
blank dates, durations and views in each feed's `channel-meta.tsv`, never overwriting a value:

```bash
python3 scripts/corpus/backfill_meta.py --report                 # what is missing
python3 scripts/corpus/backfill_meta.py --backend yt-dlp --limit 500
python3 scripts/corpus/backfill_meta.py --from-tsv found.tsv     # id, date[, duration, views]
```

The **Backfill transcript metadata** workflow runs the yt-dlp lookup on GitHub Actions daily
(and on demand) and commits the result. It has to: the hourly harvest cannot date what it
collects, because it lists channels with yt-dlp's flat listing, which carries no dates, and
TranscriptAPI's transcript metadata carries none either. Each run tries the undated videos in a
different order, so videos YouTube will not answer for never block the rest. `--from-tsv` applies dates found any other way (for example TranscriptAPI's
video metadata); it accepts YouTube's own wording such as "Premiered Jan 5, 2023".

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

`cue_offsets` contains `[UTF-16 character offset, source caption start seconds]` pairs into
`text_normalized`. Search excerpts and video links use the same matched character offset.
Caption timings are source timings, not word-level audio alignment.

## Data dictionary

`scripts/corpus/schema.py` is the source of truth; the build validates every record against it
and writes it out as `schema.json`. Every field is always present. `null` means unknown.

### Recording (`documents.jsonl`, `documents.csv`)

| Field | Type | Meaning |
|---|---|---|
| `schema_version` | integer | Version of this data dictionary. |
| `corpus_version` | string | Version of the corpus build rules. |
| `normalization_version` | string | Version of the normalization rules. |
| `doc_id` | string | Stable id: `youtube:<videoId>`. |
| `video_id` | string | YouTube video id. |
| `feed` | string | Collection the recording belongs to. One of: `classes`, `captains`, `history`. |
| `file_name` | string | Transcript file the record was built from, relative to the repository. |
| `source_type` | string | Kind of recording. One of: `lecture`, `radio_program`. |
| `source_platform` | string | Where the recording is published. |
| `source_channel` | string or null | Channel handle the transcript was harvested from. |
| `source_url` | string | Link to the recording. |
| `title` | string | Title as published. |
| `clean_title` | string | Title without channel prefixes, hashtags and episode numbers. |
| `episode` | integer or null | Episode number, when the title carries one. |
| `date` | string or null | Publication date, YYYY-MM-DD. |
| `date_source` | string or null | Where `date` came from. One of: `transcript`, `channel-meta`, `note`, null. |
| `duration_seconds` | number or null | Length of the recording. |
| `views` | integer or null | View count when the metadata was captured. |
| `language` | string | Language of the recording: detected when confident, else declared. ISO 639-1, `und-<Script>` when only the writing system is known, `und` if undetermined. |
| `language_declared` | string or null | Language recorded at harvest time. |
| `language_detected` | string | Language detected from the caption text. ISO 639-1, `und-<Script>` when only the writing system is known, `und` if undetermined. |
| `language_confidence` | number | Share of language-identified speech words in the detected language (0-1). |
| `languages` | object | Share of speech passages' words per detected language. |
| `language_variety` | null | Dialect or variety; not recorded. |
| `location` | null | Recording location; not collected, by policy. |
| `num_speakers` | integer or null | Number of distinct speakers; unknown for captions. |
| `speaker_ids` | array | Stable speaker ids; empty until speakers are labelled. |
| `speaker_labels` | string | How speakers are identified in the text. One of: `none`. |
| `speaker_turns_marked` | integer | Speaker changes the captions mark with `>>`. |
| `domain` | string | Subject domain. One of: `religious_education`. |
| `topic_tags` | array | Tags from the written note for this recording. |
| `note_path` | string or null | Written note for this recording, relative to the repository. |
| `has_timestamps` | boolean | Whether the text is aligned to recording time. |
| `timestamp_unit` | string | Unit of every time field. One of: `seconds`. |
| `transcription_method` | string | How the captions were produced. |
| `transcription_style` | string | Transcription style of the evidence layer. One of: `lightly_cleaned_verbatim`. |
| `caption_style` | string | Whether the captions carry sentence punctuation. One of: `punctuated`, `unpunctuated`, `unknown`. |
| `normalization_level` | string | Normalization level of `text_normalized`. One of: `light`. |
| `normalization_rules` | array | Normalization rule ids applied, in order. |
| `audio_quality_notes` | null | Audio quality notes; not assessed. |
| `privacy_level` | string | Who may use the corpus. One of: `internal`. |
| `consent_status` | string | Basis for use. One of: `public_broadcast`. |
| `redaction_applied` | string | Redaction in the text. One of: `none`, `platform_profanity_mask`. |
| `created_by` | string | Program that built the record. |
| `word_count` | integer | Words in the transcript, speech and pre-speech. |
| `speech_word_count` | integer | Spoken words from the speech start on, tags excluded. |
| `pre_speech_word_count` | integer | Words before the speech start (intro music, countdown). |
| `speech_start_seconds` | number | Second the speakers begin. |
| `speech_start_source` | string | Where `speech_start_seconds` came from. One of: `transcript`, `none`, `ignored`. |
| `caption_segment_count` | integer | Usable caption cues. |
| `dropped_caption_count` | integer | Malformed or empty caption cues skipped. |
| `non_speech_tags` | object | Count of each non-speech tag. |
| `content_sha256` | string | SHA-256 of the transcript record. |
| `normalized_sha256` | string | SHA-256 of the normalized speech text. |
| `source_sha256` | string or null | SHA-256 of the caption payload as received. |
| `duplicate_of` | string or null | doc_id of an earlier recording with identical speech text. |
| `quality_flags` | array | Problems found; see SCHEMA.md. |

### Passage (`segments.jsonl.gz`)

| Field | Type | Meaning |
|---|---|---|
| `schema_version` | integer | Version of this data dictionary. |
| `corpus_version` | string | Version of the corpus build rules. |
| `segment_id` | string | Stable id: `<doc_id>:<first source cue index, 6 digits>`. |
| `doc_id` | string | Recording the passage belongs to. |
| `segment_index` | integer | Position within the recording, from 0. |
| `region` | string | Whether the passage is before or after the speakers begin. One of: `pre_speech`, `speech`. |
| `source_segment_first` | integer | Index of the first source caption cue. |
| `source_segment_last` | integer | Index of the last source caption cue. |
| `start_seconds` | number | Start time. |
| `end_seconds` | number | End time. |
| `start_time` | string | Start time, HH:MM:SS. |
| `end_time` | string | End time, HH:MM:SS. |
| `speaker_id` | null | Speaker of the passage; not labelled. |
| `speaker_changes` | integer | Speaker changes marked inside the passage. |
| `word_count` | integer | Spoken words in `text_normalized`, tags excluded. |
| `text_original` | string | Caption text joined, unedited. |
| `text_normalized` | string | Caption text after the normalization rules. |
| `cue_offsets` | array | [UTF-16 offset into text_normalized, source start seconds] per cue. |
| `caption_overlap_removed_words` | integer | Words removed as repeated caption overlap. |
| `non_speech_tags` | object | Count of each non-speech tag. |
| `language` | string | Detected language of the passage. ISO 639-1, `und-<Script>` when only the writing system is known, `und` if undetermined. |
| `language_confidence` | number | Detection confidence (0-1). |
| `scripture_references` | array | Scripture references heard in the passage. |
| `source_url` | string | Link to the recording at the passage start. |
| `notes` | null | Annotator notes; none yet. |

### Scripture reference (inside `scripture_references`)

| Field | Type | Meaning |
|---|---|---|
| `book` | string | Book. |
| `chapter` | integer | Chapter. |
| `first_verse` | integer | First verse. |
| `last_verse` | integer or null | Last verse of a range. |
| `heard_as` | string | The words the reference was recognized from. |
| `verified` | boolean | Whether the chapter and verses exist in the KJV. |

## Change log

### cj-corpus-v2 · schema 2 · cj-norm-2

- Cues before the speech start go into `pre_speech` passages instead of mixing intro music and
  theme-song lyrics into the teaching text; `speech_word_count` and search count speech only.
- All non-speech tags standardized, including foreign-language tags (`[Música]`, `[музыка]`),
  compound tags, YouTube's `[ __ ]` mask (`[censored]`), and whole-cue "foreign" and "Heat".
- `>>` speaker-change markers removed from `text_normalized`, counted, and used as passage breaks.
- Curly quotes and dashes unified; control and zero-width characters removed.
- Language identified per passage and per recording instead of assumed English.
- Recording metadata completed against the article's template: speaker, topic, consent,
  redaction, location, variety and creator fields; date falls back to the written note.
- Passages gain `region`, `start_time`/`end_time`, `speaker_id`, `speaker_changes`,
  `non_speech_tags`, `language`, `caption_overlap_removed_words`, `notes`; scripture
  references gain `verified`.
- Every record validated against the data dictionary; unreadable transcripts reported, not fatal.
- Duplicate speech text, rebroadcasts, noise-only transcripts and more quality problems flagged.
- New outputs: `documents.csv`, `qa_sample.jsonl`, `schema.json`, `manifest.json`; `quality.json`
  gains rule hits and coverage by language, date source and caption style.

### cj-corpus-v1 · schema 1

- First corpus: documents, passages, light normalization, scripture references.
