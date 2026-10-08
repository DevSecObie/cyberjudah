import unittest
import io
import json
import hashlib
import tempfile
from pathlib import Path
from unittest.mock import patch
import recordings
from recordings import timing_errors, source_errors, chapter_payload, audit_difference, scripture_window, alignment_hints

class Timings(unittest.TestCase):
    def test_chapter_check_must_match_its_flags(self):
        self.assertTrue(timing_errors({'verses': [[1, 0, 2]], 'check': True}, ['The word']))
        self.assertTrue(timing_errors({'verses': [[1, 0, 2]], 'checks': [{'verse': 1, 'check': True, 'reasons': ['x']}]}, ['The word']))

    def test_aligner_noise_keeps_hints_without_a_review_flag(self):
        record = {'readerId': 'reader', 'slug': 'genesis', 'reader': 'Reader', 'id': 'source/file.mp3'}
        segment = {'text': 'In the beginning', 'start': 0., 'end': 1.2,
                   'words': [{'start': 0., 'end': 0., 'probability': .1}, {'start': 0., 'end': 1.2, 'probability': .9}]}
        payload = chapter_payload(record, 1, [segment], [{'word': 'In the beginning', 'start': 0, 'end': 1.2}], ['In the beginning'])
        self.assertNotIn('check', payload)
        self.assertEqual(payload['hints'], [{'verse': 1, 'reasons': alignment_hints(segment)}])

    def test_impossible_speaking_speed_fails_check_and_index(self):
        text = ['And Joseph knew his brethren, but they knew not him.']
        self.assertTrue(any('seconds per word' in e for e in timing_errors({'verses': [[1, 0, .3]]}, text)))
        self.assertEqual(timing_errors({'verses': [[1, 0, 1.2]]}, text), [])
        record = {'readerId': 'reader', 'reader': 'Reader', 'slug': 'genesis', 'id': 'source'}
        segment = {'text': text[0], 'start': 10., 'end': 10.3, 'words': []}
        with self.assertRaisesRegex(ValueError, 'seconds per word'):
            chapter_payload(record, 42, [segment], [], text)

    def test_review_flags_are_actionable_but_keep_raw_confidence(self):
        text = 'He saith unto thee'
        ws = [{'word': w, 'start': i*.3, 'end': (i+1)*.3, 'probability': .1} for i, w in enumerate(text.split())]
        segment = {'text': text, 'start': 0., 'end': 1.2, 'words': ws}
        ws[1]['end'] = ws[1]['start']
        reasons, audit = audit_difference(text, segment, ws)
        self.assertEqual(reasons, [])
        self.assertEqual(audit['wordProbabilities'], [.1] * 4)
        self.assertEqual(audit['zeroDurationWords'], 1)
        for w in ws[:3]:
            w['end'] = w['start']
        reasons, _ = audit_difference(text, segment, ws)
        self.assertTrue(any('3 consecutive' in r for r in reasons))
        reasons, _ = audit_difference(text, {**segment, 'end': 5}, ws)
        self.assertTrue(any('Duration outlier' in r for r in reasons))

    def test_export_bounds_must_contain_every_verse_and_fit_source(self):
        value = {'sourceStart': 10, 'sourceEnd': 20, 'verses': [[1, .04, 9.96]]}
        self.assertEqual(source_errors(value, 21), [])
        for change in ({'sourceEnd': 25}, {'sourceStart': None}, {'verses': [[1, 0, 11]]}):
            self.assertTrue(source_errors({**value, **change}, 21))

    def test_spoken_introduction_is_not_the_opening_verse(self):
        text = 'Chapter one this is a Librivox recording in the public domain read by Reader in the beginning God created heaven and earth'.split()
        transcript = [{'word': word, 'start': i, 'end': i+.5} for i, word in enumerate(text)]
        start, end = scripture_window('In the beginning God created heaven and earth', 'God created heaven and earth', transcript, len(text))
        self.assertGreaterEqual(start, 10)
        self.assertLess(start, 18)
        self.assertEqual(end, len(text))
        with self.assertRaises(ValueError):
            scripture_window('Completely unrelated scripture passage here', 'Also an unrelated closing verse', transcript, len(text))

    def test_every_verse_is_required_and_finite(self):
        good = {'verses': [[1, 0.1, 2], [2, 2.1, 4]]}
        self.assertEqual(timing_errors(good, ['The first verse', 'The second verse']), [])
        for bad in ({'verses': [[1, 0, 2]]}, {'verses': [[2, 0, 2], [1, 3, 4]]},
                    {'verses': [[1, 0, 2], [2, 1, 4]]}, {'verses': [[1, None, 2], [2, 3, 4]]},
                    {'verses': [[1, 0, float('nan')], [2, 3, 4]]}):
            self.assertTrue(timing_errors(bad, ['The first verse', 'The second verse']))

    def test_uncertain_word_is_flagged_without_rewriting_text(self):
        record = {'readerId': 'reader', 'slug': 'tobit', 'reader': 'Reader', 'id': 'source/file.mp3'}
        segment = {'text': 'The word', 'start': 10., 'end': 12., 'words': [{'start': 10., 'end': 11., 'probability': .1}]}
        heard = [{'word': 'Different', 'start': 10, 'end': 11}]
        payload = chapter_payload(record, 1, [segment], heard, ['The word'])
        self.assertTrue(payload['checks'][0]['check'])
        self.assertEqual(payload['verses'], [[1, .04, 2.04]])
        self.assertAlmostEqual(payload['sourceStart'], 9.96)
        with self.assertRaises(ValueError):
            chapter_payload(record, 1, [segment], heard, ['Changed scripture'])

    def test_missing_aligned_verse_fails(self):
        with self.assertRaises(ValueError):
            chapter_payload({}, 1, [], [], ['A missing verse'])

    def test_asr_disagreement_is_not_silently_normalized(self):
        reasons, _ = audit_difference('He saith unto thee', {'start': 0, 'end': 4, 'words': [{'start': 0, 'end': 4, 'probability': 1}]},
                                  [{'word': 'He says to you', 'start': 0, 'end': 4}])
        self.assertTrue(any('ASR differs' in r for r in reasons))

