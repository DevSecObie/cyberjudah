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
  - Greek names of Bible people go on the Bible person, with the verses, not on a new person. In all, 371 names and 1,786 verses are added, with 136 new people where the Apocrypha names someone the Hebrew books do not:
    - Greek Esther, Susanna, Bel, the Song of the Three, the Prayer of Manasses, the Epistle of Jeremy and Baruch: Mardocheus is Mordecai, Aman is Haman, Habbacuc is Habakkuk, Azarias, Ananias and Misael are Daniel's three friends, Nerias, Maasias, Joachim, Sedecias and Josias are Baruch's and Jeremiah's people.
    - Sirach 44-50: each of the famous men on his own page (Esay, Jesus son of Nave, Josedec, Neemias, Rabsaces...); Simon son of Onias with a line to Aaron (50:13); Jesus son of Sirach.
    - 2 Esdras: Esdras is Ezra, and his fathers in 1:1-3 are Ezra's fathers in Ezra 7:1-5 (Saraias, Helchias, Achitob, Phinees...). Achias, Phinees and Heli, which only 2 Esdras gives, are lines, so Ezra 7 is not changed. The prophets of 1:39-40 by their Greek names.
    - 1 Esdras: every name matched to the person on the parallel verse in 2 Chronicles 35-36, Ezra and Nehemiah 7-8, by the same name in another spelling or by the same place in a list that runs in the same order (for example 5:8 and Nehemiah 7:7, 9:48 and Nehemiah 8:7). Names with no counterpart, or whose place is not certain, are new people.
    - 1 and 2 Maccabees: all of Jonathan's, Simon's and Judas's verses; Demetrius son of Demetrius, Alexander son of Epiphanes, young Antiochus son of Alexander, Antiochus son of Demetrius, Cleopatra, Tryphon, the envoys and their fathers (Eupolemus son of John son of Accos, Jason son of Eleazar, Numenius son of Antiochus, Antipater son of Jason), Ptolemeus son of Abubus, and the fathers 2 Maccabees names (Thraseas, Menestheus, Genneus, Patroclus).
    - Tobit and Judith: Adam, Eve, Moses, Aaron, Ismael, Japheth and the tribes they name.
  - As the catalog already does in the Hebrew books and the New Testament, a nation or tribe called by a forefather's name is listed on that forefather across the Apocrypha (Israel and Jacob, Jews and Juda, Levites, Benjamin, Ephraim, Esau, the Hittites, Amorites, Jebusites, Perizzites, Girgashites, Hebrews).
- `engine/people-lines.mjs`:
  - Every line must name another person.
  - It must give verses that name the forefather.
  - It must never lead back to the person.
  - `engine/check.mjs` runs these checks.
- `engine/build.mjs`: each person's API record gains `line` (forefathers, with their verses) and `descendants` (everyone who names them as a forefather).

`node engine/check.mjs` (with `PEOPLE_BASE` set to main) passes. So do `node --test engine/people-*.test.mjs` (31 tests) and `node engine/build.mjs`.
