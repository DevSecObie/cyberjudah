# claude/project-thread-rwlz2m-lineage

The Apocrypha's people now join the Bible's family lines. A person can carry a **line**: a forefather the KJV names without the generations between, with the verses that say it. Mattathias now goes back to Levi, as Obie traced it: Mattathias, John, Simeon, "a priest of the sons of Joarib" (1 Maccabees 2:1), Jehoiarib of the sons of Aaron (1 Chronicles 24:1, 7, 19), Aaron, Amram, Kohath, Levi.

## Why
Obie asked that the people of the Apocrypha be lined up with the whole Bible, and that other missing links be found while searching the scriptures. The catalog only had father, mother, brother, sister, husband, wife and child. 1 Maccabees 2:1 names Joarib as the house Mattathias came from, not as his father. A line holds that link without inventing anyone between them, which the People rules forbid.

## What changed
- `data/people/people.json`:
  - Jehoiarib (1 Chronicles 24:7) is also called Joarib (1 Maccabees 2:1) and Jarib (1 Maccabees 14:29), of the Tribe of Levi. His line is Aaron (1 Chronicles 24:1, 19).
  - Lines:
    - Simeon, Mattathias's grandfather, to Jehoiarib (1 Maccabees 2:1).
    - Simon the son of Mattathias to Jehoiarib, "of the posterity of Jarib" (1 Maccabees 14:29).
    - Mattathias to Phinehas, "Phinees our father" (1 Maccabees 2:54).
    - Alcimus to Aaron, "a priest of the seed of Aaron" (1 Maccabees 7:14).
    - Gabael to Asael, "of the seed of Asael" (Tobit 1:1).
    - Tobit to Naphtali, "the house of my father Nephthali" (Tobit 1:5).
    - Judith to Simeon, "my father Simeon" (Judith 9:2).
  - Simon's sons John, Judas and Mattathias are added (1 Maccabees 13:53; 16:1-23), with Simon's verses that name them.
  - Naphtali is also called Nephthali, with Tobit 1:1, 1:4, 1:5 and 7:3.
  - Jonathan the son of Saul has 1 Maccabees 4:30. Judith and Merari have Judith 16:7.
  - In Judith's genealogy, Ozel and Salasadal now read as the KJV spells them: Oziel and Salasadai (Judith 8:1).
- `engine/people-lines.mjs`:
  - Every line must name another person.
  - It must give verses that name the forefather.
  - It must never lead back to the person.
  - `engine/check.mjs` runs these checks.
- `engine/build.mjs`: each person's API record gains `line` (forefathers, with their verses) and `descendants` (everyone who names them as a forefather).

`node engine/check.mjs` (with `PEOPLE_BASE` set to main) passes. So do `node --test engine/people-*.test.mjs` (31 tests) and `node engine/build.mjs`.
