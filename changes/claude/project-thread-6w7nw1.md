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

## Follow-up: the same corrections in notes and precept passes
The corrections above also apply where notes and precept passes quote those verses. This follow-up fixes the seven notes that open PRs held at the time and the scripture quotes in `data/precepts/why.json`. The nine precept passes that quote these verses get one PR each, as the check requires. Every change is inside a quotation of the verse, or is the KJV name "Azarias". `data/precepts/classes/elNEB8tpb-c.json` is not touched, because there the teacher himself says the computer wrongly reads "Esau" for Isaiah. Caption transcripts are not touched.

## Apocrypha text now follows the Pure Cambridge Edition (1900)
Obie asked for the Apocrypha to follow the scan "APOCRYPHA KJV (PCE 1900)" (archive.org item `apocrypha-kjv-pce-1900`). Every Apocrypha verse in `data/bible/` was compared word by word with that scan. A word was changed only when the PDF's own text layer agreed with at least one of two separate OCR readings of the page. Where the scan seemed to lack a word, the page image was checked, because OCR drops short words at the start of a line; five such spots were left alone. Punctuation was not compared, since OCR punctuation is not reliable. Verse quotes that notes embed from the Bible text, and the quotes in `data/precepts/why.json`, were updated to match. Precept passes that quote these verses are not touched here (one pass per PR).

The changes include the edition's spellings (Artaxerxes, Joppe, Gazara, Sidon, alway, stedfast, inquire, leddest, honour, counseller), real wording errors in the old text (Judith 7:14 fire → famine, Judith 11:10 respect → reject, 2 Maccabees 6:6-7 fasts → feasts, 2 Maccabees 8:7 fruit of his holiness → bruit of his manliness, 1 Maccabees 5:3 Gael → Israel, Sirach 33:16 trod → filled, 2 Maccabees 9:5 or → for), and dropped or extra words (2 Esdras 14:4 "mount of Sinai", Tobit 14:3 "the six sons", Sirach 49:15 "a man born like unto Joseph").

