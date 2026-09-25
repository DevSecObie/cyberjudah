#!/usr/bin/env python3
import sqlite3
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import index  # noqa: E402


def passage(text, offsets, start=100.0):
    return {"text_normalized": text, "cue_offsets": offsets, "start_seconds": start}


class IndexTests(unittest.TestCase):
    def test_book_slugs_come_from_the_kjv_data(self):
        slugs = index.book_slugs()
        self.assertEqual(slugs["1 Kings"], "1-kings")
        self.assertEqual(slugs["Sirach"], "sirach")

    def test_reference_time_is_the_cue_it_was_heard_in(self):
        text = "we read 😀 today turn to Isaiah 14 and 12 now"
        cut = len(text[:text.index("turn")].encode("utf-16-le")) // 2
        p = passage(text, [[0, 100.0], [cut, 130.5]])
        self.assertEqual(index.heard_at(p, "Isaiah 14 and 12"), (130.5, "caption"))
        self.assertEqual(index.heard_at(p, "we read"), (100.0, "caption"))
        self.assertEqual(index.heard_at(p, "never said"), (100.0, "passage"))

    def test_only_verified_references_with_a_known_book_are_exported(self):
        p = passage("Isaiah 14 and 12 and Isaiah 14 and 12 again", [[0, 5.0]])
        p["scripture_references"] = [
            {"book": "Isaiah", "chapter": 14, "first_verse": 12, "last_verse": None, "heard_as": "Isaiah 14 and 12", "verified": True},
            {"book": "Isaiah", "chapter": 14, "first_verse": 12, "last_verse": None, "heard_as": "Isaiah 14 and 12", "verified": True},
            {"book": "Isaiah", "chapter": 99, "first_verse": 1, "last_verse": None, "heard_as": "x", "verified": False},
            {"book": "Nowhere", "chapter": 1, "first_verse": 1, "last_verse": None, "heard_as": "x", "verified": True},
        ]
        doc = {"video_id": "abcdefghijk", "title": "T", "feed": "classes", "date": None}
        rows = list(index.references(p, doc, "/classes/2024/t", {"Isaiah": "isaiah"}))
        self.assertEqual(rows, [["isaiah", 14, 12, None, "abcdefghijk", 5.0, "caption", "T", "classes", None, "/classes/2024/t", "Isaiah 14 and 12"]])

    def test_sql_values_load(self):
        db = sqlite3.connect(":memory:")
        db.execute("CREATE TABLE t(a TEXT, b INTEGER, c REAL)")
        db.execute(f"INSERT INTO t VALUES({index.literal(chr(105) + chr(39) + 's')},{index.number(None)},{index.number(1.5)})")
        self.assertEqual(db.execute("SELECT * FROM t").fetchall(), [("i's", None, 1.5)])


if __name__ == "__main__":
    unittest.main()
