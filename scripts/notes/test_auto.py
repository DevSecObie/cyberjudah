#!/usr/bin/env python3
"""Regression tests for the --plan queue filtering in scripts/notes/auto.py.

A class whose note path is already a changed file in an open pull request, or whose video id
is on the local HOLD list, leaves the queue with a printed reason; a failure to list GitHub
(no binary, no auth, a timeout, bad output) prints one warning line and changes nothing.
Every fixture below is synthetic: the video ids, dates and titles are made up for the test and
describe no real class. No test runs a real `gh`: subprocess.run is replaced in each case.

    python3 -m unittest discover -s scripts/notes -p 'test_*.py'
"""
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import auto  # noqa: E402

NOTE_ONE = "blog/2026/2026-01-03-2026-01-03-test-class-one.md"
GH_OUT = json.dumps([
    {"number": 41, "files": [{"path": NOTE_ONE}, {"path": "data/precepts/classes/TESTVIDEO09.json"}]},
    {"number": 7, "files": []},
    {"number": 58, "files": [{"path": NOTE_ONE}]},  # a later PR touching the same path never wins
])


def completed(stdout="", stderr="", code=0):
    return subprocess.CompletedProcess(args=["gh"], returncode=code, stdout=stdout, stderr=stderr)


def run_capturing(fn, *args):
    out = io.StringIO()
    with redirect_stdout(out):
        result = fn(*args)
    return result, out.getvalue()


def warning_lines(text):
    return [l for l in text.splitlines() if l.startswith("warning: could not list open PRs")]


class OpenPrNotePaths(unittest.TestCase):
    def test_maps_each_changed_file_to_the_first_open_pr_that_carries_it(self):
        with mock.patch.object(auto.subprocess, "run", return_value=completed(GH_OUT)) as run:
            paths, printed = run_capturing(auto.open_pr_note_paths)
        self.assertEqual(paths, {NOTE_ONE: 41, "data/precepts/classes/TESTVIDEO09.json": 41})
        self.assertEqual(printed, "")
        run.assert_called_once()
        argv = run.call_args.args[0]
        self.assertEqual(argv[:3], ["gh", "pr", "list"], "only ever a read-only listing")
        self.assertIn("--state", argv)
        self.assertFalse(run.call_args.kwargs.get("shell"), "a fixed argv, never a shell string")
        self.assertIsNotNone(run.call_args.kwargs.get("timeout"), "a hung gh must not hang --plan")

    def test_nonzero_exit_warns_once_and_returns_none(self):
        stderr = "gh: To use GitHub CLI in a GitHub Actions workflow, set the GH_TOKEN environment variable."
        with mock.patch.object(auto.subprocess, "run", return_value=completed("", stderr, code=4)):
            paths, printed = run_capturing(auto.open_pr_note_paths)
        self.assertIsNone(paths)
        self.assertEqual(len(warning_lines(printed)), 1)
        self.assertEqual(len(printed.splitlines()), 1)

    def test_missing_binary_warns_once_and_returns_none(self):
        with mock.patch.object(auto.subprocess, "run", side_effect=FileNotFoundError(2, "No such file", "gh")):
            paths, printed = run_capturing(auto.open_pr_note_paths)
        self.assertIsNone(paths)
        self.assertEqual(len(warning_lines(printed)), 1)

    def test_timeout_warns_once_and_returns_none(self):
        with mock.patch.object(auto.subprocess, "run", side_effect=subprocess.TimeoutExpired(["gh"], 30)):
            paths, printed = run_capturing(auto.open_pr_note_paths)
        self.assertIsNone(paths)
        self.assertEqual(len(warning_lines(printed)), 1)

    def test_unparseable_output_warns_once_and_returns_none(self):
        with mock.patch.object(auto.subprocess, "run", return_value=completed("not json {")):
            paths, printed = run_capturing(auto.open_pr_note_paths)
        self.assertIsNone(paths)
        self.assertEqual(len(warning_lines(printed)), 1)


class Queue(unittest.TestCase):
    """Three synthetic transcripts under a temporary ROOT; no note on disk, so all three queue by default."""

    CLASSES = [
        ("TESTVIDEO01", "2026-01-03", "2026/2026-01-03-test-class-one", "Test class one (synthetic fixture)", 3),
        ("TESTVIDEO02", "2026-01-02", "2026/2026-01-02-test-class-two", "Test class two (synthetic fixture)", 2),
        ("TESTVIDEO03", "2026-01-01", "2026/2026-01-01-test-class-three", "Test class three (synthetic fixture)", 1),
    ]

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = self.tmp.name
        os.makedirs(os.path.join(root, "blog", "transcripts"))
        for vid, date, slug, title, views in self.CLASSES:
            t = {"videoId": vid, "feed": "classes", "date": date, "slug": slug, "title": title,
                 "words": auto.MIN_WORDS + 100, "views": views, "segments": []}
            with open(os.path.join(root, "blog", "transcripts", f"{vid}.json"), "w", encoding="utf-8") as f:
                json.dump(t, f)
        self.patches = [mock.patch.object(auto, "ROOT", root), mock.patch.object(auto, "HOLD", {})]
        for p in self.patches:
            p.start()
        self.addCleanup(self.tmp.cleanup)
        for p in self.patches:
            self.addCleanup(p.stop)

    @staticmethod
    def ids(rows):
        return [t["videoId"] for t in rows]

    def test_note_path_matches_what_the_script_files(self):
        t = json.load(open(os.path.join(auto.ROOT, "blog", "transcripts", "TESTVIDEO01.json"), encoding="utf-8"))
        self.assertEqual(os.path.relpath(auto.note_path(t, "classes"), auto.ROOT), NOTE_ONE)

    def test_a_class_whose_note_is_in_an_open_pr_is_skipped_with_its_reason(self):
        with mock.patch.object(auto, "open_pr_note_paths", return_value={NOTE_ONE: 41}) as lookup:
            rows, printed = run_capturing(auto.queue, "classes")
        self.assertEqual(self.ids(rows), ["TESTVIDEO02", "TESTVIDEO03"])
        self.assertEqual(printed.splitlines(), ["skipped TESTVIDEO01 — note in open PR #41"])
        lookup.assert_called_once()

    def test_the_hold_list_skips_even_when_github_could_not_be_listed(self):
        with mock.patch.object(auto, "HOLD", {"TESTVIDEO02": 56}), \
                mock.patch.object(auto, "open_pr_note_paths", return_value=None):
            rows, printed = run_capturing(auto.queue, "classes")
        self.assertEqual(self.ids(rows), ["TESTVIDEO01", "TESTVIDEO03"])
        self.assertEqual(printed.splitlines(), ["skipped TESTVIDEO02 — note in open PR #56"])

    def test_a_github_failure_leaves_the_queue_as_before(self):
        with mock.patch.object(auto, "open_pr_note_paths", return_value=None):
            rows, printed = run_capturing(auto.queue, "classes")
        self.assertEqual(self.ids(rows), ["TESTVIDEO01", "TESTVIDEO02", "TESTVIDEO03"])
        self.assertEqual(printed, "")

    def test_an_open_pr_touching_other_files_skips_nothing(self):
        with mock.patch.object(auto, "open_pr_note_paths", return_value={"scripts/notes/auto.py": 58}):
            rows, printed = run_capturing(auto.queue, "classes")
        self.assertEqual(self.ids(rows), ["TESTVIDEO01", "TESTVIDEO02", "TESTVIDEO03"])
        self.assertEqual(printed, "")


if __name__ == "__main__":
    unittest.main()
