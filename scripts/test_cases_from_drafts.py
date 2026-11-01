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


if __name__ == "__main__":
    unittest.main()
