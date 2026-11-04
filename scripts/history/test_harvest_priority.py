import unittest

from harvest import first_priority


class PriorityTests(unittest.TestCase):
    def test_bishop_and_deacon_titles_come_first(self):
        rows = [("a" * 11, "60", "The Israelites: Feed Your Fire", None, None),
                ("b" * 11, "60", "Bishop Nathanyel: The Prophets", None, None),
                ("c" * 11, "60", "IUIC | Deacon Isaac teaches", None, None),
                ("d" * 11, "60", "Captain Yahn: Know Thyself", None, None),
                ("e" * 11, "60", "Elder Nathanyel on Isaiah 1", None, None),
                ("f" * 11, "60", None, None, None)]
        self.assertEqual([r[0][0] for r in sorted(rows, key=first_priority)], list("bceadf"))

    def test_yawasap_and_kani_come_before_other_bishops(self):
        rows = [("a" * 11, "60", "Bishop Nathanyel: The Prophets", None, None),
                ("b" * 11, "60", "Bishop Yawasap | The Bible: Book of Our Fathers", None, None),
                ("c" * 11, "60", "Deacon Isaac teaches", None, None),
                ("d" * 11, "60", "BISHOP KANI - Hebrew Israelites", None, None),
                ("e" * 11, "60", "Captain Yahn: Know Thyself", None, None)]
        self.assertEqual([r[0][0] for r in sorted(rows, key=first_priority)], list("bdace"))
        self.assertEqual(first_priority(("x" * 11, "1", "Kanisha's story", None, None)), 2)

    def test_words_inside_other_words_do_not_count(self):
        self.assertEqual(first_priority(("x" * 11, "1", "Bishopric history", None, None)), 2)


if __name__ == "__main__":
    unittest.main()
