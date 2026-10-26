# claude/project-thread-o4jjmr

The People relationships now follow the King James text. Family links that the KJV does not state were taken out of `data/people/people.json` (120 links, both sides of each). Matthew 1:15's "Matthan begat Jacob" now reads as written.

## Why
Obie asked that the relations follow the KJV 1611 Bible and its lines. The family links come from STEPBible's TIPNR. TIPNR fills some gaps from tradition and from scholars' guesses, such as Naamah as Noah's wife or Zeresh as the mother of Haman's ten sons. The app then showed those guesses as Bible facts on each person's Relationships graph.

## How it was checked
Every one of the 4,790 links in the catalog was checked against the KJV text in `data/bible/`:

1. 2,990 links have a verse that names both people, and 1,263 more are brothers and sisters through a parent they share. Of the 2,990, 192 sit in a verse with no family word. All 192 were read: they are brothers listed together in a list of sons, so they stay.
2. 444 links name the two people a few verses apart. All of them were read with their verses.
3. 93 links have no verse that names both. All of them were read.

A link stays when the KJV states it, or when it follows from what the KJV states. For example, Josiah's wife Zebudah follows from "Eliakim the son of Josiah" and "his mother's name was Zebudah" (2 Kings 23:34-36). A link was taken out when the text does not say it.

## What was taken out, and why
- **Naamah (Genesis 4:22)** is no longer Noah's wife or the mother of Shem, Ham and Japheth. The KJV never names Noah's wife.
- **Matthew 1:15:** TIPNR put nine unnamed generations between Matthan and Jacob. The verse says "Matthan begat Jacob", so the link is restored and the nine records are deleted.
- **Mothers the text does not name:**
  - Zeresh for Haman's ten sons (Esther 9:7-10).
  - Ahinoam for Saul's children (1 Samuel 14:49-50; 2 Samuel 2:8).
  - Jezebel for Ahaziah, Athaliah and "Joash the king's son" (1 Kings 22:26, 40; 2 Kings 8:26).
  - Vashti for Artaxerxes and Darius.
  - Nahash for Jesse's sons and Zeruiah, and Nahash as Jesse's wife. 2 Samuel 17:25 names only Abigail as "the daughter of Nahash".
  - Achsah for Hathath and Meonothai.
  - Abi for Maaseiah.
  - Jehosheba for Zechariah son of Jehoiada.
  - Jerioth for Mesha.
  - Tahpenes for Pharaoh's daughter.
  - Maachah, Machir's wife, for Gilead, Hammoleketh and "the daughter of Machir".
  - Maacah, David's wife, for Tamar.
  - Lot's wife for Lot's daughters.
  - Ephratah for Ram.
  - Shecaniah's daughter for Johanan son of Tobiah.
- **Fathers the text does not name:**
  - Ahab for "Joash the king's son".
  - Ahaz for "Maaseiah the king's son".
  - Jonathan for Zechariah's "brethren" (Nehemiah 12:35-36).
  - Caleb for the sons of Jahdai, and Jahdai as Caleb's wife (1 Chronicles 2:47).
  - Othniel for Meonothai.
  - Elah for Jehaleleel.
  - Coz for Jabez.
  - "The giant" (Rapha) for Goliath and Lahmi.
  - Geber for Ben-geber.
  - Jesse for Elihu ("one of the brethren of David").
  - Salma for Elimelech.
  - Ishbah for the Garmite, and Hodiah as Ishbah's wife.
- **Hur, 1 Chronicles 2:50-51:** "These were the sons of Caleb the son of Hur": Shobal, Salma and Hareph are sons of Caleb. They are no longer Hur's sons.
- **Tradition from outside the KJV:**
  - Heli as the father of Mary and of Salome, and Heli's wife as their mother and Elisabeth's sister.
  - Alphaeus as the son of Jacob, and as the father of Joses.
  - Mary, mother of James and Joses, as the mother of Matthew.
  - Mary, mother of John Mark, as Barnabas's sister.
  - Herod's family: Agrippa as the son of Herod (Acts 12), Herodias as Herod's sister, Herod the tetrarch and both Philips as sons of Herod the Great, and Philip as the father of Herodias' daughter.
  - Pyrrhus as Sopater's father (not in the KJV's Acts 20:4).
  - Ahlai as the daughter given to Jarha (1 Chronicles 2:31-35).
  - Absalom's daughter Tamar as Maachah's mother and Uriel's wife.
  - Ahasuerus of Ezra 4:6 as the son of Darius and the father of Artaxerxes.
  - Eli's descent from Ithamar, through four unnamed priests.
  - Ahinoam's son Ish-bosheth.
  - Lot's daughters as his "wives".
  - Jerimoth as one of David's sons born of the Jerusalem wives.

## Left for the owner
These records join two or more KJV names into one person: Abiel with Jehiel and Ner; Jeaterai with Ethni; Jahath with Jehiel. The links inside each record follow from that joining. Splitting them is a separate change. The daughter of Herodias is named "Salome" only outside the KJV, and her record carries no name.

`node engine/check.mjs` (with `PEOPLE_BASE` set to main) passes, and so do `node --test engine/people-*.test.mjs` (28 tests).