class Publishing(unittest.TestCase):
    def tearDown(self):
        recordings.archive_locations.cache_clear()

    def test_archive_replica_fallback_still_requires_the_pinned_bytes(self):
        payload = b'licensed source fixture'
        record = {'id': 'collection/track.mp3', 'download': 'https://archive.org/download/collection/track.mp3',
                  'sha1': hashlib.sha1(payload).hexdigest()}
        calls = []
        def get(url, **_):
            calls.append(url)
            if url == record['download']:
                raise OSError('upstream unavailable')
            if '/metadata/' in url:
                return io.BytesIO(json.dumps({'d1': 'ia801504.us.archive.org', 'd2': 'untrusted.invalid', 'dir': '/24/items/collection'}).encode())
            return io.BytesIO(payload)
        with tempfile.TemporaryDirectory() as directory, patch.object(recordings, 'CACHE', Path(directory)), patch.object(recordings.urllib.request, 'urlopen', side_effect=get):
            result = recordings.download(record)
            self.assertEqual(result.read_bytes(), payload)
            self.assertEqual(calls[-1], 'https://ia801504.us.archive.org/24/items/collection/track.mp3')
            self.assertEqual(len(calls), 3)
            recordings.download(record)
            self.assertEqual(len(calls), 3, 'verified cache must avoid another download')
            result.unlink()
            with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                recordings.download({**record, 'sha1': '0' * 40})
            self.assertFalse(result.exists())
            self.assertFalse(list(Path(directory).rglob('*.part')))

    def test_partial_export_reports_missing_sources_and_keeps_review_flags(self):
        records = [{'id': 'missing', 'timingFiles': ['reader/genesis/1.json']},
                   {'id': 'ready', 'timingFiles': ['reader/genesis/2.json'], 'readerId': 'reader', 'reader': 'Reader', 'slug': 'genesis', 'source': 'https://source.invalid', 'license': 'https://license.invalid'}]
        value = {'sourceStart': 1, 'sourceEnd': 3, 'audio': 'recordings/reader/genesis/2.m4a', 'reader': 'Reader', 'verses': [[1, 0, 2]], 'check': True, 'checks': [{'verse': 1, 'reasons': ['listen'], 'check': True}]}
        def download(record):
            if record['id'] == 'missing': raise OSError('503')
            return Path('source.mp3')
        def encode(args, **_): Path(args[-1]).write_bytes(b'encoded fixture')
        with tempfile.TemporaryDirectory() as directory, patch.object(recordings, 'check', return_value=True), patch.object(recordings, 'download', side_effect=download), patch.object(recordings, 'read', return_value=value), patch.object(recordings.subprocess, 'run', side_effect=encode):
            with self.assertRaises(OSError): recordings.export({'recordings': records}, directory)
            self.assertFalse((Path(directory) / 'catalog.json').exists())
            recordings.export({'recordings': records}, directory, allow_unavailable=True)
            catalog = json.loads((Path(directory) / 'catalog.json').read_text())
            self.assertEqual([c['chapter'] for c in catalog['chapters']], [2])
            self.assertTrue(catalog['partial'])
            self.assertEqual(json.loads((Path(directory) / 'unavailable.json').read_text())[0]['source'], 'missing')
            index = json.loads((Path(directory) / 'indexes/reader/genesis/2.json').read_text())
            self.assertEqual(index['checks'], value['checks'])
        with tempfile.TemporaryDirectory() as directory, patch.object(recordings, 'check', return_value=True), patch.object(recordings, 'download', side_effect=OSError('503')):
            with self.assertRaisesRegex(ValueError, 'No narration sources'):
                recordings.export({'recordings': records}, directory, allow_unavailable=True)
            self.assertFalse((Path(directory) / 'catalog.json').exists())

if __name__ == '__main__':
    unittest.main()
