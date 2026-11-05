- Verse commentary, precepts and class moments now name each teacher in the spelling data/names.tsv gives, as the class pages do. The per-passage teachers (data/precepts/teachers.json) and the precept passes of recordings without notes kept caption spellings: 735 passages read "Deacon Yashua", "Captain Yuri", "Captain Yadain", "Deacon Laba", "Captain Karaz", "Captain Gedaliyah" and others, while the class page of the same class names Deacon Yoshua, Captain Uri, Captain Yadon, Deacon Labachaa, Captain Karataza, Captain Gedaliah.
- data/names.tsv: four caption spellings found only in one class each, whose class page names the teacher: Captain Yadiah (Captain Yadayah, Perilous Times 2026-07-11), Captain Tazowan (Captain Tazayawan, Called to Magnify the Law 2026-05-09), Captain Reier (Captain Aryeh, Kill or Be Killed 2025-12-20), Captain Palu (Captain Pallu, Character & Integrity 2026-05-23).
- engine/passage-teachers.test.mjs: no caption spelling reaches a verse, and the men the names list keeps apart (Mattathias, Matthew and Matt; Malachi and Malachiyah; Yadin and Yadon; Zakai and Captain Zakar) are never folded together.

## Class credits follow the class artwork

- `data/sources/class-teachers.tsv` now credits 695 classes from IUICintheClassRoom and IUICintheclassroom Two with the teacher named on each class's thumbnail artwork: 648 that had no credit or a caption fragment, 14 where the artwork names a different or second teacher, and 33 where the lettering was small or in script.
- Radio co-host lists are not credits: shows with a host and co-hosts are credited to the host.
- New test `engine/thumbnail-credits.test.mjs`: every credit is a rank and a name, and five classes keep the teacher their artwork names.
