#!/usr/bin/env python3
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("cases_from_book", Path(__file__).with_name("cases-from-book.py"))
book = importlib.util.module_from_spec(spec)
spec.loader.exec_module(book)


class CasesFromBookTests(unittest.TestCase):
    def test_references_use_the_kjv_data_names(self):
        refs, bad = book.refs_from("Genesis 2:7-9 · Psalm 23 · Ecclesiasticus 25:24 · Baruch 6:3-6 · Rest of Esther 13:1 · Acts 2:1, 4")
        self.assertEqual(bad, [])
        self.assertEqual(refs, [
            {"book": "Genesis", "chapter": 2, "verses": "7-9"},
            {"book": "Psalms", "chapter": 23},
            {"book": "Sirach", "chapter": 25, "verses": "24"},
            {"book": "Epistle of Jeremiah", "chapter": 1, "verses": "3-6"},
            {"book": "Esther (Greek)", "chapter": 13, "verses": "1"},
            {"book": "Acts", "chapter": 2, "verses": "1,4"},
        ])

    def test_a_reference_into_the_next_chapter_becomes_two(self):
        refs, _ = book.refs_from("Genesis 2:25-3:7")
        self.assertEqual(refs, [{"book": "Genesis", "chapter": 2, "verses": "25-999"}, {"book": "Genesis", "chapter": 3, "verses": "1-7"}])

    def test_page_split_paragraphs_are_rejoined(self):
        section = '<p class="sec">The Offense</p><p>First half of a paragraph</p><p class="contd">and its end.</p><p>Second.</p>'
        self.assertEqual(book.paragraphs(section), ["First half of a paragraph and its end.", "Second."])


if __name__ == "__main__":
    unittest.main()
