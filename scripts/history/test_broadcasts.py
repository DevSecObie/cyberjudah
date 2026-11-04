import json
import tempfile
import unittest
import subprocess
from pathlib import Path
from unittest.mock import patch
from collections import Counter
import broadcasts
from broadcasts import RELATIVE_PATH, backfill, lookup, parse_broadcast, record_broadcast

VIDEO = "pZs5reAzxi4"


def page(**changes):
    live = {"isLiveNow": False, "startTimestamp": "2026-10-03T17:56:00-04:00", "endTimestamp": "2026-10-04T01:46:53Z", **changes}
    return json.dumps({"playerMicroformatRenderer": {"externalVideoId": VIDEO, "publishDate": "2026-10-04T02:38:19Z", "liveBroadcastDetails": live}})


class BroadcastTests(unittest.TestCase):
    def setUp(self):
        broadcasts._refused_in_a_row = 0

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
            with patch("broadcasts.subprocess.run", side_effect=OSError("blocked")):
                self.assertFalse(record_broadcast(root, VIDEO, "2026-10-03"))
            self.assertEqual(file.read_text(), '{"other-video": {}}')

    def test_successful_fetch_is_saved_and_reused(self):
        with tempfile.TemporaryDirectory() as root:
            response = subprocess.CompletedProcess([], 0, page(), '')
            with patch("broadcasts.subprocess.run", return_value=response) as fetch:
                self.assertTrue(record_broadcast(root, VIDEO, "2026-10-03"))
                self.assertFalse(record_broadcast(root, VIDEO, "2026-10-03"))
                fetch.assert_called_once()
            self.assertEqual(json.loads((Path(root) / RELATIVE_PATH).read_text())[VIDEO]["broadcastAt"], "2026-10-03T21:56:00Z")

    def test_backfill_tries_dated_classes_without_a_start_newest_first(self):
        with tempfile.TemporaryDirectory() as root:
            tdir = Path(root) / "transcripts"
            tdir.mkdir()
            (Path(root) / RELATIVE_PATH).parent.mkdir(parents=True)
            (Path(root) / RELATIVE_PATH).write_text(json.dumps({"recordedAlr": {"date": "2026-10-03", "broadcastAt": "2026-10-03T12:00:00Z"}}))
            for video, day in [(VIDEO, "2026-10-03"), ("recordedAlr", "2026-10-03"), ("undatedVid1", None), ("tooOldVid01", "2026-01-01"), ("newerVid001", "2026-10-04")]:
                (tdir / f"{video}.json").write_text(json.dumps({"videoId": video, "date": day}))
            response = subprocess.CompletedProcess([], 0, page(), '')
            with patch("broadcasts.subprocess.run", return_value=response) as fetch:
                self.assertEqual(backfill(root, tdir, "2026-09-01", tries=2), [VIDEO])
                self.assertEqual([c[0][0][-1][-11:] for c in fetch.call_args_list if c[0][0][0] == "curl"], ["newerVid001", VIDEO])
            self.assertIn(VIDEO, json.loads((Path(root) / RELATIVE_PATH).read_text()))

    def test_blocked_page_is_reported_with_its_reason(self):
        with tempfile.TemporaryDirectory() as root:
            refused = subprocess.CompletedProcess([], 22, "", "curl: (22) The requested URL returned error: 429\n")
            ytdlp = subprocess.CompletedProcess([], 1, "", "ERROR: Sign in to confirm you're not a bot\n")
            reasons = Counter()
            with patch("broadcasts.subprocess.run", side_effect=[refused, ytdlp]), patch("builtins.print") as said:
                self.assertFalse(record_broadcast(root, VIDEO, "2026-10-03", reasons))
            line = said.call_args[0][0]
            self.assertIn("error: 429", line)
            self.assertIn("not a bot", line)
            self.assertEqual(sum(reasons.values()), 1)
            self.assertFalse((Path(root) / RELATIVE_PATH).exists())

    def test_a_run_stops_asking_after_repeated_refusals(self):
        refused = subprocess.CompletedProcess([], 22, "", "curl: (22) The requested URL returned error: 429\n")
        with patch("broadcasts.subprocess.run", return_value=refused) as fetch:
            for _ in range(broadcasts.REFUSED_LIMIT + 3):
                row, reason = lookup(VIDEO, "2026-10-03")
        self.assertEqual(fetch.call_count, broadcasts.REFUSED_LIMIT * 2)
        self.assertIn("not tried", reason)

    def test_bot_check_page_is_named(self):
        bot = subprocess.CompletedProcess([], 0, "<html>Sign in to confirm you're not a bot</html>", "")
        ytdlp = subprocess.CompletedProcess([], 1, "", "ERROR: blocked\n")
        with patch("broadcasts.subprocess.run", side_effect=[bot, ytdlp]):
            row, reason = lookup(VIDEO, "2026-10-03")
        self.assertIsNone(row)
        self.assertIn("sign-in or consent check", reason)

    def test_ytdlp_fills_in_when_the_page_has_no_broadcast_details(self):
        bare = json.dumps({"playerMicroformatRenderer": {"externalVideoId": VIDEO}})
        responses = [subprocess.CompletedProcess([], 0, bare, ""),
                     subprocess.CompletedProcess([], 0, f"{VIDEO} was_live 1791064560\n", "")]
        with patch("broadcasts.subprocess.run", side_effect=responses) as fetch:
            self.assertEqual(lookup(VIDEO, "2026-10-03"), ({"date": "2026-10-03", "broadcastAt": "2026-10-03T21:56:00Z"}, None))
        self.assertEqual(fetch.call_args_list[1][0][0][0], "yt-dlp")

    def test_ytdlp_never_records_an_upload_that_was_not_live(self):
        bare = json.dumps({"playerMicroformatRenderer": {"externalVideoId": VIDEO}})
        responses = [subprocess.CompletedProcess([], 0, bare, ""),
                     subprocess.CompletedProcess([], 0, f"{VIDEO} not_live 1791064560\n", "")]
        with patch("broadcasts.subprocess.run", side_effect=responses):
            self.assertEqual(lookup(VIDEO, "2026-10-03")[0], None)

    def test_ytdlp_start_far_from_the_class_date_is_refused(self):
        bare = json.dumps({"playerMicroformatRenderer": {"externalVideoId": VIDEO}})
        responses = [subprocess.CompletedProcess([], 0, bare, ""),
                     subprocess.CompletedProcess([], 0, f"{VIDEO} was_live 1791064560\n", "")]
        with patch("broadcasts.subprocess.run", side_effect=responses):
            row, reason = lookup(VIDEO, "2026-09-03")
        self.assertIsNone(row)
        self.assertIn("not the class's date", reason)

    def test_a_page_that_says_not_live_skips_ytdlp(self):
        upload = json.dumps({"playerMicroformatRenderer": {"externalVideoId": VIDEO}, "videoDetails": {"isLiveContent": False}})
        with patch("broadcasts.subprocess.run", return_value=subprocess.CompletedProcess([], 0, upload, "")) as fetch:
            self.assertEqual(lookup(VIDEO, "2026-10-03"), (None, "not a livestream"))
        fetch.assert_called_once()


if __name__ == "__main__":
    unittest.main()
