# Writing a class or episode note

Helpers for turning an IUIC video into a note under `blog/` (Sabbath classes) or
`captains/` (15 Minutes w/ The Captains). They exist so scripture is never typed by
hand: every quoted verse is pulled from `data/bible` and checked back against it.

Run them from the repo root. `CJ_ROOT` overrides the repo location if you need it.

| script | what it does |
|---|---|
| `v.py "Isaiah 54:1-4"` | Print a reference as note markdown. Exits non-zero if the reference does not resolve, so it doubles as a pre-flight check on every scripture in an episode. |
| `condense.py <in> <out>` | Collapse a per-line timestamped transcript into ~700-char timestamped paragraphs, which is what you actually read. |
| `lib.py` | `S(ref, ts, notes)` builds a main scripture block; `P([(ref, note)])` builds a nested precept block. Import it from a builder script. |
| `check.py <note.md>` | Byte-for-byte validation of every quoted verse in a finished note against `data/bible`. Must report 0 mismatches. |

## The note must be near-verbatim, not a summary

This is the part that matters most, and the easiest to get wrong.

- Bullets walk the verse **phrase by phrase in the teacher's own words**. Not your
  analysis of what he taught. If he read a verse and then said three things about it,
  the note has those three things, in his phrasing.
- News clips and videos are **quoted at length**, not digested into a line.
- The thumbnail or opening video is transcribed **verbatim** where there is one.
- "In Closing" is **the teacher's own closing words**, first person.
- 15 Minutes episodes follow the episode's own order rather than a fixed section
  layout: a clip stays where it fell in the teaching.

Word counts for reference: Sabbath class notes run 12,000 to 22,000 words. 15 Minutes
episodes run 2,500 to 5,000.

## Anatomy

Frontmatter, then `<p class="taught">`, `<!-- truncate -->`, the video mount, then the
sections. Every note ends with the nav line.

```
---
title: "GIVE DILIGENCE"
slug: "2026/2026-08-15-give-diligence"
date: "2026-08-15"
teacher: "Captain Zakar"
description: "IUIC in the ClassRoom · 2026-08-15"
tags: ["IUIC in the ClassRoom"]
---

<p class="taught">IUIC in the ClassRoom · 2026-08-15</p>

<!-- truncate -->

<div class="class-video-mount" data-video-id="ABr5bgs96vY"></div>

## Introduction
## In The News          (Sabbath classes only, and only when the class had clips)
## Scriptures Opened
## In Closing
## Announcements & References   (Sabbath classes, when the class had them)

---

[Class Notes Index](/classes) | Transcript: [full session](/classes/2026/2026-08-15-give-diligence)
```

`teacher` is the name with its own title: `Captain Noah`, `Deacon Malachi`,
`Bishop Nathaniel`, `Officer Uzziah`. The browse pages derive the rank from that
leading word and group the filter chips by it. Leave the field out rather than
guessing; an unattributed note simply shows no chip.

File path is `blog/2026/YYYY-MM-DD-<slug-without-date>.md` where the slug itself
already starts with the date, so the date appears twice in the filename. Captains
notes use `captains/2026/` and a nav line reading
`[15 Minutes Index](/captains) | Transcript: [full episode](/captains/<slug>)`.

## Pipeline

1. Fetch the transcript, save it, `condense.py` it.
2. Read the **whole** condensed transcript. Do not skim.
3. Collect every scripture reference and check each one with `v.py` before writing.
4. Write a builder script that imports `lib.py` and emits the note.
5. `check.py` the result. Zero mismatches, or fix and rerun.
6. `npm run build` from the repo root. The build is the link checker
   (`onBrokenLinks: "throw"`), so a bad `/bible/...` link fails it.
7. Commit and push. CI deploys on push to main.
