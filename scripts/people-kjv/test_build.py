import os, sys, unittest
sys.path.insert(0, os.path.dirname(__file__))
import build


class Build(unittest.TestCase):
    def test_builds_clean_and_is_up_to_date(self):
        doc, errs = build.build()
        self.assertEqual(errs, [])
        with open(build.OUT, encoding='utf-8') as fh:
            self.assertEqual(fh.read(), build.dump(doc), 'run scripts/people-kjv/build.py')
        with open(build.OTHER_OUT, encoding='utf-8') as fh:
            self.assertEqual(fh.read(), build.dump(doc, 'other'), 'run scripts/people-kjv/build.py')

    def test_gods_are_not_people(self):
        doc, _ = build.build()
        people = {p['id'] for p in doc['people']}
        for o in doc['other']:
            self.assertNotIn(o['id'], people)
            self.assertIn(o['kind'], build.OTHER.values())


if __name__ == '__main__':
    unittest.main()
