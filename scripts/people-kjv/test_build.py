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
        with open(build.PLACES_OUT, encoding='utf-8') as fh:
            self.assertEqual(fh.read(), build.dump(doc, 'places'), 'run scripts/people-kjv/build.py')

    def test_gods_are_not_people(self):
        doc, _ = build.build()
        people = {p['id'] for p in doc['people']}
        other = {o['id'] for o in doc['other']}
        for god in ('molech-lev-18-21', 'chemosh-num-21-29', 'baal-num-22-41', 'ashtaroth-jdg-2-13',
                    'dagon-jdg-16-23', 'ashtoreth-1ki-11-5', 'milcom-1ki-11-5', 'nisroch-2ki-19-37'):
            self.assertIn(god, other)
            self.assertNotIn(god, people)
        for o in doc['other']:
            self.assertNotIn(o['id'], people)
            self.assertIn(o['kind'], build.OTHER.values())

    def test_pins_link_to_wikidata(self):
        doc, _ = build.build()
        for p in doc['places']:
            if 'pin' not in p: continue
            pin = p['pin']
            self.assertEqual(pin['url'], 'https://www.wikidata.org/wiki/' + pin['wikidata'])
            self.assertTrue(-90 <= pin['lat'] <= 90 and -180 <= pin['lon'] <= 180, p['id'])


if __name__ == '__main__':
    unittest.main()
