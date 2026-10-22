# claude/project-thread-6w7nw1

Corrects 52 copying errors in the Apocrypha text, starting with 2 Esdras 2:18, which read "Esau and Jeremy" where the King James text has "Esay and Jeremy" (Esay is Isaiah).

## Why
The Bible text in `data/bible/` was imported in August 2026 from Obie's Obsidian vault (`scripts/import_bible.py`, since removed). The vault's Apocrypha carried errors that look like OCR or retyping slips: dropped words, doubled words ("the the"), and swapped letters ("Godly" for "ungodly", "Sake" for "Make", "car" for "ear", "Isreal"). A class already caught one of them: in elNEB8tpb-c the teacher says "on the computer it'll say Esau, but that's wrong. It's Isaiah."

## How it was checked
Every verse of all 80 books was compared word by word with the eBible.org King James Version with Apocrypha (USFM edition of 2009-10-14, the 1769 standard text). The 66 books show no wording errors, only spelling style (Judea/Judaea, Cesar/Caesar). In the Apocrypha, each verse that differed was then checked against a transcription of the 1611 printing (github.com/aruljohn/Bible-kjv-1611). A verse was changed only where the 1611 reading agrees with the correction. 2 Esdras 2:18 was also checked against the photographed 1611 Barker printing at the University of Pennsylvania (archive.org item Bible1611, image n1025): "my seruants Esay and Ieremie".

Left unchanged on purpose: places where the app already matches 1611 and the 1769 file has its own typo, Judith 13:2 "lying along" (1611 has it), Sirach 33:16 "trod" (1611 "filled", 1769 "tred": asked Obie), 2 Maccabees 9:5 "or as soon as" (1611 "for as soone", but both 1769 copies say "or": asked Obie), and the Prayer of Manasseh's verse numbering (14 verses here, 15 in eBible).

## What
- `data/bible/*.json`: 52 corrections in 11 books (table below).
- 70 class and study notes: the same correction in the verse quotes the notes embed from the Bible text (`> <sup>[v](/bible/...)</sup>` lines only). Seven notes that open PRs also edit, and the precept passes in `data/precepts/`, are left for a follow-up so no two PRs touch the same file. The teacher's own words are not changed anywhere.

| Verse | Was | Now |
|---|---|---|
| Judith 11:13 | firstfruits of the the tenths | firstfruits of the corn, and the tenths |
| Judith 12:15 | of Bagoas far her | of Bagoas for her |
| Judith 13:2 | was left along in the tent | was left alone in the tent |
| Esther (Greek) 13:11 | all things, and and there | all things, and there |
| Esther (Greek) 15:10 | though our our commandment | though our commandment |
| Esther (Greek) 15:11 | And so be held | And so he held |
| Wisdom of Solomon 5:14 | hope of the Godly | hope of the ungodly |
| Sirach 11:18 | this his the portion | this is the portion |
| Sirach 16:24 | by son, hearken | My son, hearken |
| Sirach 19:1 | man that A is given | man that is given |
| Sirach 31:16 | devour note, | devour not, |
| Sirach 36:8 | Sake the time short | Make the time short |
| Sirach 38:20 | and member the last end | and remember the last end |
| Sirach 51:3 | multitude of they mercies | multitude of thy mercies |
| Baruch 1:8 | king of Jada had made | king of Juda had made |
| Baruch 3:2 | art thou art merciful | for thou art merciful |
| Epistle of Jeremiah 1:5 | neither be ye and of them | neither be ye afraid of them |
| Epistle of Jeremiah 1:59 | in a a palace | in a palace |
| Epistle of Jeremiah 1:71 | that is east into the dark | that is cast into the dark |
| Song of the Three Children 1:66 | for ever: far he hath delivered | for ever: for he hath delivered |
| Bel and the Dragon 1:18 | opened the dour | opened the door |
| Bel and the Dragon 1:41 | Great art Lord God of Daniel | Great art thou, O Lord God of Daniel |
| 1 Maccabees 1:7 | reigned twelves years | reigned twelve years |
| 1 Maccabees 1:63 | Wherefore the rather to die | Wherefore they chose rather to die |
| 1 Maccabees 5:60 | Joseph and Azaras | Joseph and Azarias |
| 1 Maccabees 5:64 | Insomuch as the the people | Insomuch as the people |
| 1 Maccabees 8:1 | heard of the the Romans | heard of the fame of the Romans |
| 1 Maccabees 9:6 | army to he so great | army to be so great |
| 1 Maccabees 10:63 | and said into his princes | and said unto his princes |
| 1 Maccabees 10:72 | is not able to to flight in their own land | is not able to stand before our face; for thy fathers have been twice put to flight in their own land |
| 1 Maccabees 10:87 | having any spoils | having many spoils |
| 1 Maccabees 12:16 | Antipater he son of Jason | Antipater the son of Jason |
| 2 Maccabees 3:15 | things given to he kept | things given to be kept |
| 2 Maccabees 3:37 | And when the king Heliodorus | And when the king asked Heliodorus |
| 2 Maccabees 4:18 | used every faith year | used every fifth year |
| 2 Maccabees 5:11 | came to the king’s car | came to the king’s ear |
| 2 Maccabees 5:19 | but the place far the people’s sake | but the place for the people’s sake |
| 2 Maccabees 6:10 | the babes handing at | the babes hanging at |
| 2 Maccabees 6:17 | that we at spoken | that we have spoken |
| 2 Maccabees 7:7 | after this number | after this manner |
| 2 Maccabees 7:27 | gave thee such three years | gave thee suck three years |
| 2 Maccabees 9:5 | the God of Isreal | the God of Israel |
| 2 Maccabees 11:1 | Not long after the, | Not long after this, |
| 2 Maccabees 15:36 | celebrate the thirtieth day | celebrate the thirteenth day |
| 2 Esdras 1:2 | the son of And he spake unto the of Borith | the son of Arna, the son of Ozias, the son of Borith |
| 2 Esdras 2:1 | by menservants the prophets | by my servants the prophets |
| 2 Esdras 2:18 | my servants Esau and Jeremy | my servants Esay and Jeremy |
| 2 Esdras 5:1 | Nevertheless as coming the tokens | Nevertheless as concerning the tokens |
| 2 Esdras 5:53 | born in the the strength | born in the strength |
| 2 Esdras 6:42 | six pats hast | six parts hast |
| 2 Esdras 12:34 | from the the beginning | from the beginning |
| 2 Esdras 13:38 | which is like unto me. | which is like unto fire. |
