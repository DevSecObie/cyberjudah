"""The corpus data dictionary: every field, its type, and what it means.

The build validates every record against these definitions and refuses to write a corpus
that does not match them; `schema.json` in the output is generated from this file, and a test
checks that SCHEMA.md documents every field listed here. Change a field here first.

Types: string, integer, number, boolean, array, object, null. A field listed with "null" may
be null, which always means "not known", never "none".
"""

SCHEMA_VERSION = 2

LANGUAGE_NOTE = "ISO 639-1, `und-<Script>` when only the writing system is known, `und` if undetermined"

# name: (types, description, allowed values or None)
DOCUMENT = {
    "schema_version": (("integer",), "Version of this data dictionary", None),
    "corpus_version": (("string",), "Version of the corpus build rules", None),
    "normalization_version": (("string",), "Version of the normalization rules", None),
    "doc_id": (("string",), "Stable id: `youtube:<videoId>`", None),
    "video_id": (("string",), "YouTube video id", None),
    "feed": (("string",), "Collection the recording belongs to", ("classes", "captains", "history")),
    "file_name": (("string",), "Transcript file the record was built from, relative to the repository", None),
    "source_type": (("string",), "Kind of recording", ("lecture", "radio_program")),
    "source_platform": (("string",), "Where the recording is published", None),
    "source_channel": (("string", "null"), "Channel handle the transcript was harvested from", None),
    "source_url": (("string",), "Link to the recording", None),
    "title": (("string",), "Title as published", None),
    "clean_title": (("string",), "Title without channel prefixes, hashtags and episode numbers", None),
    "episode": (("integer", "null"), "Episode number, when the title carries one", None),
    "date": (("string", "null"), "Publication date, YYYY-MM-DD", None),
    "date_source": (("string", "null"), "Where `date` came from", ("transcript", "channel-meta", "note", None)),
    "duration_seconds": (("number", "null"), "Length of the recording", None),
    "views": (("integer", "null"), "View count when the metadata was captured", None),
    "language": (("string",), "Language of the recording: detected when confident, else declared. " + LANGUAGE_NOTE, None),
    "language_declared": (("string", "null"), "Language recorded at harvest time", None),
    "language_detected": (("string",), "Language detected from the caption text. " + LANGUAGE_NOTE, None),
    "language_confidence": (("number",), "Share of language-identified speech words in the detected language (0-1)", None),
    "languages": (("object",), "Share of speech passages' words per detected language", None),
    "language_variety": (("null",), "Dialect or variety; not recorded", None),
    "location": (("null",), "Recording location; not collected, by policy", None),
    "num_speakers": (("integer", "null"), "Number of distinct speakers; unknown for captions", None),
    "speaker_ids": (("array",), "Stable speaker ids; empty until speakers are labelled", None),
    "speaker_labels": (("string",), "How speakers are identified in the text", ("none",)),
    "speaker_turns_marked": (("integer",), "Speaker changes the captions mark with `>>`", None),
    "domain": (("string",), "Subject domain", ("religious_education",)),
    "topic_tags": (("array",), "Tags from the written note for this recording", None),
    "note_path": (("string", "null"), "Written note for this recording, relative to the repository", None),
    "has_timestamps": (("boolean",), "Whether the text is aligned to recording time", None),
    "timestamp_unit": (("string",), "Unit of every time field", ("seconds",)),
    "transcription_method": (("string",), "How the captions were produced", None),
    "transcription_style": (("string",), "Transcription style of the evidence layer", ("lightly_cleaned_verbatim",)),
    "caption_style": (("string",), "Whether the captions carry sentence punctuation", ("punctuated", "unpunctuated", "unknown")),
    "normalization_level": (("string",), "Normalization level of `text_normalized`", ("light",)),
    "normalization_rules": (("array",), "Normalization rule ids applied, in order", None),
    "audio_quality_notes": (("null",), "Audio quality notes; not assessed", None),
    "privacy_level": (("string",), "Who may use the corpus", ("internal",)),
    "consent_status": (("string",), "Basis for use", ("public_broadcast",)),
    "redaction_applied": (("string",), "Redaction in the text", ("none", "platform_profanity_mask")),
    "created_by": (("string",), "Program that built the record", None),
    "word_count": (("integer",), "Words in the transcript, speech and pre-speech", None),
    "speech_word_count": (("integer",), "Spoken words from the speech start on, tags excluded", None),
    "pre_speech_word_count": (("integer",), "Words before the speech start (intro music, countdown)", None),
    "speech_start_seconds": (("number",), "Second the speakers begin", None),
    "speech_start_source": (("string",), "Where `speech_start_seconds` came from", ("transcript", "none", "ignored")),
    "caption_segment_count": (("integer",), "Usable caption cues", None),
    "dropped_caption_count": (("integer",), "Malformed or empty caption cues skipped", None),
    "non_speech_tags": (("object",), "Count of each non-speech tag", None),
    "content_sha256": (("string",), "SHA-256 of the transcript record", None),
    "normalized_sha256": (("string",), "SHA-256 of the normalized speech text", None),
    "source_sha256": (("string", "null"), "SHA-256 of the caption payload as received", None),
    "duplicate_of": (("string", "null"), "doc_id of an earlier recording with identical speech text", None),
    "quality_flags": (("array",), "Problems found; see SCHEMA.md", None),
}

