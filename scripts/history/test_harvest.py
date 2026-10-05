import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harvest


class ParseDate(unittest.TestCase):
    """parse_date fed the channel listing's date field.

    A 2026-09-14 edit (harvest: retry no-caption videos while their captions may still
    land) landed append_once/nocaption_skips in the middle of this function's body,
    splitting it so it always returned None for any truthy value -- its real body ended
    up as dead code after nocaption_skips' own return. That is what made the listing
    look like it never carried a date.
    """

    def test_empty_values_return_none(self):
        self.assertIsNone(harvest.parse_date(None))
        self.assertIsNone(harvest.parse_date(""))

    def test_iso_date_is_kept(self):
        self.assertEqual(harvest.parse_date("2026-09-14"), "2026-09-14")

    def test_iso_datetime_with_zulu_suffix_is_reduced_to_a_date(self):
        self.assertEqual(harvest.parse_date("2026-09-14T18:30:00Z"), "2026-09-14")

    def test_unparseable_value_returns_none_not_a_crash(self):
        self.assertIsNone(harvest.parse_date("not a date"))


class ParsePublishDate(unittest.TestCase):
    """parse_publish_date reads /youtube/video/metadata's publishDate, which the docs
    say is ISO but which comes back as a human string for premieres and streams."""

    def test_empty_values_return_none(self):
        self.assertIsNone(harvest.parse_publish_date(None))
        self.assertIsNone(harvest.parse_publish_date(""))

    def test_documented_iso_form(self):
        self.assertEqual(harvest.parse_publish_date("2009-10-25"), "2009-10-25")

    def test_premiered_prefix(self):
        self.assertEqual(harvest.parse_publish_date("Premiered Nov 15, 2019"), "2019-11-15")

    def test_streamed_live_on_prefix(self):
        self.assertEqual(harvest.parse_publish_date("Streamed live on Nov 15, 2019"), "2019-11-15")

    def test_plain_month_day_year_with_no_prefix(self):
        self.assertEqual(harvest.parse_publish_date("Nov 15, 2019"), "2019-11-15")

    def test_full_month_name(self):
        self.assertEqual(harvest.parse_publish_date("November 15, 2019"), "2019-11-15")

    def test_unrecognised_shape_returns_none_never_empty_string(self):
        result = harvest.parse_publish_date("sometime last year")
        self.assertIsNone(result)
        self.assertNotEqual(result, "")


class VideoPublishDate(unittest.TestCase):
    """The fallback the harvester now takes when the channel listing has no date:
    ask /youtube/video/metadata for the video's own publish date."""

    def test_extracts_date_from_the_metadata_endpoint(self):
        payload = {"content": {"videoId": "abc12345678", "publishDate": "Premiered Nov 15, 2019"}}
        with patch.object(harvest, "api_get", return_value=(200, payload, None)) as api_get:
            self.assertEqual(harvest.video_publish_date("abc12345678"), "2019-11-15")
        api_get.assert_called_once_with(
            "/youtube/video/metadata", {"video_url": "abc12345678"}, timeout=20, retries=2
        )

    def test_non_200_never_raises_and_returns_none(self):
        with patch.object(harvest, "api_get", return_value=(404, {"detail": "not found"}, None)):
            self.assertIsNone(harvest.video_publish_date("abc12345678"))

    def test_metadata_with_no_publish_date_returns_none(self):
        with patch.object(harvest, "api_get", return_value=(200, {"content": {}}, None)):
            self.assertIsNone(harvest.video_publish_date("abc12345678"))


if __name__ == "__main__":
    unittest.main()
