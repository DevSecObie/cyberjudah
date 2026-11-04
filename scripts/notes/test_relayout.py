#!/usr/bin/env python3
"""Tests for scripts/notes/relayout.py: a note quoted whole then commented is walked verse by
verse without a word changing; a passage it cannot place is left as it is.

    python3 -m unittest discover -s scripts/notes -p 'test_*.py'
"""
import os
import sys
import unittest
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib  # noqa: E402
import relayout  # noqa: E402

HEAD = "**[Psalms 19:1-3](/bible/psalms/19#v1)**  *[[1:00](https://www.youtube.com/watch?v=TESTVIDEO01&t=60s)]*"
QUOTE = lib.quote("Psalms", 19, [1, 2, 3])


def note(*bullets):
    return "\n".join([HEAD, "", QUOTE, ""] + [f"- {b}\n" for b in bullets]) + "\n"


def words(t):
    return Counter(l for l in t.split("\n") if l.strip() and l.strip() != ">")


class Relayout(unittest.TestCase):
    def test_walks_verse_by_verse(self):
        old = note("The heavens declare the glory of God: test comment one.",
                   "A comment with no verse words stays with the one before.",
                   "There is no speech nor language: test comment three.")
        new, n = relayout.relayout(old)
        self.assertEqual(n, 1)
        self.assertEqual(words(old), words(new))
        v1, v2, c1, c3 = (new.index(s) for s in ("<sup>[1]", "<sup>[2]", "test comment one", "test comment three"))
        # verse 1, its comment, then verses 2-3 read straight through, then the comment on 3
        self.assertLess(v1, c1)
        self.assertLess(c1, v2)
        self.assertLess(v2, c3)
        self.assertIn("stays with the one before", new[c1:v2])

    def test_unplaced_comments_left_alone(self):
        old = note("A summary that opens on no verse.", "Another one.")
        self.assertEqual(relayout.relayout(old), (old, 0))

    def test_out_of_order_left_alone(self):
        old = note("There is no speech nor language: back to front.",
                   "The heavens declare the glory of God: then the first.")
        self.assertEqual(relayout.relayout(old)[1], 0)

    def test_already_walked_left_alone(self):
        once, _ = relayout.relayout(note("The heavens declare the glory of God: one.",
                                         "There is no speech nor language: three."))
        self.assertEqual(relayout.relayout(once), (once, 0))


if __name__ == "__main__":
    unittest.main()
