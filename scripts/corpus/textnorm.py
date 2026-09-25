"""Cleaning and normalization rules for the analysis layer of the corpus.

Every rule here is light: it changes how a caption is written, never what was said. Spelling,
grammar, dialect, fillers, false starts, capitalization and recognizer mistakes are preserved.
Each rule has a stable id; the build counts how often each one fires (quality.json
`rule_hits`) so any change to the text can be accounted for.

Bump NORMALIZATION_VERSION whenever a rule changes what it produces.
"""

import re
import unicodedata
from collections import Counter

NORMALIZATION_VERSION = "cj-norm-2"

# Rule ids in the order they are applied. Recorded on every document.
RULES = (
    "unicode_nfc",
    "strip_control_characters",
    "speaker_change_marker",
    "whole_cue_artifact",
    "non_speech_tag",
    "profanity_mask",
    "quotes_and_dashes",
    "whitespace",
    "caption_overlap",
)

CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f​-‏  ‪-‮⁠﻿]")
CONTROL_ASCII = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")
SPEAKER = re.compile(r"\s*>>+\s*")
SPACE = re.compile(r"\s+")
TOKEN = re.compile(r"\S+")
BRACKET = re.compile(r"\[([^\[\]]{0,60})\]")
TAG_TOKEN = re.compile(r"^\[[^\[\]]*\]$")

# YouTube's recognizer writes these as the whole cue when there is no English speech.
# "foreign" marks speech in another language; "Heat" is how it renders music.
FOREIGN_CUE = re.compile(r"(?i)\[?\s*foreign\s*\]?[.!,]?")
HEAT_CUE = re.compile(r"(?i)(heat[.!,]?\s*)+")

# YouTube's own profanity mask.
PROFANITY = "__"

# Non-speech tags as they appear in translated or foreign-language caption tracks.
TAG_ALIASES = {
    "music": "music", "música": "music", "musica": "music", "muzyka": "music", "musique": "music",
    "muziek": "music", "музыка": "music", "음악": "music", "âm nhạc": "music", "موسيقى": "music",
    "musiqi": "music", "muzică": "music", "musik": "music", "müzik": "music", "muzik": "music",
    "音楽": "music", "音乐": "music", "מוזיקה": "music", "mziki": "music",
    "applause": "applause", "aplausos": "applause", "аплодисменты": "applause",
    "applaudissements": "applause", "applaus": "applause", "applausi": "applause", "aplauzi": "applause",
    "aplauze": "applause", "박수": "applause", "تصفيق": "applause",
    "laughter": "laughter", "laughs": "laughter", "laughing": "laughter", "risas": "laughter",
    "rires": "laughter", "смех": "laughter", "웃음": "laughter", "risos": "laughter",
    "cough": "cough", "coughing": "cough", "coughs": "cough",
    "clears throat": "clears throat", "throat clearing": "clears throat",
    "inaudible": "inaudible", "unintelligible": "inaudible", "crosstalk": "crosstalk",
    "foreign": "foreign", "silence": "silence", "noise": "noise",
}
TAG_SPLIT = re.compile(r"\s*(?:\band\b|&|,|\by\b|\bet\b|\bund\b|\bи\b)\s*", re.I)


def canonical_tags(inner):
    """'Music and singing' -> ['music', 'singing']; unknown tags are kept, lower-cased."""
    inner = SPACE.sub(" ", inner).strip().lower()
    if not inner:
        return []
    if inner.replace(" ", "") == PROFANITY:
        return ["censored"]
    parts = [p for p in TAG_SPLIT.split(inner) if p]
    return [TAG_ALIASES.get(p, p) for p in parts] or [TAG_ALIASES.get(inner, inner)]


def _replace_tags(text, hits, tags):
    def sub(match):
        inner = match.group(1)
        found = canonical_tags(inner)
        if not found:
            return " "
        rule = "profanity_mask" if found == ["censored"] else "non_speech_tag"
        rendered = " ".join(f"[{tag}]" for tag in found)
        if match.group(0) != rendered:
            hits[rule] += 1
        tags.update(found)
        return f" {rendered} "

    return BRACKET.sub(sub, text)


def _quotes_and_dashes(text, hits):
    out = text
    for old, new in (("‘", "'"), ("’", "'"), ("‚", "'"), ("‛", "'"),
                     ("“", '"'), ("”", '"'), ("„", '"'), ("«", '"'), ("»", '"'),
                     ("…", "...")):
        out = out.replace(old, new)
    # A dash between digits is a range (Isaiah 1–3); anywhere else it is a break in speech.
    out = re.sub(r"(?<=\d)\s*[‐-―−]\s*(?=\d)", "-", out)
    out = re.sub(r"\s*[–—―−]\s*", " - ", out)
    out = re.sub(r"[‐‑]", "-", out)
    if out != text:
        hits["quotes_and_dashes"] += 1
    return out


