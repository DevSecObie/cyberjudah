#!/usr/bin/env python3
"""Tests for scripts/notes/class_order.py. The note below is synthetic.

    python3 -m unittest discover -s scripts/notes -p 'test_*.py'
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
import class_order  # noqa: E402

V = "https://www.youtube.com/watch?v=AAAAAAAAAAA&t="
NOTE = f"""---
title: "A CLASS"
---

<p class="taught">IUIC in the ClassRoom · 2026-01-01</p>

## Introduction

*[[1:00]({V}60s)]* What the class is about.

## In The News

- *[[5:00]({V}300s)]* **A clip** — the point it made.
- **A clip with no moment** — its point.

## Scriptures Opened

**[Genesis 1:1](/bible/genesis/1#v1)**  *[[2:00]({V}120s)]*

- A point.

**[Genesis 1:3](/bible/genesis/1#v3)**  *[[9:00]({V}540s)]*

- Another point.

**[Genesis 1:2](/bible/genesis/1#v2)**  *[[7:00]({V}420s)]*

- A third.

## In Closing

*[[10:00]({V}600s)]* The charge.

---

[Class Notes Index](/classes)
"""


class ClassOrder(unittest.TestCase):
    def test_puts_news_and_passages_in_the_order_of_the_class(self):
        out = class_order.reorder(NOTE)
        order = [out.index(x) for x in ("Genesis 1:1]", "In The News: A clip", "Genesis 1:2]", "Genesis 1:3]")]
        self.assertEqual(order, sorted(order))
        self.assertIn(f"*[[5:00]({V}300s)]* **In The News: A clip** — the point it made.", out)
        # the item with no moment stays in its section
        self.assertIn("## In The News\n\n- **A clip with no moment** — its point.", out)
        self.assertTrue(out.rstrip().endswith("[Class Notes Index](/classes)"))

    def test_leaves_a_note_already_in_order(self):
        once = class_order.reorder(NOTE)
        self.assertEqual(class_order.reorder(once), once)

    def test_removes_the_section_when_everything_moved(self):
        note = NOTE.replace("- **A clip with no moment** — its point.\n", "")
        self.assertNotIn("## In The News", class_order.reorder(note))


if __name__ == "__main__":
    unittest.main()
