import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dead_links


class DeadLinks(unittest.TestCase):
    def test_missing_private_and_failed_are_listed_fifty_a_request(self):
        calls = []
        def fetch(url):
            calls.append(url)
            return {"items": [
                {"id": "okokokokoko", "status": {"uploadStatus": "processed", "privacyStatus": "public"}},
                {"id": "unlistedvid", "status": {"uploadStatus": "processed", "privacyStatus": "unlisted"}},
                {"id": "privatevid0", "status": {"uploadStatus": "processed", "privacyStatus": "private"}},
                {"id": "failedvid00", "status": {"uploadStatus": "failed", "privacyStatus": "public"}}]}
        ids = ["okokokokoko", "unlistedvid", "privatevid0", "failedvid00", "gonegonegon"] + [f"x{i:010d}" for i in range(50)]
        missing = dead_links.statuses(ids, "k", fetch)
        self.assertEqual(len(calls), 2)
        self.assertEqual(missing["gonegonegon"], "deleted or private")
        self.assertEqual(missing["privatevid0"], "private")
        self.assertEqual(missing["failedvid00"], "upload failed")
        self.assertNotIn("okokokokoko", missing)
        self.assertNotIn("unlistedvid", missing)

    def test_first_seen_day_is_kept_and_returned_videos_drop_off(self):
        with tempfile.TemporaryDirectory() as root:
            videos = {"aaaaaaaaaaa": {"feed": "classes", "title": "A"}, "bbbbbbbbbbb": {"feed": "classes", "title": "B"}}
            dead_links.update(root, videos, {"aaaaaaaaaaa": "private", "bbbbbbbbbbb": "private"}, today="2026-11-01")
            added, removed = dead_links.update(root, videos, {"aaaaaaaaaaa": "deleted or private"}, today="2026-11-08")
            rows = json.loads((Path(root) / dead_links.RELATIVE_PATH).read_text())
            self.assertEqual(rows, {"aaaaaaaaaaa": {"feed": "classes", "title": "A", "reason": "deleted or private", "since": "2026-11-01"}})
            self.assertEqual((added, removed), ([], ["bbbbbbbbbbb"]))


if __name__ == "__main__":
    unittest.main()
