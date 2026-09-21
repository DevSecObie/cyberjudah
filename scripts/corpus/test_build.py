#!/usr/bin/env python3
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("build.py")
SPEC = importlib.util.spec_from_file_location("corpus_build", MODULE_PATH)
corpus = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(corpus)


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

    def test_dates_are_normalized_without_guessing(self):
        self.assertEqual(corpus.iso_date("20260920"), "2026-09-20")
        self.assertEqual(corpus.iso_date("2026-09-20"), "2026-09-20")
        self.assertIsNone(corpus.iso_date("September 20"))

    def test_json_lines_are_deterministic(self):
        self.assertEqual(corpus.json_line({"z": 1, "a": "Judah"}), '{"a":"Judah","z":1}\n')


if __name__ == "__main__":
    unittest.main()
