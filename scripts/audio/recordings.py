#!/usr/bin/env python3
"""Reproducible human KJV index. Run `help`/--help; no network/model needed for check.

Word timings come from stable-ts's open-source Whisper forced aligner, never text length.
A separate unconstrained transcription flags differences; it NEVER replaces Bible text.
Only the export command produces the AAC files consumed by the app's upload script.
"""
from __future__ import annotations
import argparse
import difflib
import hashlib
import importlib.metadata
import json
import math
import re
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data/audio/kjv'
CACHE = ROOT / '.cache/audio'
AUDIT_VERSION = 1
MIN_SECONDS_PER_WORD = 0.12
NAMES = {'esther-greek': 'Rest of Esther', 'sirach': 'Ecclesiasticus (Sirach)',
         'song-of-the-three-children': 'Song of the Three Holy Children',
         'susanna': 'History of Susanna', 'prayer-of-manasseh': 'Prayer of Manasses'}


def read(path):
    return json.loads(Path(path).read_text())


def write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + '\n')
    temp.replace(path)


def words(text):
    return re.findall(r"[a-z]+(?:'[a-z]+)?", text.lower().replace('’', "'"))


def digest(path, algorithm='sha256'):
    h = hashlib.new(algorithm)
    with Path(path).open('rb') as f:
        for part in iter(lambda: f.read(1024 * 1024), b''):
            h.update(part)
    return h.hexdigest()


def scripture(slug):
    return read(ROOT / 'data/bible' / f'{slug}.json')['chapters']


def download(record):
    # A checksum pins the actual licensed source, even when its host redirects.
    path = CACHE / 'source' / record['id']
    if path.exists() and digest(path, 'sha1') == record['sha1']:
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    part = path.with_suffix('.part')
    failures = []
    for url in dict.fromkeys([*record.get('mirrors', []), record['download']]):
        try:
            with urllib.request.urlopen(url, timeout=45) as source, part.open('wb') as dest:
                shutil.copyfileobj(source, dest)
            if digest(part, 'sha1') != record['sha1']:
                raise ValueError(f"Source checksum mismatch: {record['id']}")
            part.replace(path)
            return path
        except (OSError, ValueError) as error:
            failures.append(str(error))
        finally:
            part.unlink(missing_ok=True)
    raise ValueError('; '.join(failures))


def timing_errors(value, text):
    count = len(text)
    errors = []
    rows = value.get('verses', [])
    if len(rows) != count:
        errors.append(f'Expected {count} verses, found {len(rows)}')
    previous = 0.0
    for verse, row in enumerate(rows, 1):
        if not isinstance(row, list) or len(row) != 3 or row[0] != verse:
            errors.append(f'Verse {verse}: missing or out of order')
            continue
        _, start, end = row
        if any(type(n) not in (int, float) or not math.isfinite(n) for n in (start, end)):
            errors.append(f'Verse {verse}: missing/non-finite timing')
            continue
        if start < 0 or end <= start or start < previous - 0.001:
            errors.append(f'Verse {verse}: invalid/overlapping timing {start}–{end}')
        if verse <= count and (end - start) + 0.001 < MIN_SECONDS_PER_WORD * len(words(text[verse-1])):
            errors.append(f'Verse {verse}: implausibly short timing (below {MIN_SECONDS_PER_WORD} seconds per word)')
        previous = end
    for flag in value.get('checks', []):
        if flag.get('check') is not True or flag.get('verse') not in range(1, count + 1) or not flag.get('reasons'):
            errors.append('Invalid verse review flag')
    if value.get('check') is not (True if value.get('checks') else None):
        errors.append('Chapter check does not match its verse flags')
    for hint in value.get('hints', []):
        if hint.get('verse') not in range(1, count + 1) or not hint.get('reasons'):
            errors.append('Invalid alignment hint')
    return errors


