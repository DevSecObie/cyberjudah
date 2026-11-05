import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import upcoming


class Upcoming(unittest.TestCase):
    def test_lists_only_upcoming_and_live(self):
        def fetch(url):
            if "playlistItems" in url:
                self.assertIn("playlistId=UUabc", url)
                return {"items": [{"snippet": {"title": t, "resourceId": {"videoId": v}}} for v, t in
                                  [("upcoming000", "Sabbath Class"), ("livenow0000", "Live Now"), ("ended000000", "Ended"), ("upload00000", "Upload")]]}
            return {"items": [
                {"id": "upcoming000", "snippet": {"liveBroadcastContent": "upcoming"}, "liveStreamingDetails": {"scheduledStartTime": "2026-11-07T16:00:00Z"}},
                {"id": "livenow0000", "snippet": {"liveBroadcastContent": "live"}, "liveStreamingDetails": {"actualStartTime": "2026-11-05T20:00:00Z"}},
                {"id": "ended000000", "snippet": {"liveBroadcastContent": "none"}, "liveStreamingDetails": {"actualEndTime": "2026-11-01T00:00:00Z"}},
                {"id": "upload00000", "snippet": {"liveBroadcastContent": "none"}}]}
        rows = upcoming.live_classes({"Chan": "UCabc"}, "k", fetch)
        self.assertEqual(sorted(rows), ["livenow0000", "upcoming000"])
        self.assertEqual(rows["upcoming000"], {"channel": "Chan", "title": "Sabbath Class", "status": "upcoming",
                                               "scheduledStart": "2026-11-07T16:00:00Z", "actualStart": ""})

    def test_file_changes_only_when_the_list_does(self):
        with tempfile.TemporaryDirectory() as root:
            self.assertTrue(upcoming.write(root, {"a": {"status": "live"}}))
            self.assertFalse(upcoming.write(root, {"a": {"status": "live"}}))
            self.assertTrue(upcoming.write(root, {}))
            self.assertEqual(json.loads((Path(root) / upcoming.RELATIVE_PATH).read_text()), {})

    def test_channel_ids_from_the_channel_list(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / upcoming.CHANNELS_PATH
            path.parent.mkdir(parents=True)
            path.write_text("# note\nrank\thandle\tchannel_id\n1\tIUICRaleigh\tUCwq\tclasses\n2\tOther\tUCzz\tclasses\n")
            self.assertEqual(upcoming.channel_ids(root), {"IUICRaleigh": "UCwq"})


if __name__ == "__main__":
    unittest.main()
