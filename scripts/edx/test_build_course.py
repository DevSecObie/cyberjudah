import glob, json, os, re, sys, unittest, xml.dom.minidom

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_course as b


class BuildCourse(unittest.TestCase):
    def test_genesis_1_is_well_formed(self):
        files = b.build("genesis", [1])
        for name, text in files.items():
            if name.endswith(".xml"):
                xml.dom.minidom.parseString(text)
            elif name.endswith(".html"):
                xml.dom.minidom.parseString(f"<div>{text}</div>")
        self.assertIn("sequential/genesis-1.xml", files)
        self.assertIn('display_name="Genesis 1-4"', files["chapter/genesis-reading-1.xml"])
        # every reading opens with "About this reading"
        self.assertIn('url_name="genesis-reading-1-about"', files["chapter/genesis-reading-1.xml"].splitlines()[1])
        # every chapter: Overview, the chapter (all 31 verses), the passages, then the quiz last
        self.assertIn('display_name="Overview"', files["vertical/genesis-1-01.xml"])
        self.assertIn('display_name="Read Genesis 1"', files["vertical/genesis-1-02.xml"])
        self.assertEqual(files["html/genesis-1-02.html"].count("<p><sup>"), 31)
        seq = files["sequential/genesis-1.xml"]
        self.assertIn('format="Quiz"', seq)
        self.assertIn('url_name="genesis-1-quiz"', seq.splitlines()[-2])
        self.assertNotIn("<h4>Introduction</h4>", "".join(v for k, v in files.items() if k.endswith(".html")))
        self.assertIn("about/overview.html", files)

    def test_genesis_is_a_full_course(self):
        files = b.build("genesis", b.parse_chapters(None, "genesis"))
        # objectives and time on every Overview, key takeaways before every quiz
        self.assertIn("What you will learn", files["html/genesis-1-01.html"])
        self.assertIn("About ", files["html/genesis-1-01.html"])
        seq = files["sequential/genesis-1.xml"].splitlines()
        takeaways = [v for v in seq if "url_name" in v][-2].split('"')[1]
        self.assertIn('display_name="Key takeaways"', files[f"vertical/{takeaways}.xml"])
        # a final, graded as Final Exam, one question per chapter, one try each
        self.assertIn('format="Final Exam"', files["sequential/final-exam.xml"])
        self.assertEqual(sum(1 for k in files if k.startswith("problem/final-")), 50)
        self.assertIn('max_attempts="1"', files["problem/final-1-01.xml"])
        grading = json.loads(files["policies/2026/grading_policy.json"])
        self.assertEqual(sum(g["weight"] for g in grading["GRADER"]), 1.0)
        # the People page is in the course menu
        policy = json.loads(files["policies/2026/policy.json"])["course/2026"]
        self.assertIn("people", [t.get("url_slug") for t in policy["tabs"]])
        self.assertIn("Abraham", files["tabs/people.html"])

    def test_every_lesson_plan_parses(self):
        for path in glob.glob(os.path.join(b.LESSONS, "*", "*.json")):
            plan = json.load(open(path, encoding="utf-8"))
            self.assertTrue(plan["objectives"] and plan["takeaways"], path)

    def test_every_quiz_parses(self):
        for path in glob.glob(os.path.join(b.QUIZZES, "*", "*.json")):
            quiz = json.load(open(path, encoding="utf-8"))
            for q in quiz["questions"]:
                self.assertLess(q["answer"], len(q["choices"]), path)
                xml.dom.minidom.parseString(b.problem_xml(q, 1))

    def test_markdown_subset(self):
        out = b.render(["- one", "  > <sup>[1](/bible/genesis/1#v1)</sup> verse", "- **two**"])
        self.assertNotIn("<a ", out)
        self.assertIn("<sup>1</sup> verse", out)
        self.assertIn("<strong>two</strong>", out)
        self.assertEqual(out.count("<li>"), 2)

    def test_only_youtube_links_leave_the_course(self):
        self.assertIn('href="https://www.youtube.com/watch?v=x"', b.inline("[class](https://www.youtube.com/watch?v=x)"))
        self.assertIn('href="https://youtu.be/x"', b.inline("[class](https://youtu.be/x)"))
        self.assertEqual(b.inline("[Genesis 1](/bible/genesis/1)"), "Genesis 1")
        self.assertEqual(b.inline("[x](https://example.com)"), "x")
        files = b.build("genesis", [1])
        for name, text in files.items():
            if isinstance(text, bytes):  # the course card image
                continue
            for url in re.findall(r'href="([^"]+)"', text):
                if not url.startswith("/static/"):  # the course's own stylesheet
                    self.assertRegex(url, b.YOUTUBE, name)

    def test_chapter_without_note_is_still_readable(self):
        self.assertFalse(os.path.exists(os.path.join(b.ROOT, "docs", "study", "2-john", "1.md")))
        files = b.build("2-john", b.parse_chapters(None, "2-john"))
        self.assertIn('display_name="Read 2 John 1"', files["vertical/2-john-1-02.xml"])
        self.assertEqual(b.parse_chapters(None, "esther-greek")[0], 10)


if __name__ == "__main__":
    unittest.main()
