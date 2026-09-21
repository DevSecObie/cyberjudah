"""Export corpus passages as independently loadable D1 SQL (never touches library search)."""
import argparse, gzip, json, re
from pathlib import Path

def literal(value):
    return "'" + str(value or '').replace("'", "''").replace('\x00','') + "'"

def export(source, destination):
    docs = {d['doc_id']: d for d in map(json.loads, (source / 'documents.jsonl').open())}
    root = Path(__file__).resolve().parents[2]
    notes = {}
    for folder, prefix in [('blog','classes'), ('captains','captains'), ('history/notes','history')]:
        for path in (root / folder).glob('*/*.md'):
            body = path.read_text()
            video = re.search(r'data-video-id="([\w-]{11})"', body)
            if video:
                notes[video[1]] = f'/{prefix}/{path.parent.name}/{path.stem}'
    with destination.open('w') as out:
        out.write('DROP TABLE IF EXISTS teaching_passages;\nCREATE VIRTUAL TABLE teaching_passages USING fts5(title, text, feed UNINDEXED, date UNINDEXED, video UNINDEXED, start UNINDEXED, note UNINDEXED);\n')
        with gzip.open(source / 'segments.jsonl.gz','rt') as rows:
            for line in rows:
                s = json.loads(line); d = docs[s['doc_id']]
                values = [d['title'], s['text_normalized'], d['feed'], d['date'], d['video_id'], s['start_seconds'], notes.get(d['video_id'])]
                out.write('INSERT INTO teaching_passages VALUES(' + ','.join(map(literal,values)) + ');\n')
if __name__ == '__main__':
    p = argparse.ArgumentParser(); p.add_argument('--source',type=Path,default=Path('dist/corpus')); p.add_argument('--out',type=Path,default=Path('dist/teachings.sql'))
    a=p.parse_args(); export(a.source,a.out)