| Verse | Was | Now |
|---|---|---|
| 1 Esdras 1:40 | carried him into Babylon. | carried him unto Babylon. |
| 1 Esdras 1:48 | his neck, his heart, | his neck, and his heart, |
| 1 Esdras 2:16 | time of Artexerxes king of | time of Artaxerxes king of |
| 1 Esdras 2:17 | To king Artexerxes our lord, | To king Artaxerxes our lord, |
| 1 Esdras 2:18 | the lord king, that | the lord the king, that |
| 1 Esdras 2:18 | that are up from | that are come up from |
| 1 Esdras 2:27 | that mighty kings and fierce | that mighty king and fierce |
| 1 Esdras 2:30 | Then king Artexerxes his letters | Then king Artaxerxes his letters |
| 1 Esdras 5:55 | them of Zidon also and | them of Sidon also and |
| 1 Esdras 5:55 | haven of Joppa, according as | haven of Joppe, according as |
| 1 Esdras 6:25 | and the expences thereof to | and the expenses thereof to |
| 1 Esdras 7:4 | Darius, and Artexerxes, kings of | Darius, and Artaxerxes, kings of |
| 1 Esdras 8:1 | things, when Artexerxes the king | things, when Artaxerxes the king |
| 1 Esdras 8:5 | of the priest of the | of the priests of the |
| 1 Esdras 8:6 | reign of Artexerxes, in the | reign of Artaxerxes, in the |
| 1 Esdras 8:8 | written from Artexerxes the king, | written from Artaxerxes the king, |
| 1 Esdras 8:9 | King Artexerxes unto Esdras | King Artaxerxes unto Esdras |
| 1 Esdras 8:19 | I king Artexerxes have also | I king Artaxerxes have also |
| 1 Esdras 8:26 | and his counsellors, and all | and his counsellers, and all |
| 1 Esdras 8:28 | of king Artexerxes: | of king Artaxerxes: |
| 1 Esdras 8:39 | them, Eliphalet, Jewel, and Samaias, | them, Eliphalet, Jeuel, and Samaias, |
| 1 Esdras 8:67 | the king’s stewards’ and to | the king’s stewards and to |
| 1 Esdras 9:29 | sons of Babai; Johannes, and | sons of Bebai; Johannes, and |
| 1 Esdras 9:40 | to hear law in | to hear the law in |
| 1 Esdras 9:41 | women; and the multitude | women; and all the multitude |
| 1 Esdras 9:48 | and Calitas, Asrias, and Joazabdus, | and Calitas, Azarias, and Joazabdus, |
| 2 Esdras 1:3 | reign of Artexerxes king of | reign of Artaxerxes king of |
| 2 Esdras 1:9 | forbear them, into whom I | forbear them, unto whom I |
| 2 Esdras 1:15 | a token to you; I | a token for you; I |
| 2 Esdras 1:38 | people that come from the | people that cometh from the |
| 2 Esdras 2:24 | thy quietness still come. | thy quietness shall come. |
| 2 Esdras 3:6 | And thou leadest him into | And thou leddest him into |
| 2 Esdras 3:17 | when thou leadest his seed | when thou leddest his seed |
| 2 Esdras 3:34 | balance, and their’s also that | balance, and theirs also that |
| 2 Esdras 3:34 | that dwell the world; | that dwell in the world; |
| 2 Esdras 4:2 | hath gone to far in | hath gone too far in |
| 2 Esdras 5:13 | and fast even days, thou | and fast seven days, thou |
| 2 Esdras 5:36 | together the dross that are | together the drops that are |
| 2 Esdras 5:52 | Wherefore are unto they whom | Wherefore are not they whom |
| 2 Esdras 8:30 | them that always put their | them that alway put their |
| 2 Esdras 8:35 | in truth them is no | in truth there is no |
| 2 Esdras 8:46 | things to cometh for such | things to come for such |
| 2 Esdras 8:59 | things aforesaid shalt receive you, | things aforesaid shall receive you, |
| 2 Esdras 9:6 | beginnings in wonder and powerful | beginnings in wonders and powerful |
| 2 Esdras 9:11 | that have loathed my law, | that have lothed my law, |
| 2 Esdras 9:13 | when: but enquire how the | when: but inquire how the |
| 2 Esdras 10:48 | have a fail, and died: | have a fall, and died: |
| 2 Esdras 10:59 | dwell upon the earth in | dwell upon earth in |
| 2 Esdras 12:18 | peril of failing: nevertheless it | peril of falling: nevertheless it |
| 2 Esdras 12:34 | have been pressed upon my | have been preserved upon my |
| 2 Esdras 13:12 | Afterward saw I | Afterward I saw the |
| 2 Esdras 13:12 | Afterward saw I the same | I saw the same |
| 2 Esdras 13:13 | were sorry, and some of | were sorry, some of |
| 2 Esdras 13:43 | the narrow places of the | the narrow passages of the |
| 2 Esdras 14:4 | mount of where I | mount of Sinai where I |
| 2 Esdras 14:18 | For the time is fled | For the truth is fled |
| 2 Esdras 14:21 | or the work that shall | or the works that shall |
| 2 Esdras 14:45 | days were filled, that the | days were fulfilled, that the |
| 2 Esdras 15:15 | stand up and fight against | stand up to fight against |
| 2 Esdras 15:32 | shall be troubled bled, and keep | shall be troubled, and keep |
| 2 Esdras 15:40 | shall be puffed up full | shall be lifted up full |
| 2 Esdras 15:47 | which have always desired to | which have alway desired to |
| 2 Esdras 15:50 | a flower, the heat | a flower, when the heat |
| 2 Esdras 16:20 | nor be always mindful of | nor be alway mindful of |
| 2 Esdras 16:38 | her son, with two or | her son, within two or |
| 2 Esdras 16:40 | ready to thy battle, and | ready to the battle, and |
| Tobit 1:3 | in the ways of truth | in the way of truth |
| Tobit 2:10 | whiteness came in mine eyes: | whiteness came into mine eyes: |
| Tobit 4:10 | death, and suffereth not to | death, and suffer not to |
| Tobit 4:20 | this to they that I | this to thee that I |
| Tobit 10:4 | began to wail him, and | began to bewail him, and |
| Tobit 10:12 | special trust; where are do not | special trust; wherefore do not |
| Tobit 11:11 | on his fathers’ eyes, saying, | on his father’s eyes, saying, |
| Tobit 11:17 | But Tobias gave thanks | But Tobit gave thanks |
| Tobit 14:3 | and the sons of | and the six sons of |
| Judith 2:7 | declare unto that they | declare unto them that they |
| Judith 2:20 | number also sundry countries | number also of sundry countries |
| Judith 4:11 | man and women, and the | man and woman, and the |
| Judith 5:18 | was not their’s, and the | was not theirs, and the |
| Judith 5:20 | any error against this people, | any error in this people, |
| Judith 6:2 | hast prophesied against us as | hast prophesied among us as |
| Judith 6:9 | they shall be taken, | they shall not be taken, |
| Judith 7:14 | consumed with fire, and before | consumed with famine, and before |
| Judith 8:8 | ill word; as she feared | ill word; for she feared |
| Judith 8:34 | But enquire not ye | But inquire not ye |
| Judith 11:10 | and governor, respect not his | and governor, reject not his |
| Judith 11:10 | neither can sword prevail | neither can the sword prevail |
| Judith 11:15 | be given to thee to | be given thee to |
| Judith 12:20 | and drank more wine | and drank much more wine |
| Judith 13:5 | to execute thine enterprizes to | to execute mine enterprizes to |
| Esther (Greek) 11:2 | reign of Artexerxes the great, | reign of Artaxerxes the great, |
| Esther (Greek) 11:8 | uproar, upon earth. | uproar, upon the earth. |
| Esther (Greek) 12:2 | hands upon Artexerxes the king; | hands upon Artaxerxes the king; |
| Esther (Greek) 13:1 | great king Artexerxes writeth these | great king Artaxerxes writeth these |
| Esther (Greek) 13:1 | princes and governours that are | princes and governors that are |
| Esther (Greek) 13:2 | carrying myself always with equity | carrying myself alway with equity |
| Esther (Greek) 13:3 | will and steadfast fidelity, and | will and stedfast fidelity, and |
| Esther (Greek) 14:14 | no other help but thee. | no other helper but thee. |
| Esther (Greek) 15:1 | ended her prayers, she laid | ended her prayer, she laid |
| Esther (Greek) 16:1 | great king Artexerxes unto the | great king Artaxerxes unto the |
| Esther (Greek) 16:11 | of all the next | of all men as the next |
| Wisdom of Solomon 4:4 | standing not last, they shall | standing not fast, they shall |
| Wisdom of Solomon 7:23 | to man, steadfast, sure, free | to man, stedfast, sure, free |
| Wisdom of Solomon 10:10 | in his travels, and multiplied | in his travails, and multiplied |
| Wisdom of Solomon 10:12 | know that goodness is stronger | know that godliness is stronger |
| Wisdom of Solomon 11:14 | whom they respected with scorn, | whom they rejected with scorn, |
| Wisdom of Solomon 12:12 | whom thou made? or | whom thou hast made? or |
| Wisdom of Solomon 13:10 | hope, who call them gods, | hope, who called them gods, |
| Wisdom of Solomon 17:21 | which should afterward receive them: | which should afterwards receive them: |
| Wisdom of Solomon 18:9 | should be like partakers of | should be alike partakers of |
| Wisdom of Solomon 18:22 | word subdued him that | word subdued he him that |
| Sirach 1:19 | knowledge of understanding standing, and exalteth | knowledge of understanding, and exalteth |
| Sirach 1:23 | man will tear for a | man will bear for a |
| Sirach 3:21 | not out things that | not out the things that |
| Sirach 4:16 | and his generation shall hold | and his generations shall hold |
| Sirach 6:6 | but one counsellor of a | but one counseller of a |
| Sirach 6:14 | A faithfull friend is | A faithful friend is |
| Sirach 7:31 | Lord, and honor the priest; | Lord, and honour the priest; |
| Sirach 9:7 | the solitary place thereof. | the solitary places thereof. |
| Sirach 10:20 | chief is honorable; so are | chief is honourable; so are |
| Sirach 11:17 | with the ungodly, and his | with the godly, and his |
| Sirach 13:21 | is thrust away by | is thrust also away by |
| Sirach 16:19 | the earth be shaken | the earth shall be shaken |
| Sirach 20:13 | words maketh him beloved: but | words maketh himself beloved: but |
| Sirach 27:13 | sport is the wantonness | sport is in the wantonness |
| Sirach 27:21 | he that betrayeth secrets is | he that bewrayeth secrets is |
| Sirach 33:12 | of them he sanctified, | of them hath he sanctified, |
| Sirach 33:16 | profited, and trod my winepress | profited, and filled my winepress |
| Sirach 42:25 | the good or another: and | the good of another: and |
| Sirach 43:5 | his commandment runneth hastily. | his commandment it runneth hastily. |
| Sirach 43:13 | to fall aplace, and sendeth | to fall apace, and sendeth |
| Sirach 44:4 | and eloquent are their instructions: | and eloquent in their instructions: |
| Sirach 45:4 | in his faithfuless and meekness, | in his faithfulness and meekness, |
| Sirach 46:1 | the son a Nave was | the son of Nave was |
| Sirach 48:6 | destruction, and honorable men from | destruction, and honourable men from |
| Sirach 48:8 | Who annointedst kings to | Who anointedst kings to |
| Sirach 48:9 | Who was taken up | Who wast taken up |
| Sirach 49:15 | there a young man born | there a man born |
| Sirach 49:15 | born like Joseph, a | born like unto Joseph, a |
| Sirach 49:16 | thing in creation. | thing in the creation. |
| Sirach 51:2 | helper, and has preserved my | helper, and hast preserved my |
| Sirach 51:11 | will sing praises with thanksgiving; | will sing praise with thanksgiving; |
| Sirach 51:12 | and bless they name, O | and bless thy name, O |
| Sirach 51:17 | I ascribe glory unto | I ascribe the glory unto |
| Sirach 51:24 | say ye to these things, | say ye of these things, |
| Sirach 51:27 | I have but little | I have had but little |
| Baruch 2:16 | down from thine holy house, | down from thy holy house, |
| Baruch 2:23 | of the cites of Judah, | of the cities of Juda, |
| Baruch 2:23 | cites of Judah, and from | cities of Juda, and from |
| Baruch 2:28 | to write the law before | to write thy law before |
| Baruch 4:21 | and he will deliver you | and he shall deliver you |
| Baruch 4:29 | everlasting joy with your | everlasting joy again with your |
| Epistle of Jeremiah 1:12 | rust and moth, though they | rust and moths, though they |
| Epistle of Jeremiah 1:58 | are strong take, and | are strong do take, and |
| Epistle of Jeremiah 1:68 | under a cover and help | under a covert and help |
| Song of the Three Children 1:12 | thy servant Issac’s sake, and | thy servant Isaac’s sake, and |
| Song of the Three Children 1:22 | thou art God, the only | thou art Lord, the only |
| Song of the Three Children 1:47 | the Lord: bless and exalt | the Lord: praise and exalt |
| Susanna 1:58 | answered, Under an holm tree. | answered, Under a holm tree. |
| Bel and the Dragon 1:3 | Now the Babylons had an | Now the Babylonians had an |
| Prayer of Manasseh 1:12 | condemn me to the lower | condemn me into the lower |
| 1 Maccabees 1:22 | and the crown, and the | and the crowns, and the |
| 1 Maccabees 1:25 | there was a great mourning | there was great mourning |
| 1 Maccabees 2:37 | and earth will testify for | and earth shall testify for |
| 1 Maccabees 3:43 | the decayed fortune of our | the decayed estate of our |
| 1 Maccabees 5:3 | they besieged Gael: and he | they besieged Israel: and he |
| 1 Maccabees 5:35 | he took and slew | he took it and slew |
| 1 Maccabees 5:35 | thereof and and burnt it | thereof and burnt it |
| 1 Maccabees 6:14 | his friends, who he made | his friends, whom he made |
| 1 Maccabees 6:25 | also against their borders. | also against all their borders. |
| 1 Maccabees 6:27 | will do the greater things | will do greater things |
| 1 Maccabees 6:62 | place, he broke his oath | place, he brake his oath |
| 1 Maccabees 7:47 | smote off Nicanors head, and | smote off Nicanor's head, and |
| 1 Maccabees 8:30 | shall think to meet to | shall think meet to |
| 1 Maccabees 8:31 | saying, Wherefore thou made | saying, Wherefore hast thou made |
| 1 Maccabees 9:6 | insomuch as abode of | insomuch as there abode of |
| 1 Maccabees 9:48 | unto the other bank: howbeit | unto the farther bank: howbeit |
| 1 Maccabees 9:50 | the strong cites in Judea; | the strong cities in Judea; |
| 1 Maccabees 9:52 | Bethsura, and Gazera, and the | Bethsura, and Gazara, and the |
| 1 Maccabees 9:69 | the country, inasmuch as he | the country, insomuch as he |
| 1 Maccabees 10:11 | mount Sion and about with | mount Sion round about with |
| 1 Maccabees 10:30 | third part or the seed, | third part of the seed, |
| 1 Maccabees 10:32 | yield up authority over | yield up my authority over |
| 1 Maccabees 10:32 | and give the high | and give it to the high |
| 1 Maccabees 10:35 | meddle with or to | meddle with them or to |
| 1 Maccabees 10:36 | to all king’s forces. | to all the king’s forces. |
| 1 Maccabees 10:43 | the liberties hereof, being indebted | the liberties thereof, being indebted |
| 1 Maccabees 10:54 | and her as according to | and her gifts according to |
| 1 Maccabees 10:75 | they of Joppa shut him | they of Joppe shut him |
| 1 Maccabees 11:2 | was his brother in law. | was his father in law. |
| 1 Maccabees 11:6 | pomp at Joppa, where they | pomp at Joppe, where they |
| 1 Maccabees 11:21 | Then came ungodly persons, | Then certain ungodly persons, |
| 1 Maccabees 12:6 | the other of the | the other people of the |
| 1 Maccabees 12:9 | these things, that we | these things, for that we |
| 1 Maccabees 12:17 | to salute and to | to salute you and to |
| 1 Maccabees 12:42 | Tryphon saw Jonathan came | Tryphon saw that Jonathan came |
| 1 Maccabees 12:44 | hast thou brought all this | hast thou put all this |
| 1 Maccabees 12:53 | round about then sought to | round about them sought to |
| 1 Maccabees 13:11 | power, to Joppa: who casting | power, to Joppe: who casting |
| 1 Maccabees 13:12 | removed from Ptolemaus with a | removed from Ptolemais with a |
| 1 Maccabees 13:40 | court, let then be enrolled, | court, let them be enrolled, |
| 1 Maccabees 14:5 | he took Joppa for an | he took Joppe for an |
| 1 Maccabees 15:28 | Ye withhold Joppa and Gazera; | Ye withhold Joppe and Gazara; |
| 1 Maccabees 15:28 | Joppa and Gazera; with the | Joppe and Gazara; with the |
| 1 Maccabees 15:35 | thou demandest Joppa and Gazera, | thou demandest Joppe and Gazara, |
| 1 Maccabees 15:35 | Joppa and Gazera, albeit they | Joppe and Gazara, albeit they |
| 1 Maccabees 15:35 | we give thee an hundred | we give an hundred |
| 1 Maccabees 15:41 | built up Cedrou, he set | built up Cedron, he set |
| 1 Maccabees 16:1 | John from Gazera, and told | John from Gazara, and told |
| 1 Maccabees 16:2 | ever from my youth unto | ever from our youth unto |
| 1 Maccabees 16:19 | also to Gazera to kill | also to Gazara to kill |
| 1 Maccabees 16:21 | afore to Gazera and told | afore to Gazara and told |
| 2 Maccabees 3:3 | that Seleucus of Asia | that Seleucus king of Asia |
| 2 Maccabees 4:21 | came to Joppa, and from | came to Joppe, and from |
| 2 Maccabees 4:39 | and the fruit thereof was | and the bruit thereof was |
| 2 Maccabees 6:6 | or ancient fasts, or to | or ancient feasts, or to |
| 2 Maccabees 6:7 | when the fast of Bacchus | when the feast of Bacchus |
| 2 Maccabees 6:11 | being discovered by Philip, were | being discovered to Philip, were |
| 2 Maccabees 6:17 | matter in a few words. | matter in few words. |
| 2 Maccabees 6:23 | gray head, whereon was come, | gray head, whereunto he was come, |
| 2 Maccabees 7:38 | brought upon our nation, | brought upon all our nation, |
| 2 Maccabees 8:7 | that the fruit of his | that the bruit of his |
| 2 Maccabees 8:7 | of his holiness was spread | of his manliness was spread |
| 2 Maccabees 8:16 | who came wrongly against them; | who came wrongfully against them; |
| 2 Maccabees 8:18 | the Almighty who at | the Almighty God who at |
| 2 Maccabees 8:21 | for the law and the | for the laws and the |
| 2 Maccabees 8:36 | means of captives in | means of the captives in |
| 2 Maccabees 9:5 | invisible plague: or as soon | invisible plague: for as soon |
| 2 Maccabees 10:6 | they kept the eight days | they kept eight days |
| 2 Maccabees 10:11 | appointed him his chief governor | appointed him chief governor |
| 2 Maccabees 10:30 | every side weapons, and | every side with their weapons, and |
| 2 Maccabees 10:32 | hold, called Gawra, where Chereas | hold, called Gazara, where Chereas |
| 2 Maccabees 11:7 | exhorting the other that they | exhorting the others that they |
| 2 Maccabees 12:2 | of the governours of several | of the governors of several |
| 2 Maccabees 12:15 | who without rams or | who without any rams or |
| 2 Maccabees 13:22 | them in Bethsum the second | them in Bethsura the second |
| 2 Maccabees 13:22 | hand, took their’s, departed, fought | hand, took theirs, departed, fought |
| 2 Maccabees 14:6 | Jews that he called Assideans, | Jews that be called Assideans, |
| 2 Maccabees 14:6 | let the rest be in | let the realm be in |
| 2 Maccabees 14:24 | for he love the man | for he loved the man |
| 2 Maccabees 15:18 | brethren, and folks, was in | brethren, and kinsfolks, was in |
| 2 Maccabees 15:31 | there, and called them | there, and had called them |
