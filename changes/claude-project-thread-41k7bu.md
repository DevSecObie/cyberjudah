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
