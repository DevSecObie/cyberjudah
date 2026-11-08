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
        self.assertIn("Reading 1: Genesis 1-4", files["chapter/genesis-reading-1.xml"])
        # the chapter itself comes first, all 31 verses
        self.assertIn('display_name="Read Genesis 1"', files["vertical/genesis-1-01.xml"])
        self.assertEqual(files["html/genesis-1-01.html"].count("<p><sup>"), 31)
        self.assertIn("about/overview.html", files)

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
                self.assertRegex(url, b.YOUTUBE, name)

    def test_chapter_without_note_is_still_readable(self):
        self.assertFalse(os.path.exists(os.path.join(b.ROOT, "docs", "study", "2-john", "1.md")))
        files = b.build("2-john", b.parse_chapters(None, "2-john"))
        self.assertIn('display_name="Read 2 John 1"', files["vertical/2-john-1-01.xml"])
        self.assertEqual(b.parse_chapters(None, "esther-greek")[0], 10)


if __name__ == "__main__":
    unittest.main()
