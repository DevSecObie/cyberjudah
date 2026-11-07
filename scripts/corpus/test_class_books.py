import json
import gzip
import sys
import tempfile
import unittest
from unittest.mock import patch
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
        self.assertEqual(set(rogers) - {"title", "author", "kind", "shelf", "recordings", "first_year", "last_year", "status", "archive", "moments", "key"}, set())

    def test_complete_lists_include_every_counted_recording_with_verbatim_words(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            documents, passages = [], []
            for number in range(12):
                video = f"{number:011d}"
                doc = f"youtube:{video}"
                original = "Before " * 45 + "The Recorded Book is named here, exactly as spoken. " + "After " * 80
                documents.append({"doc_id": doc, "video_id": video, "title": f"Class {number}", "feed": "classes", "date": f"2025-01-{number + 1:02d}", "note_path": None, "quality_flags": []})
                passages.append({"doc_id": doc, "segment_id": f"{doc}:000000", "segment_index": 0, "region": "speech", "start_seconds": number * 10, "text_normalized": original.lower(), "text_original": original, "scripture_references": []})
            # A second mention in one recording does not create a second counted class.
            passages.append({**passages[0], "segment_id": "youtube:00000000000:000001", "segment_index": 1})
            documents.append({**documents[0], "doc_id": "youtube:duplicate00", "video_id": "duplicate00", "quality_flags": ["duplicate_content"]})
            passages.append({**passages[0], "doc_id": "youtube:duplicate00"})
            (folder / 'documents.jsonl').write_text(''.join(json.dumps(row) + '\n' for row in documents))
            with gzip.open(folder / 'segments.jsonl.gz', 'wt') as stream:
                stream.write(''.join(json.dumps(row) + '\n' for row in passages))
            catalog = [{"title": "The Recorded Book", "author": "Recorded author", "kind": "history", "forms": ["recorded book"]}]
            heard = class_books.catalog_books.count(folder, catalog, 8, all_recordings=True)
            self.assertEqual(heard[0]['recordings'], 12)
            self.assertEqual(len(heard[0]['moments']), 8)
            self.assertEqual(len(heard[0]['all_recordings']), 12)
            for moment in heard[0]['all_recordings']:
                self.assertLessEqual(len(moment['said']), 300)
                self.assertIn(moment['said'], original)
                self.assertIn('The Recorded Book', moment['said'])
            output = folder / 'published' / 'class-books.json'
            with patch.object(class_books.catalog_books, 'catalog', return_value=catalog), patch.object(class_books, 'sources', return_value={}):
                class_books.main(['--corpus', str(folder), '--out', str(output)])
            shelf = json.loads(output.read_text())
            complete = json.loads((output.parent / 'class-books' / f"{shelf[0]['key']}.json").read_text())
            self.assertEqual(complete['total'], shelf[0]['recordings'])
            self.assertEqual(len(complete['moments']), 12)
            self.assertEqual(complete['moments'][0]['date'], '2025-01-12')

    def test_aliases_share_a_unique_complete_list_and_the_same_total(self):
        rows = [{"key": "held-book", "title": title, "author": "Writer", "recordings": 2} for title in ['First name', 'Other name']]
        def moment(video, at):
            return {"video": video, "t": at, "title": 'Class', "date": '2025-01-01', "teacher": '', "url": 'https://example.test/class', "said": 'Exact source words.'}
        heard = [
            {"title": 'First name', "author": 'Writer', "recordings": 2, "all_recordings": [moment('aaaaaaaaaaa', 20), moment('bbbbbbbbbbb', 30)]},
            {"title": 'Other name', "author": 'Writer', "recordings": 2, "all_recordings": [moment('bbbbbbbbbbb', 10), moment('ccccccccccc', 40)]},
        ]
        complete = class_books.full_lists(rows, heard)['held-book']
        self.assertEqual(complete['total'], 3)
        self.assertEqual([row['recordings'] for row in rows], [3, 3])
        self.assertEqual(next(m['t'] for m in complete['moments'] if m['video'] == 'bbbbbbbbbbb'), 10)

    def test_keys_are_stable_and_an_eight_sample_file_is_not_a_complete_list(self):
        rows = [{"title": 'Same title', "author": author} for author in ['One', 'Two']]
        class_books.add_keys(rows)
        backward = [{"title": 'Same title', "author": author} for author in ['Two', 'One']]
        class_books.add_keys(backward)
        self.assertEqual({r['author']: r['key'] for r in rows}, {r['author']: r['key'] for r in backward})
        self.assertNotEqual(rows[0]['key'], rows[1]['key'])
        row = {"key": 'sampled-book', "title": 'Sampled book', "author": 'Writer', "recordings": 385}
        heard = [{**row, "moments": [{}] * 8}]
        self.assertNotIn('sampled-book', class_books.full_lists([row], heard))
        with self.assertRaises(ValueError):
            class_books.full_lists([row], [{**heard[0], "all_recordings": []}])


if __name__ == "__main__":
    unittest.main()