def source_errors(value, duration):
    start, end = value.get('sourceStart'), value.get('sourceEnd')
    if any(type(n) not in (int, float) or not math.isfinite(n) for n in (start, end, duration)):
        return ['Missing/non-finite source bounds']
    if start < 0 or end <= start or end > duration + 0.05:
        return ['Chapter extends outside its source recording']
    if any(type(row[-1]) in (int, float) and row[-1] > end-start+0.001
           for row in value.get('verses', []) if isinstance(row, list) and len(row) == 3):
        return ['Verse ends after the exported chapter audio']
    return []


def audit_difference(text, segment, transcript):
    expected = words(text)
    spoken = words(' '.join(w['word'] for w in transcript
                           if w['end'] > segment['start'] + 0.05 and w['start'] < segment['end'] - 0.05))
    ratio = difflib.SequenceMatcher(None, expected, spoken, autojunk=False).ratio()
    seconds = (segment['end'] - segment['start']) / max(1, len(expected))
    reasons = []
    if ratio < .9:
        reasons.append(f'ASR differs from source text (word agreement {ratio:.0%}); listen for skip/addition/misread or ASR error')
    ws = segment.get('words', [])
    run = longest = zeroes = 0
    for w in ws:
        if w['end'] <= w['start']:
            run += 1; zeroes += 1; longest = max(longest, run)
        else:
            run = 0
    if not ws or longest >= 3:
        reasons.append('Missing word alignment' if not ws else f'{longest} consecutive words have no duration')
    if seconds < .15 or seconds > 1.0:
        reasons.append(f'Duration outlier ({seconds:.3f} seconds per word); listen to verify boundaries')
    # Retain confidence and isolated zeroes for inspection, without turning normal
    # forced-aligner uncertainty into thousands of unactionable review requests.
    metrics = {'wordAgreement': round(ratio, 4), 'secondsPerWord': round(seconds, 4),
               'zeroDurationWords': zeroes, 'longestZeroDurationRun': longest,
               'wordProbabilities': [w.get('probability') for w in ws]}
    return reasons, metrics


def alignment_hints(segment):
    """Preserve common word-level aligner signals without raising review flags."""
    ws = segment.get('words', [])
    hints = []
    if not ws or any(w['end'] <= w['start'] for w in ws):
        hints.append('A word has no duration')
    if any(w.get('probability', 0) < 0.3 for w in ws):
        hints.append('Low-confidence word alignment')
    return hints


def chapter_payload(record, chapter, segments, transcript, text):
    if len(segments) != len(text):
        raise ValueError(f'{chapter}: forced aligner omitted a verse')
    start = float(max(0, segments[0]['start'] - 0.04))
    end = float(segments[-1]['end'] + 0.04)
    rows, checks, audits, hints = [], [], [], []
    for i, (verse, segment) in enumerate(zip(text, segments), 1):
        if words(verse) != words(segment['text']):
            raise ValueError(f'{chapter}:{i}: forced alignment text changed')
        rows.append([i, round(float(segment['start']) - start, 3), round(float(segment['end']) - start, 3)])
        reasons, metrics = audit_difference(verse, segment, transcript)
        audits.append({'verse': i, **metrics})
        if reasons:
            checks.append({'verse': i, 'check': True, 'reasons': reasons})
        hint = alignment_hints(segment)
        if .9 <= metrics['wordAgreement'] < 1:
            hint.append(f"ASR differs from source text (word agreement {metrics['wordAgreement']:.0%}); listen for skip/addition/misread or ASR error")
        if hint:
            hints.append({'verse': i, 'reasons': hint})
    value = {'audio': f"recordings/{record['readerId']}/{record['slug']}/{chapter}.m4a",
             'reader': record['reader'], 'verses': rows,
             'source': record['id'], 'sourceStart': round(start, 3), 'sourceEnd': round(end, 3),
             'textSha256': hashlib.sha256(json.dumps(text, ensure_ascii=False).encode()).hexdigest(),
             'auditVersion': AUDIT_VERSION, 'audit': audits}
    if checks:
        value.update(check=True, checks=checks)
    if hints:
        value['hints'] = hints
    errors = timing_errors(value, text)
    if errors:
        raise ValueError('; '.join(errors))
    return value


def load_model(args):
    import stable_whisper
    if args.backend == 'mlx':
        return stable_whisper.load_mlx_whisper(args.model)
    return stable_whisper.load_model(args.model, device=args.device)


