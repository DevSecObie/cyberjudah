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

    def test_tribes_by_the_fathers(self):
        doc, _ = build.build()
        by = {p['id']: p for p in doc['people']}
        judas = by['judas-maccabeus-1ma-2-4']
        self.assertEqual(judas['name'], 'Judas Maccabeus')
        self.assertIn('1-maccabees/2/66', judas['verses'])
        jehoiarib = by['jehoiarib-1ch-24-7']
        self.assertEqual([e['id'] for e in jehoiarib['line']], ['aaron-exo-4-14'])
        # Judas is of Levi through Mattathias, the sons of Joarib (Jehoiarib) and Aaron; the Joarib
        # identification is history, so the whole chain is.
        t = judas['tribe'][0]
        self.assertEqual((t['id'], t['evidence'], t['inherited']), ('levi-gen-29-34', 'history', True))
        self.assertEqual(t['note'], 'By his fathers: Mattathias, Jehoiarib, Aaron')
        self.assertTrue(t['sources'])
        self.assertTrue({'1-maccabees/2/1', '1-chronicles/24/1', '1-chronicles/24/7'} <= set(t['verses']))
        # A tribe the verse states is not inherited; one son of Jacob is never given a tribe.
        self.assertEqual(by['mordecai-est-2-5']['tribe'][0]['id'], 'benjamin-gen-35-18')
        self.assertNotIn('inherited', by['mordecai-est-2-5']['tribe'][0])
        self.assertNotIn('tribe', by['levi-gen-29-34'])
        self.assertEqual(by['jahaziel-2ch-20-14']['tribe'][0]['id'], 'levi-gen-29-34')

    def test_names_the_index_misses(self):
        doc, _ = build.build()
        by = {p['id']: p for p in doc['people']}
        for pid in ('on-num-16-1', 'so-2ki-17-4', 'ox-jdt-8-1', 'i-chabod-1sa-4-21', 'eubulus-2ti-4-21', 'areus-1ma-12-20', 'shamed-1ch-8-12', 'ephod-num-34-23'):
            self.assertIn(pid, by)
        self.assertEqual(by['on-num-16-1']['father'][0]['id'], 'peleth-num-16-1')
        self.assertEqual(by['on-num-16-1']['tribe'][0]['id'], 'reuben-gen-29-32')

    def test_tribes_by_list_and_by_sons(self):
        doc, _ = build.build()
        by = {p['id']: p for p in doc['people']}
        tribe = lambda pid: by[pid]['tribe'][0]
        self.assertEqual(tribe('jabez-1ch-4-9')['id'], 'judah-gen-29-35')  # under "The sons of Judah" (4:1)
        self.assertIn('1-chronicles/4/1', tribe('jabez-1ch-4-9')['verses'])
        self.assertEqual(tribe('zurishaddai-num-1-6')['id'], 'simeon-gen-29-33')
        self.assertEqual(tribe('zurishaddai-num-1-6')['note'], 'By his son Shelumiel')
        self.assertEqual(tribe('eli-1sa-1-3')['id'], 'levi-gen-29-34')
        self.assertEqual(tribe('hophni-1sa-1-3')['id'], 'levi-gen-29-34')
        self.assertNotIn('tribe', by['judah-gen-29-35'])

    def test_wives_and_described_people(self):
        doc, _ = build.build()
        by = {p['id']: p for p in doc['people']}
        wives = {e['id'] for e in by['david-rut-4-17']['partners']}
        self.assertTrue({'maacah-2sa-3-3', 'haggith-2sa-3-4', 'abital-2sa-3-4'} <= wives)
        self.assertNotIn('tamar-gen-38-6', {e['id'] for e in by['judah-gen-29-35']['partners']})
        wife = by["lot-s-wife-gen-19-15"]
        self.assertTrue(wife['described'])
        self.assertIn('luke/17/32', wife['verses'])
        self.assertEqual(by['moab-gen-19-37']['mother'][0]['id'], "lot-s-firstborn-daughter-gen-19-15")
        self.assertEqual(by['phinehas-exo-6-25']['mother'][0]['id'], "putiel-s-daughter-exo-6-25")

    def test_phrase_places(self):
        doc, _ = build.build()
        places = {p['id']: p for p in doc['places']}
        red = places['red-sea-exo-10-19']
        self.assertEqual(len(red['verses']), 32)
        self.assertIn('1-maccabees/4/9', red['verses'])
        salt = places['salt-sea-gen-14-3']
        self.assertIn('2-kings/14/25', salt['verses'])  # "the sea of the plain", the salt sea (Deuteronomy 3:17)
        self.assertNotIn('daniel/7/2', places['great-sea-num-34-6']['verses'])  # the great sea of the vision
        self.assertEqual(places['tiberias-jhn-6-23']['verses'], ['john/6/23'])
        self.assertIn('john/21/1', places['sea-of-galilee-mat-4-18']['verses'])


if __name__ == '__main__':
    unittest.main()
