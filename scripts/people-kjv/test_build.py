import os, sys, unittest
sys.path.insert(0, os.path.dirname(__file__))
import build


class Build(unittest.TestCase):
    def test_builds_clean_and_is_up_to_date(self):
        doc, errs = build.build()
        self.assertEqual(errs, [])
        with open(build.OUT, encoding='utf-8') as fh:
            self.assertEqual(fh.read(), build.dump(doc), 'run scripts/people-kjv/build.py')


if __name__ == '__main__':
    unittest.main()