def clean_cue(raw, hits=None, tags=None):
    """One caption cue -> (normalized text, speaker changes marked in it).

    `hits` (Counter) receives one count per rule that changed the cue; `tags` (Counter)
    receives every non-speech tag found. Returns '' for a cue with nothing left in it.
    """
    hits = hits if hits is not None else Counter()
    tags = tags if tags is not None else Counter()
    text = str(raw or "")
    # Most cues are plain ASCII; the Unicode rules cannot change them.
    plain = text.isascii()

    if not plain:
        nfc = unicodedata.normalize("NFC", text)
        if nfc != text:
            hits["unicode_nfc"] += 1
        text = nfc

    if not plain or CONTROL_ASCII.search(text):
        stripped = CONTROL.sub(" ", text)
        if stripped != text:
            hits["strip_control_characters"] += 1
        text = stripped

    changes = text.count(">>") and len(re.findall(r">>+", text))
    if changes:
        hits["speaker_change_marker"] += 1
        text = SPEAKER.sub(" ", text)

    bare = SPACE.sub(" ", text).strip()
    if bare and FOREIGN_CUE.fullmatch(bare):
        hits["whole_cue_artifact"] += 1
        tags["foreign"] += 1
        return "[foreign]", changes
    if bare and HEAT_CUE.fullmatch(bare):
        hits["whole_cue_artifact"] += 1
        tags["music"] += 1
        return "[music]", changes

    if "[" in text:
        text = _replace_tags(text, hits, tags)
    if not plain:
        text = _quotes_and_dashes(text, hits)

    collapsed = SPACE.sub(" ", text).strip()
    if collapsed != text:
        hits["whitespace"] += 1
    return collapsed, changes


def normalize_piece(text):
    """Normalize a single piece of caption text (kept for callers of the v1 API)."""
    return clean_cue(text)[0]


def is_tag(token):
    return bool(TAG_TOKEN.match(token))


def speech_words(text):
    """Words actually spoken: every token that is not a non-speech tag."""
    return [t for t in TOKEN.findall(text) if not is_tag(t)]


def overlap_words(left, right, minimum=4, maximum=30):
    """Exact, case-insensitive caption overlap; intentionally conservative."""
    a, b = left.split(), right.split()
    if len(b) < minimum or len(a) < minimum:
        return 0
    # Any overlap starts with right's first word somewhere in left's tail.
    first = b[0].casefold()
    if not any(word.casefold() == first for word in a[-maximum:]):
        return 0
    for size in range(min(maximum, len(a), len(b)), minimum - 1, -1):
        if [x.casefold() for x in a[-size:]] == [x.casefold() for x in b[:size]]:
            return size
    return 0


def normalized_with_offsets(cues, hits=None, tags=None):
    """(text, cue_offsets) for `cues` of (seconds, text); see normalize_cues."""
    text, offsets, _changes, _removed = normalize_cues(cues, hits, tags)
    return text, offsets


def normalize_cues(cues, hits=None, tags=None):
    """Normalize and join cues, keeping UTF-16 offsets tied to each cue's start second.

    Returns (text, cue_offsets, speaker_changes, overlap_words_removed). A cue_offset is
    [UTF-16 offset into text, source start seconds] for every cue that contributed text.
    """
    hits = hits if hits is not None else Counter()
    tags = tags if tags is not None else Counter()
    out, offsets = [], []
    previous = ""
    length = 0
    changes = 0
    removed = 0
    for seconds, raw in cues:
        text, marked = clean_cue(raw, hits, tags)
        changes += marked
        if not text:
            continue
        overlap = overlap_words(previous, text) if previous else 0
        words = text.split()
        if overlap:
            hits["caption_overlap"] += 1
            removed += overlap
        if overlap == len(words):
            continue
        text = " ".join(words[overlap:])
        if out:
            length += 1
        offsets.append([length, seconds])
        out.append(text)
        length += len(text.encode("utf-16-le")) // 2
        # Only the tail can overlap the next cue; keep the window bounded.
        previous = " ".join((previous + " " + text).split()[-60:])
    return " ".join(out), offsets, changes, removed


def normalized_join(texts):
    return normalized_with_offsets((0, text) for text in texts)[0]


def caption_style(texts):
    """'punctuated' when captions carry sentence punctuation, else 'unpunctuated'."""
    words = marks = 0
    for text in texts:
        words += len(text.split())
        marks += len(re.findall(r"[.?!]", text))
    if words < 50:
        return "unknown"
    return "punctuated" if marks / words >= 0.02 else "unpunctuated"