def scripture_window(first, last, transcript, duration):
    """Conservative ASR bounds around scripture, excluding spoken catalog credits.

    These bounds only crop the input to the forced aligner. They are never verse
    timestamps; those still come exclusively from word alignment.
    """
    tokens = [(token, w['start'], w['end']) for w in transcript for token in words(w['word'])]
    if not tokens:
        raise ValueError('No independently transcribed words')
    def anchor(text, tail=False):
        reference = words(text)
        offset = max(0, len(tokens) - 500) if tail else 0
        candidates = tokens[offset:] if tail else tokens[:500]
        match = difflib.SequenceMatcher(None, reference, [w[0] for w in candidates], autojunk=False).find_longest_match()
        if match.size < min(4, len(reference)):
            raise ValueError('Opening/closing scripture anchor uncertain; listening review required')
        if tail:
            i = min(len(tokens) - 1, offset + match.b + len(reference) - match.a + 3)
            return min(duration, tokens[i][2] + 1)
        i = max(0, offset + match.b - match.a - 3)
        return max(0, tokens[i][1] - 1)
    start, end = anchor(first), anchor(last, True)
    if end <= start:
        raise ValueError('Scripture bounds reversed')
    return start, end


def realign_chapter(record, chapter, segments, transcript, text, model, provenance):
    """Retry rejected timings within independently anchored chapter audio only."""
    nearby = [w for w in transcript if w['end'] > segments[0]['start'] - 20
              and w['start'] < segments[-1]['end'] + 20]
    first, last = scripture_window(text[0], text[-1], nearby, record['duration'])
    stamp = hashlib.sha256(json.dumps([record['sha1'], chapter, text, first, last, provenance], sort_keys=True).encode()).hexdigest()
    raw = CACHE / 'chapter-alignment' / (stamp + '.json')
    if not raw.exists():
        clip = raw.with_suffix('.wav'); clip.parent.mkdir(parents=True, exist_ok=True)
        try:
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(first), '-i', str(download(record)),
                            '-t', str(last-first), '-ac', '1', '-ar', '16000', str(clip)], check=True)
            result = model.align(str(clip), '\n'.join(text), language='en', original_split=True,
                                 regroup=False, remove_instant_words=False, verbose=False)
            if result is None:
                raise ValueError('Chapter-only forced alignment failed')
            result.offset_time(first)
            write(raw, result.to_dict())
        finally:
            clip.unlink(missing_ok=True)
    return read(raw)['segments']


