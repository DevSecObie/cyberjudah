#!/usr/bin/env python3
import gzip
import importlib.util
import json
import re
import sys
import tempfile
import unittest
from collections import Counter
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
SPEC = importlib.util.spec_from_file_location("corpus_build", HERE / "build.py")
corpus = importlib.util.module_from_spec(SPEC)
sys.modules["corpus_build"] = corpus  # parallel builds pickle the worker function by module name
SPEC.loader.exec_module(corpus)

import language  # noqa: E402
import schema  # noqa: E402
import sources  # noqa: E402
import textnorm  # noqa: E402

ENGLISH = "and the word of the most high is that you shall keep his law and do it with all of your heart "
SPANISH = "y la palabra de Dios es que el pueblo tiene que guardar la ley para que no les pase lo que pasó a los padres "


def english(count, first=0):
    # Distinct cues: identical neighbours would be collapsed by the caption-overlap rule.
    return [[float(first + i), f"{ENGLISH}line {first + i}"] for i in range(count)]


def spanish(count):
    return [[float(i), f"{SPANISH}línea {i}"] for i in range(count)]


def transcript(video_id="abcdefghijk", cues=None, **extra):
    record = {
        "videoId": video_id,
        "title": "A Class",
        "cleanTitle": "A Class",
        "episode": None,
        "slug": "2026/2026-01-01-a-class",
        "date": "2026-01-01",
        "duration": 100.0,
        "views": 10,
        "start": 0,
        "words": 0,
        "segments": cues if cues is not None else english(20),
    }
    record.update(extra)
    return record


def write(folder, record):
    path = Path(folder) / f"{record['videoId']}.json"
    path.write_text(json.dumps(record), encoding="utf-8")
    return path


def document(record, meta=None, notes=None, feed="classes", target=450, maximum=650):
    with tempfile.TemporaryDirectory() as folder:
        path = write(folder, record)
        return corpus.build_document(path, feed, meta or {}, notes or {}, lambda _t: [], Counter(), target, maximum)


