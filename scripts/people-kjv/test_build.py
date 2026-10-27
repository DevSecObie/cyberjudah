import os, sys, unittest
sys.path.insert(0, os.path.dirname(__file__))
import build
from names import ROOT


class Build(unittest.TestCase):
    def test_each_book_builds_clean_and_is_up_to_date(self):
        for f in sorted(os.listdir(f'{ROOT}/people-kjv/sources')):
            if not f.endswith('.names.txt'): continue
            book = f[:-len('.names.txt')]
            with self.subTest(book=book):
                doc, errs, _ = build.build(book)
                self.assertEqual(errs, [])
                with open(f'{ROOT}/people-kjv/{book}.json') as fh:
                    self.assertEqual(fh.read(), build.dump(doc), f'run scripts/people-kjv/build.py {book}')


if __name__ == '__main__':
    unittest.main()
