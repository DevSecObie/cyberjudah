# Historical reference library for biblical and Apocrypha people

Status: source catalog, not an assertion that every person has been verified.
Created: 2026-10-27. Scope: CyberJudah people catalog, 1–2 Esdras, Maccabees, Tobit, Judith, Sirach and parallel KJV passages.

## Source priority
1. KJV with Apocrypha: exact reading and verse; never silently normalize variants.
2. Ancient primary witnesses: record author, work, book/chapter/section, translation and any disagreement.
3. Specialist textual criticism and scholarly commentaries: assess manuscript readings and parallel lists.
4. Historical encyclopedias: leads and corroboration, not independent proof.
5. Wikipedia/Wikidata: discovery only; verify against cited underlying sources.

## Catalog

| ID | Work | Author/editor | Type | Access | Use | Rights/notes |
|---|---|---|---|---|---|---|
| JOSEPHUS-ANT | Antiquities of the Jews | Flavius Josephus; William Whiston translation | Ancient historical narrative | https://www.gutenberg.org/ebooks/2848 | Books XI–XIII: Persian period, Maccabees, Hasmonean genealogy; XIV onward: later rulers | Whiston translation public domain in US; record book/chapter/section |
| JOSEPHUS-WAR | The Jewish War | Flavius Josephus | Ancient historical narrative | https://josephus.org/home.htm | Hasmonean and Roman-era history | Check specific edition/translation before copying |
| JE-1906 | The Jewish Encyclopedia (1901–1906) | Isidore Singer et al. | Historical encyclopedia | https://www.jewishencyclopedia.com/ | Names, genealogies, priestly divisions, geography | US public-domain original; scholarship is dated |
| BRIT-1911 | Encyclopaedia Britannica, 11th ed. | Various | Historical encyclopedia | https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Maccabees | Maccabean chronology and historical names | Public-domain historical reference; dated |
| OXFORD-COMM | The Oxford Bible Commentary | John Barton and John Muddiman, eds. | Modern scholarly commentary | https://global.oup.com/ | 1 Esdras, Apocrypha textual and literary context | Bibliographic reference only; check license |
| OXFORD-HIST | The Oxford Handbook of the Historical Books of the Hebrew Bible | Brad E. Kelle and Brent A. Strawn, eds. | Modern academic handbook | https://academic.oup.com/ | Textual issues in Ezra–Nehemiah / 1 Esdras | Bibliographic reference only; check license |
| UBS-ESDRAS | A Handbook on 1–2 Esdras | Roger A. Bullard and Howard A. Hatton | Translation and textual reference | https://tips.translation.bible/tip_source/bullard-hatton-ubs-helps-for-translators-2019/ | Greek name variants and passage alignment | Link only unless reuse licensed |
| SOTS | Society for Old Testament Study Wiki | SOTS contributors | Scholarly reference portal | https://www.sots.ac.uk/wiki/ | Contextual research and further bibliography | Evaluate articles individually |
| WIKIDATA | Wikidata | Community contributors | Discovery index | https://www.wikidata.org/ | Alternate names, identifiers, external references | Never treat unsourced identity merges as proven |
| WIKIPEDIA | Wikipedia | Community contributors | Discovery encyclopedia | https://en.wikipedia.org/ | Bibliography and variant spellings | Follow citations to primary/scholarly works |

## Person-level evidence contract

For each proposed identification or relationship, capture:
- `person_id`, `display_name`, `source_name`, `name_variant`
- `claim_type`: alias, same-person, parent, ancestor, tribe, priestly-division, title, event
- `source_id`, `exact_locator` (book/chapter/section or article), `url`
- `evidence_class`: scripture-explicit, scripture-parallel, ancient-historical, modern-scholarship, unresolved
- `confidence`: confirmed, probable, disputed, unresolved
- `explanation`, `contradicting_evidence`, `review_status`

No generational steps should be invented. A priestly lineage may link a named ancestor without asserting an immediate father-son edge. A title is not a personal alias by default. A parallel list position alone is not sufficient for an irreversible person merge. Preserve KJV textual readings even when a different manuscript has a better-known name.

## First audit queue
1. 1 Esdras 5:8 Reelius vs. Reelaiah/Raamiah/Bigvai; compare Ezra 2:2 and Nehemiah 7:7.
2. 1 Esdras 9:31–34 family headings against Ezra 10:30–34.
3. 1 Esdras 9:49 Attharates / Tirshatha as a title for Nehemiah.
4. Mattathias, John, Simeon and Joarib: distinguish explicit father links from priestly-line descent.
5. Antiochus III/IV, Ptolemy VI, Demetrius II: attach ancient and modern historical locators.
6. 2 Esdras 6:49–52: preserve the KJV reading “Enoch” as a creature, record Behemoth as a textual variant, do not merge with Enoch son of Jared.

This file is a research bibliography and data specification, not a completed import of full texts or a verified 371-name identity audit.
