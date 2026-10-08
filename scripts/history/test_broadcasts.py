import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from broadcasts import RELATIVE_PATH, parse_broadcast, record_broadcast

VIDEO = "pZs5reAzxi4"


def page(**changes):
    live = {"isLiveNow": False, "startTimestamp": "2026-10-03T17:56:00-04:00", "endTimestamp": "2026-10-04T01:46:53Z", **changes}
    return json.dumps({"playerMicroformatRenderer": {"externalVideoId": VIDEO, "publishDate": "2026-10-04T02:38:19Z", "liveBroadcastDetails": live}})


class BroadcastTests(unittest.TestCase):
    def test_actual_start_not_upload_or_end(self):
        self.assertEqual(parse_broadcast(page(), VIDEO, "2026-10-03"), {"date": "2026-10-03", "broadcastAt": "2026-10-03T21:56:00Z"})

    def test_preserves_class_day_across_utc_midnight(self):
        self.assertEqual(parse_broadcast(page(startTimestamp="2026-10-04T00:05:00Z"), VIDEO, "2026-10-03")["date"], "2026-10-03")

    def test_rejects_other_video_and_incomplete_or_invalid_times(self):
        self.assertIsNone(parse_broadcast(page(), "abcdefghijk", "2026-10-03"))
        for changes in [{"isLiveNow": True}, {"endTimestamp": None}, {"startTimestamp": "bad"}, {"startTimestamp": "2026-10-03T17:56:00"}, {"startTimestamp": "2026-10-05T00:00:00Z"}]:
            with self.subTest(changes=changes):
                self.assertIsNone(parse_broadcast(page(**changes), VIDEO, "2026-10-03"))
        self.assertIsNone(parse_broadcast(page(), VIDEO, "2026-02-30"))
        self.assertIsNone(parse_broadcast("consent page", VIDEO, "2026-10-03"))

    def test_network_failure_does_not_write_or_erase_metadata(self):
        with tempfile.TemporaryDirectory() as root:
            file = Path(root) / RELATIVE_PATH
            file.parent.mkdir(parents=True)
            file.write_text('{"other-video": {}}')
            with patch("broadcasts.urlopen", side_effect=OSError("blocked")):
                self.assertFalse(record_broadcast(root, VIDEO, "2026-10-03"))
            self.assertEqual(file.read_text(), '{"other-video": {}}')


if __name__ == "__main__":
    unittest.main()
