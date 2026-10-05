import json
import os
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import backfill_dates


def read_json(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def write_transcript(tdir, video_id, title, date=None, episode=None):
    path = os.path.join(tdir, f"{video_id}.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump({
            "schemaVersion": 2,
            "feed": "classes",
            "videoId": video_id,
            "title": title,
            "cleanTitle": title,
            "episode": episode,
            "slug": backfill_dates.episode_slug(title, episode, date),
            "date": date,
            "duration": 100.0,
            "views": None,
            "segments": [],
        }, fh)
    return path


class Backfill(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root_patch = patch.object(backfill_dates, "ROOT", self.tmp.name)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)
        self.fdir = os.path.join(self.tmp.name, "blog")
        self.tdir = os.path.join(self.fdir, "transcripts")
        os.makedirs(self.tdir)

    def run_main(self, argv, lookup):
        with patch.object(backfill_dates, "video_publish_date", side_effect=lookup), \
             patch("sys.argv", ["backfill_dates.py"] + argv), \
             patch.object(backfill_dates.time, "sleep"):
            backfill_dates.main()

    def test_confirmed_date_is_written_back_with_a_fresh_slug(self):
        write_transcript(self.tdir, "AAAAAAAAAAA", "A Found Date")
        self.run_main(["--feed", "classes"], lambda vid: "2019-11-15")
        rec = read_json(os.path.join(self.tdir, "AAAAAAAAAAA.json"))
        self.assertEqual(rec["date"], "2019-11-15")
        self.assertEqual(rec["slug"], "2019/2019-11-15-a-found-date")

    def test_unconfirmed_date_is_left_alone_and_listed(self):
        write_transcript(self.tdir, "BBBBBBBBBBB", "Still A Mystery")
        self.run_main(["--feed", "classes"], lambda vid: None)
        rec = read_json(os.path.join(self.tdir, "BBBBBBBBBBB.json"))
        self.assertIsNone(rec["date"])
        with open(os.path.join(self.fdir, "no-publish-date.tsv")) as fh:
            listed = fh.read()
        self.assertIn("BBBBBBBBBBB\tStill A Mystery", listed)

    def test_already_dated_transcripts_are_never_looked_up(self):
        write_transcript(self.tdir, "CCCCCCCCCCC", "Already Dated", date="2020-01-01")
        self.run_main(["--feed", "classes"], lambda vid: self.fail("should not be called"))
        rec = read_json(os.path.join(self.tdir, "CCCCCCCCCCC.json"))
        self.assertEqual(rec["date"], "2020-01-01")

    def test_dry_run_looks_up_but_writes_nothing(self):
        write_transcript(self.tdir, "DDDDDDDDDDD", "Dry Run Only")
        self.run_main(["--feed", "classes", "--dry-run"], lambda vid: "2021-06-01")
        rec = read_json(os.path.join(self.tdir, "DDDDDDDDDDD.json"))
        self.assertIsNone(rec["date"])
        self.assertFalse(os.path.exists(os.path.join(self.fdir, "no-publish-date.tsv")))

    def test_limit_bounds_how_many_are_attempted(self):
        write_transcript(self.tdir, "EEEEEEEEEE1", "First")
        write_transcript(self.tdir, "EEEEEEEEEE2", "Second")
        calls = []

        def lookup(vid):
            calls.append(vid)
            return "2022-03-03"

        self.run_main(["--feed", "classes", "--limit", "1"], lookup)
        self.assertEqual(len(calls), 1)


if __name__ == "__main__":
    unittest.main()
