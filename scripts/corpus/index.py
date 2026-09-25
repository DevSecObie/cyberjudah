"""Export corpus passages as independently loadable D1 SQL (never touches library search).

Only spoken passages are exported: intros before the speakers begin, recordings whose text
duplicates an earlier one, and recordings with no speech content are left out of search.
"""
import argparse
import gzip
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sources  # noqa: E402

SKIP_FLAGS = {"no_speech_content", "duplicate_content"}


def literal(value):
    return "'" + str(value or '').replace("'", "''").replace('\x00', '') + "'"


def export(source, destination):
    docs = {d['doc_id']: d for d in map(json.loads, (source / 'documents.jsonl').open(encoding='utf-8'))}
    notes = {video: note['url'] for video, note in sources.notes().items()}
    written = skipped = 0
    with destination.open('w', encoding='utf-8') as out:
        out.write('DROP TABLE IF EXISTS teaching_passages;\nCREATE VIRTUAL TABLE teaching_passages USING fts5(title, text, feed UNINDEXED, date UNINDEXED, video UNINDEXED, start UNINDEXED, note UNINDEXED, cues UNINDEXED);\n')
        with gzip.open(source / 'segments.jsonl.gz', 'rt', encoding='utf-8') as rows:
            for line in rows:
                s = json.loads(line)
                d = docs[s['doc_id']]
                if s.get('region', 'speech') != 'speech' or SKIP_FLAGS.intersection(d.get('quality_flags', [])):
                    skipped += 1
                    continue
                values = [d['title'], s['text_normalized'], d['feed'], d['date'], d['video_id'], s['start_seconds'], notes.get(d['video_id']), json.dumps(s['cue_offsets'], separators=(',', ':'))]
                out.write('INSERT INTO teaching_passages VALUES(' + ','.join(map(literal, values)) + ');\n')
                written += 1
    print(f'teaching index: {written} passages ({skipped} intro, duplicate or non-speech passages left out) -> {destination}')


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--source', type=Path, default=Path('dist/corpus'))
    p.add_argument('--out', type=Path, default=Path('dist/teachings.sql'))
    a = p.parse_args()
    export(a.source, a.out)
