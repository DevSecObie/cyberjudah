import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "library"))
import class_books  # noqa: E402


class ClassBooksTest(unittest.TestCase):
    def test_every_source_row_names_a_catalogued_book(self):
        known = {(b["title"], b["author"]) for b in class_books.catalog_books.catalog()}
        for key in class_books.sources():
            self.assertIn(key, known)

    def test_shelf_statuses_and_moments(self):
        with tempfile.TemporaryDirectory() as tmp:
            heard = Path(tmp) / "books.json"
            heard.write_text(json.dumps([{"title": "Sex and Race", "author": "J. A. Rogers", "recordings": 3, "first_year": 2016, "last_year": 2020,
                                          "moments": [{"title": "Class", "date": None, "url": "https://www.youtube.com/watch?v=c8a24sLyDkI&t=340s", "text": "word " * 200},
                                                      {"title": "No video", "url": "https://example.test/", "text": "x"}]}]))
            rows = {r["title"]: r for r in class_books.build(heard)}
        rogers = rows["Sex and Race"]
        self.assertEqual(rogers["status"], "borrow")
        self.assertTrue(rogers["archive"])
        self.assertEqual(len(rogers["moments"]), 1)
        self.assertEqual((rogers["moments"][0]["video"], rogers["moments"][0]["t"]), ("c8a24sLyDkI", 340))
        self.assertLessEqual(len(rogers["moments"][0]["said"]), 425)
        self.assertEqual(rows["The Two Babylons"]["status"], "library")
        self.assertEqual(rows["The Two Babylons"]["slug"], "two-babylons")
        self.assertNotIn("lost", {r["kind"] for r in rows.values()})
        # A borrowed book never carries the book's own text, only what the classes said.
        self.assertEqual(set(rogers) - {"title", "author", "kind", "shelf", "recordings", "first_year", "last_year", "status", "archive", "moments"}, set())


if __name__ == "__main__":
    unittest.main()
