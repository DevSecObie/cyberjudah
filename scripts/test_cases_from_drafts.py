#!/usr/bin/env python3
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("cases_from_drafts", Path(__file__).with_name("cases-from-drafts.py"))
drafts = importlib.util.module_from_spec(spec)
spec.loader.exec_module(drafts)

DRAFT = {
    "code": "C999", "disp": "Kept the law", "charge": "Keeping the Levites' charge",
    "headnote": "A headnote.", "alsoCited": ["Genesis 2:25-3:7", "Obadiah 21", "Psalm 23"],
    "sections": [["The Obedience", ["First.", "Second."]], ["The Blessing", ["Third."]]],
}
CASE = {"slug": "x", "code": "C999", "name": "X", "era": "Primeval", "verdict": "curse", "laws": ["1A"], "topics": [], "relatedCases": []}


LENGTHS = {"Genesis": {2: 25, 3: 24}, "Obadiah": {1: 21}, "Psalms": {23: 6}}


class CasesFromDraftsTests(unittest.TestCase):
    def test_a_draft_replaces_the_text_and_keeps_the_panels(self):
        new, problems = drafts.apply(DRAFT, CASE, {"Genesis": {2: 25, 3: 24}, "Obadiah": {1: 21}, "Psalms": {23: 6}})
        self.assertEqual(problems, [])
        self.assertEqual(new["verdict"], "blessed")
        self.assertEqual(new["kind"], "blessing")
        self.assertEqual(new["charge"], "Keeping the Levites’ charge")
        self.assertEqual(new["offenseFull"], ["First.", "Second."])
        self.assertEqual(new["offense"], "First.")
        self.assertEqual(new["judgment"], "Third.")
        self.assertEqual(new["laws"], ["1A"])
        self.assertEqual(new["refs"], [
            {"book": "Genesis", "chapter": 2, "verses": "25"},
            {"book": "Genesis", "chapter": 3, "verses": "1-7"},
            {"book": "Obadiah", "chapter": 1, "verses": "21"},
            {"book": "Psalms", "chapter": 23},
        ])

    def test_an_unknown_disposition_is_refused(self):
        new, problems = drafts.apply({**DRAFT, "disp": "Pardoned"}, CASE, {})
        self.assertIsNone(new)
        self.assertTrue(problems)

    def test_blank_text_is_refused(self):
        blank = {**DRAFT, "sections": [["The Obedience", ["   "]], ["The Blessing", ["Third."]]]}
        self.assertIsNone(drafts.apply(blank, CASE, LENGTHS)[0])
        self.assertIsNone(drafts.apply({**DRAFT, "charge": "  "}, CASE, LENGTHS)[0])

    def test_an_unknown_chapter_is_refused(self):
        new, problems = drafts.apply({**DRAFT, "alsoCited": ["Genesis 999"]}, CASE, LENGTHS)
        self.assertIsNone(new)
        self.assertIn("unknown chapters Genesis 999", problems)

    def test_a_section_must_be_a_list_of_paragraphs(self):
        bad = {**DRAFT, "sections": [["The Obedience", "First."], ["The Blessing", ["Third."]]]}
        self.assertIsNone(drafts.apply(bad, CASE, LENGTHS)[0])

    def test_invalid_verses_are_refused(self):
        for cited in (["Genesis 2:0"], ["Genesis 2:30-31", "Psalm 23"], ["Genesis 2:9-7"]):
            new, problems = drafts.apply({**DRAFT, "alsoCited": cited}, CASE, LENGTHS)
            self.assertIsNone(new, cited)
            self.assertTrue(any(p.startswith("invalid verses") for p in problems), cited)


if __name__ == "__main__":
    unittest.main()
