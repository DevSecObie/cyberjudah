# 4 Chapters a Day notes for the chapters that had none

Obie (2026-10-31): "Create notes for the missing, and use the precept pass data for the
breakdowns in the same format as the other 4 chapters a day notes." The IUIC 4 Chapters a Day
channel's sessions for these days read the chapters straight through with no breakdown, so the
notes come from the precept passes.

- `scripts/study/from_precepts.py` writes a study note (`docs/study/<book>/<chapter>.md`) from
  every passage of that chapter in `data/precepts/classes/`: the class's breakdown of each verse
  (`sense`) as bullets, the precepts read with it nested under the verses with the opening
  paragraph of their breakdown. Bishops' and Deacons' teaching comes first. Verses are quoted
  from `data/bible`; nothing is written that is not in the precept data or the KJV. Runs that
  share a verse are one block, and a long chapter takes fewer points per verse so it stays a
  study guide (under about 7,000 words).
- `scripts/study/four-chapters-titles.tsv`: the chapter titles.
- 307 new notes: the Apocrypha from Tobit to 2 Maccabees, Malachi, and the New Testament
  chapters with no note. Chapters with no passage in the precept data (38, such as Judith 1-4,
  Romans 14, 1 Thessalonians 1-3) have no note yet. Existing notes are not touched.
- Checked: every quoted verse matches `data/bible` (`scripts/notes/check.py`), `npm run check`
  finds 0 broken links.
