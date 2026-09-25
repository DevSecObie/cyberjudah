"""Export corpus passages as independently loadable D1 SQL (never touches library search).

Two tables, both rebuilt from scratch on every import:

- `teaching_passages` (FTS5): spoken passages for the /teachings keyword search.
- `teaching_refs`: every verified scripture reference heard in those passages, with the second
  it was heard, so a Bible chapter page can list where it was taught.

Only spoken passages are exported: intros before the speakers begin, recordings whose text
duplicates an earlier one, and recordings with no speech content are left out.
"""
import argparse
import bisect
import gzip
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sources  # noqa: E402

SKIP_FLAGS = {"no_speech_content", "duplicate_content"}
BIBLE = sources.ROOT / 'data' / 'bible'


def literal(value):
    return "'" + str(value or '').replace("'", "''").replace('\x00', '') + "'"


def number(value):
    return 'NULL' if value is None else repr(value)


def book_slugs(folder=BIBLE):
    """{book name: url slug} from the KJV data, e.g. {'1 Kings': '1-kings', 'Sirach': 'sirach'}."""
    slugs = {}
    for path in sorted(Path(folder).glob('*.json')):
        try:
            book = json.loads(path.read_text(encoding='utf-8')).get('book')
        except (OSError, ValueError, AttributeError):
            continue
        if book:
            slugs[book] = path.stem
    return slugs


def heard_at(passage, heard_as):
    """(seconds, 'caption') for the cue a reference was heard in, else the passage start."""
    text = passage['text_normalized']
    position = text.casefold().find(' '.join(heard_as.split()).casefold()) if heard_as else -1
    offsets = passage.get('cue_offsets') or []
    if position < 0 or not offsets:
        return passage['start_seconds'], 'passage'
    utf16 = len(text[:position].encode('utf-16-le')) // 2
    index = bisect.bisect_right([o[0] for o in offsets], utf16) - 1
    return (offsets[max(index, 0)][1], 'caption')


def references(passage, doc, note, slugs):
    """Rows for teaching_refs: one per distinct verified reference heard in the passage."""
    seen = set()
    for ref in passage.get('scripture_references') or []:
        slug = slugs.get(ref['book'])
        if not ref.get('verified') or not slug:
            continue
        start, timing = heard_at(passage, ref.get('heard_as', ''))
        key = (slug, ref['chapter'], ref['first_verse'], ref['last_verse'], round(start))
        if key in seen:
            continue
        seen.add(key)
        yield [slug, ref['chapter'], ref['first_verse'], ref['last_verse'], doc['video_id'], round(float(start), 2),
               timing, doc['title'], doc['feed'], doc['date'], note, ref.get('heard_as', '')]


def export(source, destination):
    docs = {d['doc_id']: d for d in map(json.loads, (source / 'documents.jsonl').open(encoding='utf-8'))}
    notes = {video: note['url'] for video, note in sources.notes().items()}
    slugs = book_slugs()
    written = skipped = refs = 0
    with destination.open('w', encoding='utf-8') as out:
        out.write('DROP TABLE IF EXISTS teaching_passages;\nCREATE VIRTUAL TABLE teaching_passages USING fts5(title, text, feed UNINDEXED, date UNINDEXED, video UNINDEXED, start UNINDEXED, note UNINDEXED, cues UNINDEXED);\n')
        out.write('DROP TABLE IF EXISTS teaching_refs;\nCREATE TABLE teaching_refs(slug TEXT NOT NULL, chapter INTEGER NOT NULL, first INTEGER NOT NULL, last INTEGER, video TEXT NOT NULL, start REAL NOT NULL, timing TEXT NOT NULL, title TEXT, feed TEXT, date TEXT, note TEXT, heard TEXT);\n')
        with gzip.open(source / 'segments.jsonl.gz', 'rt', encoding='utf-8') as rows:
            for line in rows:
                s = json.loads(line)
                d = docs[s['doc_id']]
                if s.get('region', 'speech') != 'speech' or SKIP_FLAGS.intersection(d.get('quality_flags', [])):
                    skipped += 1
                    continue
                note = notes.get(d['video_id'])
                values = [d['title'], s['text_normalized'], d['feed'], d['date'], d['video_id'], s['start_seconds'], note, json.dumps(s['cue_offsets'], separators=(',', ':'))]
                out.write('INSERT INTO teaching_passages VALUES(' + ','.join(map(literal, values)) + ');\n')
                written += 1
                for row in references(s, d, note, slugs):
                    text = [literal(v) for v in row]
                    text[1], text[2], text[3], text[5] = number(row[1]), number(row[2]), number(row[3]), number(row[5])
                    out.write('INSERT INTO teaching_refs VALUES(' + ','.join(text) + ');\n')
                    refs += 1
        # Built after the load: one index build is faster than maintaining it row by row.
        out.write('CREATE INDEX teaching_refs_chapter ON teaching_refs(slug, chapter);\n')
    print(f'teaching index: {written} passages ({skipped} intro, duplicate or non-speech passages left out), '
          f'{refs} scripture references -> {destination}')


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--source', type=Path, default=Path('dist/corpus'))
    p.add_argument('--out', type=Path, default=Path('dist/teachings.sql'))
    a = p.parse_args()
    export(a.source, a.out)
