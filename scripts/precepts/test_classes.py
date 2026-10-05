import copy
import json
import os
import tempfile
import unittest
from unittest.mock import patch

import classes


class PassValidation(unittest.TestCase):
    def setUp(self):
        self.pass_ = {"video": "CMSPRECEPT1", "title": "Validation fixture", "date": "2024-02-29", "passages": [{"opened": "Genesis 1:1-3", "ts": "1:00", "sense": [{"at": "1", "text": "Fixture explanation"}], "precepts": [{"ref": "John 1:1", "at": "1", "why": "Fixture explanation", "ts": "1:23"}]}]}

    def errors(self, value):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, value["video"] + ".json")
            with open(path, "w") as out:
                json.dump(value, out)
            with patch.object(classes.os.path, "exists", return_value=True):
                return classes.check(path)

    def test_individual_timestamp_and_passage_fallback(self):
        self.assertEqual(self.errors(self.pass_), [])
        del self.pass_["passages"][0]["precepts"][0]["ts"]
        self.assertEqual(self.errors(self.pass_), [])

    def test_invalid_timestamps_dates_and_passage_order(self):
        for ts in ["1:60", "1:99:00", "", "tomorrow"]:
            value = copy.deepcopy(self.pass_)
            value["passages"][0]["precepts"][0]["ts"] = ts
            self.assertTrue(any("ts must" in e for e in self.errors(value)))
        self.pass_["date"] = "2025-02-29"
        self.assertTrue(any("calendar date" in e for e in self.errors(self.pass_)))
        self.pass_["passages"].append({"opened": "Genesis 2:1", "ts": "0:59", "precepts": []})
        self.assertTrue(any("back in time" in e for e in self.errors(self.pass_)))

    def test_bad_reference_at_and_invented_quote_still_fail(self):
        pre = self.pass_["passages"][0]["precepts"][0]
        pre["ref"] = "John 1:999"
        self.assertTrue(any("not a real" in e for e in self.errors(self.pass_)))
        pre["ref"] = "John 1:1"
        pre["at"] = "4"
        pre["why"] = "“This is not a verse in the Bible”"
        errors = self.errors(self.pass_)
        self.assertTrue(any("not a verse" in e for e in errors))
        self.assertTrue(any("quote not word for word" in e for e in errors))
