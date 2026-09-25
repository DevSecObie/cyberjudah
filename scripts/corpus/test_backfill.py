#!/usr/bin/env python3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import backfill_meta  # noqa: E402


class BackfillTests(unittest.TestCase):
    def test_publish_dates_in_every_form(self):
        self.assertEqual(backfill_meta.compact_date("20230105"), "20230105")
        self.assertEqual(backfill_meta.compact_date("2023-01-05"), "20230105")
        self.assertEqual(backfill_meta.compact_date("Premiered Jan 5, 2023"), "20230105")
        self.assertEqual(backfill_meta.compact_date("Streamed live on Mar 13, 2021"), "20210313")
        self.assertEqual(backfill_meta.compact_date("5 Jan 2023"), "20230105")
        self.assertIsNone(backfill_meta.compact_date("3 years ago"))
        self.assertIsNone(backfill_meta.compact_date("Feb 30, 2023"))
        self.assertIsNone(backfill_meta.compact_date("NA"))

    def test_fills_blank_cells_only_and_keeps_every_other_byte(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "channel-meta.tsv"
            path.write_text(
                "aaaaaaaaaaa\t\t\tFirst\t\n"
                "bbbbbbbbbbb\t20200101\t60\tSecond\t5\n"
                "ccccccccccc\tNA\t90\tThird | with, punctuation\t7\n",
                encoding="utf-8",
            )
            found = {
                "aaaaaaaaaaa": {"date": "20230105", "duration": "3600", "views": "12"},
                "bbbbbbbbbbb": {"date": "20990101", "duration": "1", "views": "1"},
                "ccccccccccc": {"date": "20220202", "duration": "", "views": ""},
                "ddddddddddd": {"date": "20240303", "duration": "30", "views": ""},
                "eeeeeeeeeee": {"date": "", "duration": "30", "views": ""},
            }
            filled = backfill_meta.apply(folder, found, {"ddddddddddd": "New\ttitle"})
            self.assertEqual(path.read_text(encoding="utf-8"),
                             "aaaaaaaaaaa\t20230105\t3600\tFirst\t12\n"
                             "bbbbbbbbbbb\t20200101\t60\tSecond\t5\n"
                             "ccccccccccc\t20220202\t90\tThird | with, punctuation\t7\n"
                             "ddddddddddd\t20240303\t30\tNew title\t\n")
            self.assertEqual(filled, 5)
            self.assertEqual(backfill_meta.apply(folder, found, {}), 0)

    def test_reads_found_dates_from_tsv(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "found.tsv"
            path.write_text("aaaaaaaaaaa\tPremiered Jan 5, 2023\t1,234\t4,140 views\nnot-an-id\tx\n", encoding="utf-8")
            found = backfill_meta.read_tsv(path)
            self.assertEqual(found, {"aaaaaaaaaaa": {"date": "20230105", "duration": "1234", "views": "4140"}})


if __name__ == "__main__":
    unittest.main()
