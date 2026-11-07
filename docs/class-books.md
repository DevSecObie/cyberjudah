# Complete class-book lists

`/api/library/class-books.json` keeps the existing shelf and eight sampled moments. Each row also
has a stable `key`. `/api/library/class-books/<key>.json` returns:

```json
{"key":"book-key","title":"Existing catalog title","total":0,"moments":[]}
```

Each moment has `video`, `t` (seconds), `title`, `date` (or null), `teacher` (empty when unknown),
`url`, and `said`. There is one moment per unique counted recording, newest first. `said` is a
contiguous slice of at most 300 characters from the original captions, without rewritten words
or added ellipses. Published note metadata supplies existing titles, dates, teachers and links.

Keys prefer the held library slug, then the recorded Archive identifier, then a title slug.
Title collisions get a stable author/identity hash suffix. Keys contain only letters, digits,
dot, underscore or hyphen, up to 200 characters. Clients should use the returned key rather
than derive one. Catalog aliases for the same slug or Archive item share a deduplicated list;
their displayed totals match that list.

The totals count spoken mentions of the catalog's book-name forms, with the existing corpus's
duplicate and non-speech exclusions. They do not assert that pages were read in every class.
Use “Mentioned in” or “Discussed in” for these totals. A held book's separately verified page
readings remain a different data set.

Build both totals and complete lists from the same corpus:

```sh
python3 scripts/corpus/build.py --out /tmp/class-books-corpus
python3 scripts/library/class_books.py --corpus /tmp/class-books-corpus --out data/library/class-books.json
node engine/build.mjs --out dist --site https://cyberjudah.io
```

The data publication workflow performs these steps together. The PR data-assets check builds
the real lists, publishes them to an in-memory bucket, and reads every list through the data
Worker. Built JSON is published to the existing data bucket, not committed to Git. A legacy
eight-sample input never becomes a purported complete list; clients can retain those samples
as a fallback until the new data publication is live.
