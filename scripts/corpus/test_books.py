#!/usr/bin/env python3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import books  # noqa: E402


class BookTests(unittest.TestCase):
    def test_the_catalog_is_well_formed(self):
        rows = books.catalog()
        self.assertGreater(len(rows), 200)
        books_ = [(r["title"], r["author"]) for r in rows]
        self.assertEqual(len(books_), len(set(books_)), "a book is listed twice")
        forms = [f for r in rows for f in r["forms"]]
        self.assertEqual(len(forms), len(set(forms)), "a search form names two books")
        self.assertTrue(all(f == f.lower() for f in forms))
        # Forms that are scripture read aloud would count Bible readings as the book.
        self.assertNotIn("behold a pale horse", forms)

    def test_bad_rows_are_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "books.tsv"
            path.write_text("A Book\tAn Author\tnovel\ta book\n", encoding="utf-8")
            with self.assertRaises(SystemExit):
                books.catalog(path)
            path.write_text("A Book\tAn Author\thistory\t\n", encoding="utf-8")
            with self.assertRaises(SystemExit):
                books.catalog(path)

    def test_report_groups_by_kind_and_lists_the_unheard(self):
        results = [
            {"title": "Sex and Race", "author": "J. A. Rogers", "kind": "history", "recordings": 14, "first_year": "2020", "last_year": "2026",
             "moments": [{"title": "A Class", "url": "https://www.youtube.com/watch?v=aaaaaaaaaaa&t=5s"}]},
            {"title": "Black's Law Dictionary", "author": "", "kind": "reference", "recordings": 0, "first_year": None, "last_year": None, "moments": []},
        ]
        text = books.markdown(results)
        self.assertIn("## History and scholarship", text)
        self.assertIn("| Sex and Race | J. A. Rogers | 14 | 2020–2026 | [A Class](https://www.youtube.com/watch?v=aaaaaaaaaaa&t=5s) |", text)
        self.assertNotIn("## Dictionaries", text)
        self.assertIn("Black's Law Dictionary", text.split("not found in the captions")[1])


if __name__ == "__main__":
    unittest.main()
