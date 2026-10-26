# claude/project-thread-o4jjmr (classes that name a person)

Each person's API page (`/api/people/<id>.json`) now has a `classes` list: the class notes that read or cite a King James verse naming that person, newest first. Each row gives the note's title, link, kind (class, 15 Minutes, Hidden History), collection, date, and the verse with its link.

## Why
Obie: "The Classes and the KJV Bible need to be the focus of the people data." Until now a person's page only showed precept-pass comments on their verses. Obie chose to also list the class notes that speak of them.

## How a class is matched
A note counts when it links one of the person's verses (from `data/people/people.json`), and the same paragraph carries one of the person's names. That paragraph is either the quoted verse itself or the teacher's words around the reference. Study notes and the encyclopedia are left out, since they are not classes. Result: 1,252 people, 9,094 class links. A random sample of 12 was read by hand, and each was a class reading or citing a verse that names that person.

TIPNR files the nation under its father: "Israel" is Jacob, and "Judah" is the son of Leah. So Jacob lists 558 classes and Judah 336, many of them about the nation.

## Also
Adam and Eve were listed as brother and sister. The KJV does not say that, so the link is taken out. She stays his wife.