REFERENCE = {
    "book": (("string",), "Book", None),
    "chapter": (("integer",), "Chapter", None),
    "first_verse": (("integer",), "First verse", None),
    "last_verse": (("integer", "null"), "Last verse of a range", None),
    "heard_as": (("string",), "The words the reference was recognized from", None),
    "verified": (("boolean",), "Whether the chapter and verses exist in the KJV", None),
}

SEGMENT = {
    "schema_version": (("integer",), "Version of this data dictionary", None),
    "corpus_version": (("string",), "Version of the corpus build rules", None),
    "segment_id": (("string",), "Stable id: `<doc_id>:<first source cue index, 6 digits>`", None),
    "doc_id": (("string",), "Recording the passage belongs to", None),
    "segment_index": (("integer",), "Position within the recording, from 0", None),
    "region": (("string",), "Whether the passage is before or after the speakers begin", ("pre_speech", "speech")),
    "source_segment_first": (("integer",), "Index of the first source caption cue", None),
    "source_segment_last": (("integer",), "Index of the last source caption cue", None),
    "start_seconds": (("number",), "Start time", None),
    "end_seconds": (("number",), "End time", None),
    "start_time": (("string",), "Start time, HH:MM:SS", None),
    "end_time": (("string",), "End time, HH:MM:SS", None),
    "speaker_id": (("null",), "Speaker of the passage; not labelled", None),
    "speaker_changes": (("integer",), "Speaker changes marked inside the passage", None),
    "word_count": (("integer",), "Spoken words in `text_normalized`, tags excluded", None),
    "text_original": (("string",), "Caption text joined, unedited", None),
    "text_normalized": (("string",), "Caption text after the normalization rules", None),
    "cue_offsets": (("array",), "[UTF-16 offset into text_normalized, source start seconds] per cue", None),
    "caption_overlap_removed_words": (("integer",), "Words removed as repeated caption overlap", None),
    "non_speech_tags": (("object",), "Count of each non-speech tag", None),
    "language": (("string",), "Detected language of the passage. " + LANGUAGE_NOTE, None),
    "language_confidence": (("number",), "Detection confidence (0-1)", None),
    "scripture_references": (("array",), "Scripture references heard in the passage", None),
    "source_url": (("string",), "Link to the recording at the passage start", None),
    "notes": (("null",), "Annotator notes; none yet", None),
}

TABLES = {"document": DOCUMENT, "segment": SEGMENT, "scripture_reference": REFERENCE}

_PYTHON_TYPES = {
    "string": str,
    "integer": int,
    "number": (int, float),
    "boolean": bool,
    "array": list,
    "object": dict,
    "null": type(None),
}


def _matches(value, kind):
    if kind in ("integer", "number") and isinstance(value, bool):
        return False
    return isinstance(value, _PYTHON_TYPES[kind])


def validate(record, fields, where=""):
    """Every way `record` departs from `fields`, as readable strings (empty when valid)."""
    errors = []
    for name in fields.keys() - record.keys():
        errors.append(f"{where}{name}: missing")
    for name in record.keys() - fields.keys():
        errors.append(f"{where}{name}: not in the data dictionary")
    for name, (types, _description, allowed) in fields.items():
        if name not in record:
            continue
        value = record[name]
        if not any(_matches(value, kind) for kind in types):
            errors.append(f"{where}{name}: {type(value).__name__} is not {'/'.join(types)}")
        elif allowed is not None and value not in allowed:
            errors.append(f"{where}{name}: {value!r} is not one of {allowed}")
    return sorted(errors)


def validate_segment(row):
    errors = validate(row, SEGMENT)
    for index, ref in enumerate(row.get("scripture_references") or []):
        errors += validate(ref, REFERENCE, f"scripture_references[{index}].")
    return errors


def _json_schema_table(fields, title):
    properties = {}
    for name, (types, description, allowed) in fields.items():
        prop = {"type": list(types) if len(types) > 1 else types[0], "description": description}
        if allowed is not None:
            prop["enum"] = list(allowed)
        properties[name] = prop
    return {
        "title": title,
        "type": "object",
        "additionalProperties": False,
        "required": list(fields),
        "properties": properties,
    }


def json_schema():
    """The data dictionary as JSON Schema (draft 2020-12)."""
    segment = _json_schema_table(SEGMENT, "segment")
    segment["properties"]["scripture_references"]["items"] = {"$ref": "#/$defs/scripture_reference"}
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "CyberJudah transcript corpus",
        "schema_version": SCHEMA_VERSION,
        "$defs": {
            "document": _json_schema_table(DOCUMENT, "document"),
            "segment": segment,
            "scripture_reference": _json_schema_table(REFERENCE, "scripture_reference"),
        },
    }