def index_record(record, model, provenance):
    path = download(record)
    text = scripture(record['slug'])
    flat = [v for ch in record['chapters'] for v in text[str(ch)]]
    stamp = hashlib.sha256(('\n'.join(flat) + record['sha1'] + json.dumps(provenance, sort_keys=True)).encode()).hexdigest()
    raw = CACHE / 'alignment' / (stamp + '.json')
    if raw.exists():
        results = read(raw)
    else:
        # Independent ASR detects omissions that forced alignment alone cannot reveal.
        heard_key = hashlib.sha256((record['sha1'] + json.dumps({k: v for k, v in provenance.items() if k != 'pipeline'}, sort_keys=True)).encode()).hexdigest()
        heard_path = CACHE / 'transcripts' / (heard_key + '.json')
        if heard_path.exists():
            heard = read(heard_path)
        else:
            heard = model.transcribe(str(path), language='en', word_timestamps=True,
                                     condition_on_previous_text=False, verbose=False).to_dict()
            write(heard_path, heard)
        transcript = [w for s in heard['segments'] for w in s.get('words', [])]
        first, last = scripture_window(flat[0], flat[-1], transcript, record['duration'])
        clip = CACHE / 'alignment' / (stamp + '.wav')
        clip.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(first), '-i', str(path),
                        '-t', str(last-first), '-ac', '1', '-ar', '16000', str(clip)], check=True)
        aligned = model.align(str(clip), '\n'.join(flat), language='en', original_split=True,
                              regroup=False, remove_instant_words=False, verbose=False)
        if aligned is None:
            raise ValueError('Forced alignment failed')
        aligned.offset_time(first)
        results = {'aligned': aligned.to_dict(), 'heard': heard, 'aligner': provenance}
        write(raw, results)
        clip.unlink(missing_ok=True)
    segments = results['aligned']['segments']
    if len(segments) != len(flat):
        raise ValueError(f"{record['id']}: expected {len(flat)} verse segments, found {len(segments)}")
    transcript = [w for s in results['heard']['segments'] for w in s.get('words', [])]
    outputs, cursor, rejected = [], 0, []
    previous_rejections = {e['chapter']: e.get('previousChecks', []) for e in record.get('alignmentErrors', [])}
    # A failed verse withholds its chapter, never a guessed timing. Keep valid
    # chapters from the same source available and report every rejected chapter.
    for ch in record['chapters']:
        n = len(text[str(ch)])
        name = f"{record['readerId']}/{record['slug']}/{ch}.json"
        try:
            chapter_segments = segments[cursor:cursor+n]
            try:
                value = chapter_payload(record, ch, chapter_segments, transcript, text[str(ch)])
            except ValueError:
                print(f"  Retry {record['slug']} {ch} with chapter anchors", flush=True)
                chapter_segments = realign_chapter(record, ch, chapter_segments, transcript, text[str(ch)], model, provenance)
                value = chapter_payload(record, ch, chapter_segments, transcript, text[str(ch)])
                value['chapterRealigned'] = True
            value['aligner'] = provenance
            errors = source_errors(value, record['duration'])
            if errors:
                raise ValueError('; '.join(errors))
            if (DATA / name).exists() and read(DATA / name).get('source') != record['id']:
                raise ValueError('Overlapping catalog ranges; existing chapter retained for review')
            history = previous_rejections.get(ch, [])
            if (DATA / name).exists():
                previous = read(DATA / name)
                history = previous.get('previousChecks', [])
                if previous.get('auditVersion') != AUDIT_VERSION:
                    history += previous.get('checks', [])
            if history:
                value['previousChecks'] = history
            outputs.append((name, value))
        except ValueError as error:
            rejection = {'chapter': ch, 'reason': str(error)}
            if previous_rejections.get(ch):
                rejection['previousChecks'] = previous_rejections[ch]
            if (DATA / name).exists():
                previous = read(DATA / name)
                rejection['previousChecks'] = previous.get('previousChecks', []) + previous.get('checks', [])
            rejected.append(rejection)
        cursor += n
    # Remove stale outputs only when this source previously owned them.
    names = {name for name, _ in outputs}
    for name in record.get('timingFiles', []):
        if name not in names and (DATA / name).exists() and read(DATA / name).get('source') == record['id']:
            (DATA / name).unlink()
    for name, value in outputs:
        write(DATA / name, value)
    record['timingFiles'] = [name for name, _ in outputs]
    record['alignmentErrors'] = rejected
    record['status'] = 'partial-alignment' if rejected else 'needs-review' if any(v.get('check') for _, v in outputs) else 'aligned'
    record['quality'] = f"Forced aligned against repository KJV; {sum(len(v.get('checks', [])) for _, v in outputs)} verses need listening review. Noise/volume need listening review."
    return not rejected


