# Classes marked only "Bishop" now carry the Bishop's name

Obie (2026-10-31) named the Bishop for each of the 36 classes whose notes or precept passes said
only "Bishop", so the reader can show each Bishop's teaching under his own name.

- `data/sources/rank-teachers.tsv`: video and teacher for those 36 classes, as Obie gave them
  (22 Bishop Nathanyel, 12 Bishop Yawasap, 2 Bishop Kani).
- `engine/class-metadata.mjs` `namedTeacher`: a passage (or a pass file's class teacher) that says
  only a rank takes the full name from that file, and only when the rank matches. A passage that
  names its teacher, or names none, is left alone. Notes, precept passes, titles and dates are not
  edited.
- Built data: no entry is left under a bare "Bishop" (was 3,205). Bishop Nathanyel 11,997 -> 14,761
  entries, Bishop Yawasap 578 -> 907, Bishop Kani 1,222 -> 1,334.

# Elder Nathanyel is named Bishop Nathanyel

Obie (2026-10-31): "name him Bishop Nathanyel and not Elder".

- 19 notes from 2012-2013: the `teacher` front matter and the "taught" byline say Bishop Nathanyel.
  Nothing in the notes' text changes (none of them quotes "Elder Nathanyel").
- `data/precepts/teachers.json` (48 passages) and `data/precepts/readings/videos.json` (15 videos
  heard as "Elder Nathaniel") say Bishop Nathanyel.
- `data/names.tsv`: Elder Nathanyel/Nathaniel/Nathanael become variants of Bishop Nathanyel, and
  `scripts/notes/prep.py` `teacher_of` now returns the names.tsv spelling, so a rebuilt readings file
  or a new note does not bring the old name back.
- Built data: Bishop Nathanyel 14,761 -> 15,829 entries; no "Elder Nathanyel" left.

# Each teacher's chapters, for the Bishop commentaries

- `engine/build.mjs` writes `/api/concordance/teachers.json`: for each teacher, the chapters (by
  book slug) that their precepts and verse breakdowns reach. The reader's per-Bishop commentaries
  list their coverage from it instead of reading every chapter. Bishop Nathanyel 922 chapters,
  Bishop Kani 360, Bishop Yawasap 219.
