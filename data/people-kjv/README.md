# People from the KJV

The People catalog, rebuilt from the text of the King James Version with the Apocrypha
alone. It will replace `data/people/people.json` once every book is done. Nothing here
comes from STEPBible or TIPNR.

Each book has two hand-kept files, read in Bible order, and all books build into one
`people.json`:

- `sources/<book>.names.txt`: every name in the book, assigned by hand to a person, a
  people, a place, a title or something else. One line per record:
  `key | Name | forms | verses | type | description`. Type `+` carries on a person from an
  earlier book (Reuben in Exodus is the Reuben of Genesis), adding the verses of this book.
  A person with two KJV names
  (Abram and Abraham, Jacob and Israel) is one record with both forms. Two people with the
  same name (Enoch the son of Cain and Enoch the son of Jared) are two records, split by
  the verses that speak of each.
- `sources/<book>.links.txt`: the family links, each with the verses that state it.
  `child < father`, `child << mother`, `a = b` husband and wife, `a ~ b` brother or sister
  (only where the text says so), `a ^ b` a forefather where the generations between are not
  given ("Laban the son of Nahor", whose father is Bethuel), `a & b` the tribe the text gives ("Bezaleel ... of the tribe of
  Judah"), and `a @ b` the nation the text
  gives ("Ephron the Hittite"). People who share a name stay separate records with no
  link between them unless a verse says they are one.
- `people.json`: built from all of them by `python3 scripts/people-kjv/build.py`.

`scripts/people-kjv/names.py` finds the names: a capitalised word that never appears in
lower case in the KJV, used mid-sentence or tagged with a Strong's number in
`data/strongs/tags` (Strong's 1890 concordance, public domain). The build fails if any
name in any verse of the book belongs to no record, if a record cites a verse that does
not name it, or if a link cites no verse. `engine/check.mjs` checks the built files.

Every link carries an evidence label: `scripture` (Scripturally confirmed), `parallel`
(Parallel identification), `history` (Historically identified) or `variant` (Textual
variant). There is no "uncertain" label: only what the KJV and Apocrypha state.