def check(manifest):
    errors, count = [], 0
    declared = set()
    for record in manifest['recordings']:
        if record.get('license') != 'https://librivox.org/pages/public-domain/' or not record.get('licenseEvidence', '').startswith('https://archive.org/metadata/'):
            errors.append(record['id'] + ': missing rights evidence')
        files = record.get('timingFiles', [])
        if record['status'] in ('aligned', 'needs-review') and len(files) != len(record['chapters']):
            errors.append(record['id'] + ': missing chapter timing file')
        for name in files:
            declared.add(name)
            try:
                value = read(DATA / name)
                ch = Path(name).stem
                verses = scripture(record['slug'])[ch]
                errors.extend(f'{name}: {error}' for error in timing_errors(value, verses))
                errors.extend(f'{name}: {error}' for error in source_errors(value, record['duration']))
                expected = hashlib.sha256(json.dumps(verses, ensure_ascii=False).encode()).hexdigest()
                if value.get('textSha256') != expected:
                    errors.append(name + ': Bible text changed; re-align before release')
                if value.get('aligner', {}).get('pipeline') != 2:
                    errors.append(name + ': re-align with scripture-aware intro trimming before release')
                if value.get('auditVersion') != AUDIT_VERSION or len(value.get('audit', [])) != len(verses):
                    errors.append(name + ': regenerate verse review diagnostics before release')
                if value.get('audio') != f"recordings/{record['readerId']}/{record['slug']}/{ch}.m4a" or value.get('source') != record['id']:
                    errors.append(name + ': incorrect source or R2 key')
                count += 1
            except (OSError, ValueError, KeyError, TypeError) as e:
                errors.append(f'{name}: {e}')
    for path in DATA.glob('*/*/*.json'):
        if str(path.relative_to(DATA)) not in declared:
            errors.append(str(path) + ': undeclared timing file')
    for error in errors:
        print(error, file=sys.stderr)
    print(f'{count} indexed chapters checked; {len(errors)} problem(s). Pending sources are listed in COVERAGE.md.')
    return not errors


def coverage(manifest):
    rows = ['# Human KJV recording coverage', '', 'Source discovery is not playback availability. Only indexed chapters have verse timings.',
            'A `check: true` chapter/verse needs listening review; ASR differences are not proof of a reader error.', '',
            '| Book | Indexed chapters | Verified source candidates | Missing timings |', '| --- | --- | --- | --- |']
    flags = []
    verse_count = flagged_count = 0
    for book in read(ROOT / 'data/bible/index.json'):
        slug = book['slug']; chapters = set(map(int, scripture(slug)))
        records = [r for r in manifest['recordings'] if r['slug'] == slug]
        indexed = {int(Path(f).stem) for r in records for f in r['timingFiles']}
        describe = lambda values: ', '.join(map(str, sorted(values))) or '—'
        candidates = ', '.join(dict.fromkeys(r['reader'] for r in records)) or 'No verified KJV source'
        rows.append(f"| {NAMES.get(slug, book['book'])} | {describe(indexed)} | {candidates} | {describe(chapters-indexed)} |")
        for record in records:
            for error in record.get('alignmentErrors', []):
                flags.append(f"- {NAMES.get(slug, book['book'])} {error['chapter']} ({record['reader']}): chapter withheld — {error['reason']}.")
            for name in record['timingFiles']:
                value = read(DATA / name)
                verse_count += len(value['verses'])
                flagged_count += len(value.get('checks', []))
                for flag in value.get('checks', []):
                    flags.append(f"- {NAMES.get(slug, book['book'])} {Path(name).stem}:{flag['verse']} ({record['reader']}): {'; '.join(flag['reasons'])}.")
    rows += ['', '## Listening review', '', f'{flagged_count} of {verse_count} indexed verses need listening review.',
             'Active flags: ASR agreement below 90%, duration outside 0.15–1.0 seconds/word, or at least three consecutive zero-duration words. Timings below 0.12 seconds/word are withheld.',
             'Raw word confidence remains in `audit`; earlier broad flags remain in `previousChecks` and are not silently discarded.', '',
             *(flags or ['No aligned verses yet. Do not treat catalog metadata as verified spoken-text matches.']), '', '## Notes', '', *['- '+n for n in manifest['notes']]]
    (DATA / 'COVERAGE.md').write_text('\n'.join(rows) + '\n')


