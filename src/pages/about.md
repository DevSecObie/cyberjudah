---
title: About
description: What CyberJudah is, where the text and the notes come from, and how to report a correction
---

# About

CyberJudah is a study library built around one idea: that a passage and everything taught from
it belong on the same page. The scripture, the class notes, the daily reading, the handbook of
law, the precepts and the case studies are all one linked corpus rather than separate archives,
so a citation in a class can be followed into the chapter it came from, and a chapter lists
every note, law, precept and case that cites it.

## What is here

| | |
| --- | --- |
| [The scripture](/bible) | King James Version (1769) with the Apocrypha. 81 books, every chapter on its own page, every verse on its own anchor. |
| [4 Chapters a Day](/study) | Notes from the daily reading, in the order the books are read. The coverage map on that page shows how far the plan has come. |
| [Sabbath class notes](/classes/browse) | The classes written up in full, with the scriptures quoted where they were opened. |
| [15 Minutes w/ The Captains](/captains/browse) | Short weekday teachings, one subject at a time. |
| [Encyclopedia](/encyclopedia) | Standing subjects gathered from across the notes. |
| [The Law](/law), [Precepts](/precepts), [Cases](/cases) | The handbook of Bible law, the precept index, and judgments recorded in scripture with the law each one broke. |
| [Concordance](/concordance) | Chapter by chapter, everything that cites it. [Classes by book](/classes/by-book) reads the same graph the other way. |
| [API](/api), [Downloads](/downloads) | The whole library as static JSON, and as an Obsidian vault. |

## The text

The Bible text is the public-domain King James Version of 1769, with the Apocrypha, and is
reproduced without alteration. Cross references come from a public-domain Treasury of Scripture
Knowledge lineage, and the parallel translation in the reader is the World English Bible, also
public domain.

## The notes

Class and episode notes are written up from the recordings. They are not verbatim transcripts:
they are the class in continuous prose, with every scripture that was opened quoted in place
from our own KJV text and linked back into the chapter. Where a note carries a recording, the
timestamp beside each passage links into the video at the moment it was read.

The teacher is recorded only where the class itself says who taught it. Most do not, and those
are left blank rather than guessed at — the notes are full of people who are greeted, prayed
for or quoted without teaching anything. Notes with no teacher recorded are filterable as
"Not recorded" on the [browse page](/classes/browse).

Topic tags are derived from the text of each note against a controlled vocabulary
(`data/topics.tsv` in the repository) and are meant for finding classes, not for classifying
doctrine.

### Dates marked "date estimated"

Many recordings carry no reliable date. Where the date shown is inferred — from the Sabbath it
falls on, from announcements made in the class, from the events referred to, or from its place
in the upload order — the note says **(date estimated)** under the title, and the browse page
marks it with a ≈. A date without that mark is taken from the source. Estimated dates are
ordering information, not a claim about the calendar.

## Corrections

Everything here is in the open. If a passage is misquoted, a date is wrong, a class is
misattributed or a link is broken, the fix is welcome:

- [Open an issue](https://github.com/DevSecObie/cyberjudah/issues) on the repository, or
- Edit the note directly — each class and study note has an edit link, and the markdown is the
  source of record for the site.

## Building it

The scripture pages, the law, the precepts, the cases, the concordance, the API and the search
index are all generated from the committed notes and data on every build. Only the notes
themselves are hand-written. See the repository at
[DevSecObie/cyberjudah](https://github.com/DevSecObie/cyberjudah).
