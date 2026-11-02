# Volume I case studies: the rewritten text

Obie (2026-11-01): "These updates need to go to the database/apps".

- `data/cases.json`: the 233 Volume I cases (C001–C233) take the rewritten text that follows
  the classes, notes and transcripts: charge, verdict, headnote summary, the offense/obedience and
  judgment/blessing paragraphs, and the scripture cited. 232 change; C088 (Ruth and Boaz) keeps
  its current text, as agreed in the review. Slugs, names, eras, statutes, precepts and related
  cases are unchanged, so every link into a case still works. Volume II (C234 on) is untouched.
- Nine verdicts change with the text: C006 deferred, C022 death, C031 unrecorded, C033 spared,
  C094 unrecorded, C102 deferred, C134 deferred, C151 death, C228 unrecorded.
- `scripts/cases-from-drafts.py` lays the drafts over the book's data until the book's HTML is
  reflowed with them. Until then, do not rerun `scripts/cases-from-book.py` against the old book:
  it would put the old text back.
- The site and the Telegram app show the new text once the data set is published.
