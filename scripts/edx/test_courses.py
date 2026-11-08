"""Every course the builders make imports cleanly: run with
python3 -m unittest discover -s scripts/edx -p 'test_*.py'"""
import os, sys, unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import olx, build_all, build_series, build_cases, build_topics  # noqa: E402


class Courses(unittest.TestCase):
    def test_every_course_is_sound(self):
        keys = set()
        for kind, make in build_all.KINDS.items():
            for key, title, rel, files in make():
                with self.subTest(course=key):
                    self.assertNotIn(key, keys)
                    keys.add(key)
                    self.assertEqual(olx.check(files), [])
                    self.assertIn("course.xml", files)
        self.assertGreaterEqual(len(keys), 100)

    def test_clips_play_one_part_of_the_class(self):
        body = ("<div class=\"class-video-mount\" data-video-id=\"abc\"></div>\n\n## Introduction\n\n"
                "*[[0:10](https://www.youtube.com/watch?v=abc&t=10s)]* Shalom.\n\n## Scriptures Opened\n\n"
                "**[Genesis 1:1](/bible/genesis/1#v1)**  *[[1:05](https://www.youtube.com/watch?v=abc&t=65s)]*\n\n"
                "- In the beginning.\n\n## Announcements & References\n\n- [a site](https://example.com)\n\n"
                "## In Closing\n\n*[[2:00](https://www.youtube.com/watch?v=abc&t=120s)]* Shalom.\n")
        meta = {"title": "T", "date": "2026-01-01", "video": "abc", "path": "x/2026-01-01-t.md"}
        course = olx.Course("T", "T")
        sub = build_series.add_class(course.section("2026"), meta, body)
        self.assertEqual([u.title for u in sub.units], ["Watch the class", "Introduction", "Genesis 1:1", "In Closing"])
        self.assertEqual(sub.units[2].video, ("abc", 65, 120))
        self.assertEqual(sub.units[3].video, ("abc", 120, None))
        xml = course.files()[f"video/{sub.units[2].uid}-v.xml"]
        self.assertIn('start_time="00:01:05" end_time="00:02:00"', xml)
        self.assertNotIn("example.com", "".join(v for v in course.files().values() if isinstance(v, str)))

    def test_case_verdict_has_the_recorded_answer(self):
        c = build_cases.build()
        probs = [v for k, v in c.files().items() if k.startswith("problem/case-c001")]
        self.assertEqual(len(probs), 1)
        self.assertIn('<choice correct="true">Curse:', probs[0])
        self.assertEqual(probs[0].count('correct="true"'), 1)

    def test_scripture_lookup(self):
        self.assertEqual(build_topics.verses("Genesis", 1, "1")[0][1][:23], "In the beginning God cr")
        self.assertEqual(len(build_topics.verses("Genesis", 2, "7-9")), 3)


if __name__ == "__main__":
    unittest.main()