def export(manifest, destination):
    if not check(manifest):
        raise ValueError('Timing validation failed')
    dest = Path(destination)
    chapters = []
    for record in manifest['recordings']:
        for name in record['timingFiles']:
            value = read(DATA / name)
            source = download(record)
            output = dest / value['audio']; output.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(['ffmpeg','-v','error','-y','-i',str(source),'-ss',str(value['sourceStart']),
                            '-t',str(value['sourceEnd']-value['sourceStart']),'-vn','-ac','1',
                            '-c:a','aac','-b:a','64k','-movflags','+faststart',str(output)],check=True)
            public = {k: value[k] for k in ('audio', 'reader', 'verses', 'check', 'checks') if k in value}
            write(dest / 'indexes' / name, public)
            chapters.append({'readerId': record['readerId'], 'reader': record['reader'], 'slug': record['slug'],
                             'chapter': int(Path(name).stem), 'index': name, 'audio': value['audio'],
                             'source': record['source'], 'license': record['license'],
                             'sha256': digest(output), 'bytes': output.stat().st_size})
    write(dest / 'catalog.json', {'schemaVersion': 1, 'chapters': chapters})
    print(f'{len(chapters)} timing-validated chapters exported; review flags preserved; no upload performed')


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('command', choices=['download','index','check','coverage','export'])
    p.add_argument('--recording', help='Exact manifest recording id (default: all)')
    p.add_argument('--exclude-reader', help='Reader id to leave pending')
    p.add_argument('--backend', choices=['mlx','whisper'], default='whisper')
    p.add_argument('--model', default='turbo', help='Whisper model or MLX Hugging Face model id')
    p.add_argument('--device', default='cpu')
    p.add_argument('--output', default=str(CACHE / 'export'))
    p.add_argument('--force', action='store_true', help='Re-align selected sources, including previously indexed chapters')
    p.add_argument('--indexed-only', action='store_true', help='Recheck sources with existing chapter indexes before resuming pending sources')
    args = p.parse_args(); manifest = read(DATA / 'manifest.json')
    selected = [r for r in manifest['recordings'] if (args.recording is None or r['id'] == args.recording) and r['readerId'] != args.exclude_reader]
    if args.indexed_only:
        selected = [r for r in selected if r.get('timingFiles')]
    # Finish the shorter Apocrypha collection before the 100-hour complete Bible.
    selected.sort(key=lambda r: r['readerId'] == 'michael-armenta')
    if not selected:
        p.error('Unknown recording id')
    if args.command == 'check':
        return 0 if check(manifest) else 1
    if args.command == 'export':
        export(manifest, args.output); return 0
    if args.command == 'coverage':
        coverage(manifest); return 0
    model = load_model(args) if args.command == 'index' else None
    provenance = {'engine': 'stable-ts', 'version': importlib.metadata.version('stable-ts'),
                  'backend': args.backend, 'model': args.model, 'pipeline': 2} if model else None
    failed = []
    for record in selected:
        if args.command == 'index' and not args.force and record.get('timingFiles') and record['status'] in ('aligned', 'needs-review'):
            current_pipeline = True
            for name in record['timingFiles']:
                value = read(DATA / name)
                current_pipeline = current_pipeline and value.get('aligner') == provenance and value.get('auditVersion') == AUDIT_VERSION
                expected = hashlib.sha256(json.dumps(scripture(record['slug'])[Path(name).stem], ensure_ascii=False).encode()).hexdigest()
                if value.get('textSha256') != expected:
                    p.error(f'{name}: text changed; use --recording and --force to re-align')
            if current_pipeline:
                continue
        print(record['id'], flush=True)
        try:
            if model is None:
                download(record)
            else:
                if not index_record(record, model, provenance):
                    failed.append(record['id'])
                write(DATA / 'manifest.json', manifest)
        except Exception as e:
            failed.append(record['id']); print(str(e), file=sys.stderr, flush=True)
            if model is not None:
                history = {x['chapter']: x.get('previousChecks', []) for x in record.get('alignmentErrors', [])}
                for name in record.get('timingFiles', []):
                    if (DATA / name).exists() and read(DATA / name).get('source') == record['id']:
                        value = read(DATA / name)
                        history[int(Path(name).stem)] = value.get('previousChecks', []) + value.get('checks', [])
                        (DATA / name).unlink()
                record['alignmentErrors'] = [{'chapter': ch, 'reason': str(e), **({'previousChecks': history[ch]} if history.get(ch) else {})} for ch in record['chapters']]
                record['timingFiles'] = []
                record['status'] = 'alignment-failed'
                write(DATA / 'manifest.json', manifest)
    coverage(manifest)
    return 1 if failed else 0


if __name__ == '__main__':
    raise SystemExit(main())