class CorpusTests(unittest.TestCase):
    def test_caption_offsets_survive_overlap_removal_and_unicode(self):
        text, offsets = corpus.normalized_with_offsets([
            (10, '😀 We read Isaiah fourteen verse twelve'),
            (20, 'Isaiah fourteen verse twelve and continued'),
            (30, 'and continued'),
        ])
        self.assertEqual(text, '😀 We read Isaiah fourteen verse twelve and continued and continued')
        self.assertEqual(offsets[1], [len('😀 We read Isaiah fourteen verse twelve '.encode('utf-16-le')) // 2, 20])
        for offset, seconds in offsets:
            tail = text.encode('utf-16-le')[offset * 2:].decode('utf-16-le')
            self.assertTrue(tail.startswith('😀' if seconds == 10 else 'and continued'))

    def test_normalization_preserves_language_and_removes_exact_overlap(self):
        text = corpus.normalized_join([
            "We read Isaiah fourteen verse twelve",
            "Isaiah fourteen verse twelve and then continued",
            "  with   the lesson.  ",
        ])
        self.assertEqual(text, "We read Isaiah fourteen verse twelve and then continued with the lesson.")

    def test_short_tail_is_merged(self):
        segments = [(float(i), "one two three four five") for i in range(21)]
        chunks = corpus.make_chunks(segments, 21, target_words=50, max_words=60)
        self.assertEqual(chunks, [(0, 12), (12, 21)])

    def test_passages_break_at_a_speaker_change(self):
        cues = [(float(i), "one two three four five") for i in range(20)]
        cues[8] = (8.0, ">> one two three four five")
        self.assertEqual(corpus.make_chunks(cues, None, target_words=30, max_words=100)[0], (0, 8))

    def test_dates_are_normalized_without_guessing(self):
        self.assertEqual(corpus.iso_date("20260920"), "2026-09-20")
        self.assertEqual(corpus.iso_date("2026-09-20"), "2026-09-20")
        self.assertIsNone(corpus.iso_date("September 20"))
        self.assertIsNone(corpus.iso_date("20261399"))

    def test_channel_meta_durations_in_clock_form(self):
        self.assertEqual(sources.seconds("0:53"), 53.0)
        self.assertEqual(sources.seconds("1:02:03"), 3723.0)
        self.assertEqual(sources.seconds("3600.5"), 3600.5)
        self.assertIsNone(sources.seconds("NA"))
        self.assertIsNone(sources.seconds("1:75"))

    def test_json_lines_are_deterministic(self):
        self.assertEqual(corpus.json_line({"z": 1, "a": "Judah"}), '{"a":"Judah","z":1}\n')


class NormalizationTests(unittest.TestCase):
    def clean(self, text):
        hits, tags = Counter(), Counter()
        out, changes = textnorm.clean_cue(text, hits, tags)
        return out, changes, hits, tags

    def test_non_speech_tags_are_standardized_across_languages(self):
        self.assertEqual(self.clean("[Música] mi gente")[0], "[music] mi gente")
        self.assertEqual(self.clean("[музыка]")[0], "[music]")
        self.assertEqual(self.clean("[Music and Singing]")[0], "[music] [singing]")
        self.assertEqual(self.clean("[clears throat and cough]")[0], "[clears throat] [cough]")
        self.assertEqual(self.clean("[Aplausos]")[3], Counter({"applause": 1}))

    def test_profanity_mask_becomes_a_tag(self):
        out, _changes, hits, tags = self.clean("what the [ __ ] is that")
        self.assertEqual(out, "what the [censored] is that")
        self.assertEqual(hits["profanity_mask"], 1)
        self.assertEqual(tags["censored"], 1)

    def test_whole_cue_recognizer_artifacts(self):
        self.assertEqual(self.clean("foreign")[0], "[foreign]")
        self.assertEqual(self.clean(">> Heat. Heat.")[0], "[music]")
        # Only a whole cue: the word itself in speech is left alone.
        self.assertEqual(self.clean("the heat of the day")[0], "the heat of the day")
        self.assertEqual(self.clean("a foreign nation")[0], "a foreign nation")

    def test_speaker_markers_are_counted_and_removed(self):
        out, changes, _hits, _tags = self.clean(">> Amen. >> Amen.")
        self.assertEqual((out, changes), ("Amen. Amen.", 2))

    def test_quotes_dashes_and_invisible_characters(self):
        self.assertEqual(self.clean("\u201cIsrael\u201d\u2014the \u2018chosen\u2019\u200b")[0], "\"Israel\" - the 'chosen'")
        self.assertEqual(self.clean("Isaiah 1\u20133")[0], "Isaiah 1-3")

    def test_spelling_dialect_and_fillers_are_preserved(self):
        text = "um y'all gonna learn the law uh uh brethren"
        self.assertEqual(self.clean(text)[0], text)

    def test_speech_words_skip_tags(self):
        self.assertEqual(textnorm.speech_words("[music] shalom [censored] Israel"), ["shalom", "Israel"])


class LanguageTests(unittest.TestCase):
    def test_detects_english_and_spanish(self):
        self.assertEqual(language.detect(ENGLISH * 2)[0], "en")
        self.assertEqual(language.detect(SPANISH * 2)[0], "es")

    def test_detects_by_script(self):
        self.assertEqual(language.detect("음악 " * 30)[0], "ko")
        self.assertEqual(language.detect("это слово бога для народа израиля " * 5)[0], "und-Cyrl")

    def test_short_or_tag_only_text_is_undetermined(self):
        self.assertEqual(language.detect("n")[0], "und")
        self.assertEqual(language.detect("[music] " * 50)[0], "und")


class DocumentTests(unittest.TestCase):
    def test_intro_before_speech_start_is_its_own_region(self):
        cues = [[float(i), f"we the chosen people verse {i} no way"] for i in range(5)]
        cues += english(30, first=10)
        doc, passages = document(transcript(cues=cues, start=10.0), target=50, maximum=100)
        regions = [p["region"] for p in passages]
        self.assertEqual(regions[0], "pre_speech")
        self.assertNotIn("pre_speech", regions[1:])
        self.assertEqual(doc["speech_start_source"], "transcript")
        self.assertEqual(doc["speech_start_seconds"], 10.0)
        self.assertEqual(doc["pre_speech_word_count"], 40)
        self.assertEqual(passages[0]["scripture_references"], [])

    def test_implausible_speech_start_is_ignored(self):
        doc, passages = document(transcript(start=95.0, duration=100.0))
        self.assertEqual(doc["speech_start_source"], "ignored")
        self.assertIn("speech_start_suspect", doc["quality_flags"])
        self.assertEqual({p["region"] for p in passages}, {"speech"})

    def test_every_record_matches_the_data_dictionary(self):
        doc, passages = document(transcript())
        self.assertEqual(schema.validate(doc, schema.DOCUMENT), [])
        for row in passages:
            self.assertEqual(schema.validate_segment(row), [])

    def test_date_falls_back_to_channel_meta_then_note(self):
        record = transcript(date=None)
        doc, _ = document(record, meta={"abcdefghijk": {"date": "2025-05-05"}})
        self.assertEqual((doc["date"], doc["date_source"]), ("2025-05-05", "channel-meta"))
        note = {"abcdefghijk": {"path": "blog/2025/x.md", "url": "/classes/2025/x", "date": "2025-06-06", "tags": ["law"]}}
        doc, _ = document(record, notes=note)
        self.assertEqual((doc["date"], doc["date_source"], doc["topic_tags"]), ("2025-06-06", "note", ["law"]))
        doc, _ = document(record)
        self.assertEqual((doc["date"], doc["date_source"]), (None, None))
        self.assertIn("missing_date", doc["quality_flags"])

    def test_declared_language_is_checked_against_the_text(self):
        doc, passages = document(transcript(cues=spanish(30), language="en"))
        self.assertEqual((doc["language"], doc["language_declared"]), ("es", "en"))
        self.assertIn("language_declared_mismatch", doc["quality_flags"])
        self.assertTrue(all(p["language"] == "es" for p in passages))

    def test_noise_only_and_malformed_transcripts_are_flagged(self):
        doc, _ = document(transcript(cues=[[0.0, "foreign"], [1.0, "n"], ["bad", "x"], [2.0, None], [3.0]]))
        self.assertIn("no_speech_content", doc["quality_flags"])
        self.assertIn("dropped_captions", doc["quality_flags"])
        self.assertEqual(doc["dropped_caption_count"], 3)
        doc, passages = document(transcript(cues=[]))
        self.assertIn("empty_transcript", doc["quality_flags"])
        self.assertEqual(passages, [])

    def test_passage_times_are_monotonic_and_bounded(self):
        _doc, passages = document(transcript(duration=100.0), target=50, maximum=60)
        for row in passages:
            self.assertLessEqual(row["start_seconds"], row["end_seconds"])
            self.assertRegex(row["start_time"], r"^\d\d:\d\d:\d\d$")
        self.assertEqual(passages[-1]["end_seconds"], 100.0)


class BuildTests(unittest.TestCase):
    def build(self, records, *extra):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        root = Path(folder.name)
        transcripts = root / "blog" / "transcripts"
        transcripts.mkdir(parents=True)
        for record in records:
            if isinstance(record, tuple):
                (transcripts / record[0]).write_text(record[1], encoding="utf-8")
            else:
                write(transcripts, record)
        feeds = {"classes": root / "blog"}
        out = root / "out"
        with mock.patch.dict(sources.FEEDS, feeds, clear=True), mock.patch.object(sources, "notes", return_value={}):
            corpus.build(corpus.parse_args(["--out", str(out), "--skip-scriptures", *extra]))
        return out

    def test_outputs_duplicates_and_unreadable_files(self):
        out = self.build([
            transcript("aaaaaaaaaaa"),
            transcript("bbbbbbbbbbb"),
            ("broken.json", "{not json"),
        ])
        names = sorted(p.name for p in out.iterdir())
        self.assertEqual(names, ["README.md", "documents.csv", "documents.jsonl", "manifest.json",
                                 "qa_sample.jsonl", "quality.json", "schema.json", "segments.jsonl.gz"])
        docs = [json.loads(line) for line in (out / "documents.jsonl").open(encoding="utf-8")]
        self.assertEqual(docs[1]["duplicate_of"], "youtube:aaaaaaaaaaa")
        self.assertIn("duplicate_content", docs[1]["quality_flags"])
        quality = json.loads((out / "quality.json").read_text(encoding="utf-8"))
        self.assertEqual(quality["unreadable_files"][0]["file_name"], "broken.json")
        self.assertEqual(set(quality["rule_hits"]), set(textnorm.RULES))
        manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
        self.assertIn("segments.jsonl.gz", manifest["files"])

    def test_strict_fails_on_unreadable_files(self):
        with self.assertRaises(SystemExit):
            self.build([transcript(), ("broken.json", "[]")], "--strict")

    def test_builds_are_byte_identical_serial_or_parallel(self):
        records = [transcript("aaaaaaaaaaa"), transcript("ccccccccccc", cues=spanish(30)), transcript("ddddddddddd", cues=english(9))]
        first, second = self.build(records, "--jobs", "1"), self.build(records, "--jobs", "3")
        for name in ("documents.jsonl", "documents.csv", "segments.jsonl.gz", "qa_sample.jsonl", "quality.json"):
            self.assertEqual((first / name).read_bytes(), (second / name).read_bytes(), name)
        with gzip.open(first / "segments.jsonl.gz", "rt", encoding="utf-8") as rows:
            self.assertTrue(all(json.loads(line)["segment_id"].startswith("youtube:") for line in rows))


class DocumentationTests(unittest.TestCase):
    def test_schema_md_documents_every_field_and_flag(self):
        text = (HERE / "SCHEMA.md").read_text(encoding="utf-8")
        for table in schema.TABLES.values():
            for name in table:
                self.assertIn(f"`{name}`", text, name)
        source = (HERE / "build.py").read_text(encoding="utf-8")
        for flag in set(re.findall(r'flags\.append\("(\w+)"\)', source)) | {"duplicate_content"}:
            self.assertIn(f"`{flag}`", text, flag)
        for rule in textnorm.RULES:
            self.assertIn(f"`{rule}`", text, rule)


if __name__ == "__main__":
    unittest.main()
