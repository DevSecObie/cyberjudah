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
| `teachers.py` | Read and edit the `teacher` field across every note. See [Who taught it](#who-taught-it). |
| `lint.py` | Check every note against this spec. `npm run notes:lint`. Runs in CI, so an error fails the deploy. |
| `video.py` | List the notes with no recording; attach one with `video.py set <slug> <url>`. |

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

[Class Notes Index](/classes) · [Watch the full session on YouTube ↗](https://www.youtube.com/watch?v=ABr5bgs96vY)
```

`tags` is the series name first, then topic slugs from `data/topics.tsv`. Do not write
them by hand -- `npm run notes:fix` derives them, adds the `Opens` line under
`<p class="taught">`, and turns each `*[18:01]*` timestamp into a link into the recording.
Run it after writing a note and commit what it produces.

### Who taught it

`teacher` is the name with its own title: `Captain Noah`, `Deacon Malachi`,
`Bishop Nathaniel`, `Officer Uzziah`. The browse pages derive the rank from that
leading word and group the filter chips by it. Leave the field out rather than
guessing; an unattributed note simply shows no chip.

Most classes never say who taught, so this is filled in by hand. `teachers.py` is the way to
do that without opening every file:

```
scripts/notes/teachers.py                  every note and what it says now
scripts/notes/teachers.py export           writes teachers.tsv, one row per note
                                           # edit the `teacher` column, then:
scripts/notes/teachers.py apply            writes those names back into the frontmatter
scripts/notes/teachers.py set <slug> <name>
scripts/notes/teachers.py rename <old> <new>   one person spelled two ways, everywhere
scripts/notes/teachers.py variants             finds those spellings
```

The exported file carries a `suggested`/`confidence`/`evidence` hint per unattributed note.
`strong` means the sentence says this person taught it; `weak` means they are only mentioned,
which is usually someone greeted or prayed for and is a place to look, not an answer. As of
the last pass every `strong` case is already filled in, so the remainder need the recording.

`teachers.py` never overwrites a name you have set unless you ask it to, and `tag-notes.mjs`
leaves an existing `teacher` alone unless run with `--reset`.

## Our Hidden History episodes

Our Hidden History Radio (`history/`) is the third feed and follows everything above, with
these differences. The episodes are book-heavy: Deacon Eythan and the guests read from
history books at length and turn to scripture as they go. The raw transcripts in
`history/transcripts/` are the backlog the notes are written from; they are NEVER published.
The site lists an episode only once its note exists.

- **File**: `history/notes/<year>/<date>-<slug>.md`. The slug is NOT invented: it is the
  `slug` field of the episode's transcript in `history/transcripts/<videoId>.json`, e.g.
  `2026/2026-09-06-ep-206-the-prophet-and-the-fourth-beast-pt-2`. `lint.py` fails a note
  whose slug differs. The transcript must exist before the note; ingest it first (see
  `history/README.md`).
- **Frontmatter**: `title` is the transcript's `cleanTitle` unless the recording gives a
  better one; add `episode: 206` when the title carries a number. `tags` start with
  `"Our Hidden History"`. `teacher` is `Deacon Eythan` unless someone else says he is
  teaching. Guests are named in the `description` and the `taught` line
  (`Our Hidden History · 2026-09-06 · Deacon Eythan, with Captain Yahn`) and where they
  speak in the body, not in `teacher`.
- **Start where the speakers start**: the transcript's `start` is the second the talk
  begins after the intro music. Nothing before it belongs in the note.
- **Scripture is walked verse by verse, with `W()`**, not `S()`. A passage gets one linked
  heading; then each verse (or the two or three he read in one breath) is quoted once, and
  what he said about it follows at once as bullets. The bullets are his commentary only.
  They never re-read the verse: "Verse 3, because of their wickedness they went to burn
  incense..." is wrong; "Because of their wickedness. So his fury was poured forth..." is
  the pattern. Never a whole passage in one block and then the commentary re-telling it.

  ```python
  W("Daniel 8:1-14", "25:52", [
      ("1-2", ["Shushan in the palace, Babylon, which is in the province of Elam. Keep that in mind."]),
      ("3",   ["They had two horns, but one was higher... The higher horn is the Persian horn."]),
      ("4",   ["This powerful ram here is a kingdom. It's a bear in Daniel 7, and the ram in Daniel 8."]),
      ...
  ])
  ```

  `W()` refuses a heading whose verses are not all walked. Every verse comes from
  `data/bible` through `lib.py`, checked by `check.py`, never typed by hand; every reference
  checked with `v.py` before writing. Captions spell references badly ("first Maccabees",
  "Ecclesiastes chapter 44" for Ecclesiasticus); resolve them from what was actually read.
- **Book readings are quoted, verbatim, with `R()`**: the source line (title, author, page as
  stated, who read it when it was not the teacher), then each stretch read as a blockquote
  followed at once by the commentary on it. Same rule as scripture: the words read, then
  what was said about them, in sequence; not the whole reading and then everything said.

  ```python
  R("*History of the Jews* by Heinrich Graetz, on the Greek games in Jerusalem", "42:20", [
      (["Combatants should be registered as Antiochians or Macedonians, ..."],
       [Y + "If I could land back on the Greek games...", D + "Combatants is the athletes. ..."]),
      (["Games were serious occupations to the Greeks, ..."],
       ["Barbarians means non-Greek speaking. ..."]),
  ], reader="Captain Yahn")
  ```

  Clips and videos played on air use `R()` the same way: the words heard, then the
  commentary. Do not shorten a reading. Fix caption misspellings of names and places when
  the book itself makes the spelling plain; do not fix his phrasing.
- **Speakers are marked**. Unlabelled bullets are the teacher's. A line another speaker
  says starts `**Captain Yahn:** ` (in the builder, `Y = "**Captain Yahn:** "`), and when
  the teacher answers him the next line starts `**Deacon Eythan:** `. A viewer's text or
  call-in is `**Text:** ` followed by the teacher's answer. The site turns these into
  speaker tags. Use the name as it is said on air: it is Captain Yahn.
- **Sections**: `## Introduction`, `## Readings and Scriptures` in the order of the episode
  (readings and scriptures interleave as they did on air; the break, if it is on the
  recording, is one timestamped paragraph), `## In Closing`, `## Announcements & References`
  with every source read from, once each, with pages and who read it. The linter requires
  the first two for this feed.
- **Nav line**: `[Our Hidden History Index](/history) · [Watch the full episode on YouTube ↗](https://www.youtube.com/watch?v=<video-id>)`.
- Word counts: a 2.5 hour episode with readings runs 15,000 to 25,000 words. It is long
  because the readings are long. That is the point.
- The finished example to match: `history/notes/2026/2026-09-06-ep-206-the-prophet-and-the-fourth-beast-pt-2.md`.

File path is `blog/2026/YYYY-MM-DD-<slug-without-date>.md` where the slug itself
already starts with the date, so the date appears twice in the filename. Captains
notes use `captains/2026/` and a nav line reading
`[15 Minutes Index](/captains) · [Watch the full episode on YouTube ↗](https://www.youtube.com/watch?v=<video-id>)`.
Where there is no recording, drop the second half rather than linking the note to itself.

## Pipeline

1. Fetch the transcript, save it, `condense.py` it.
2. Read the **whole** condensed transcript. Do not skim.
3. Collect every scripture reference and check each one with `v.py` before writing.
4. Write a builder script that imports `lib.py` and emits the note.
5. `check.py` the result. Zero mismatches, or fix and rerun.
6. `npm run notes:fix`, then `npm run notes:lint`. The linter checks the shape of the note --
   frontmatter, sections, the nav line, the tag list, scripture links -- and must report 0
   errors. Warnings are for things only the recording can settle (no video id, no teacher).
7. `npm run check` from the repo root (needs `npm ci --prefix engine` once). It is the link
   checker: every `/bible/...` link must name a real chapter and verse, and every other
   site link a real note, law, precept or case. Zero broken, or fix and rerun.
8. Commit and push. CI rebuilds the data set on push to main and cyberjudah.io reads it.

## The recording

`data-video-id` is the 11-character YouTube id, in the mount directly after
`<!-- truncate -->`. It is what puts the player on the page, and what
`npm run notes:fix` needs in order to turn each `*[18:01]*` into a link into the video at
that second.

Twelve notes have none, and 324 timestamps sit inert because of it. The ids were never
captured -- not in the frontmatter, not in those files' git history, and no orphan thumbnail
in `static/img` to recover one from -- so they have to come off the channel:

```
scripts/notes/video.py                        the notes still missing one, with a search link
scripts/notes/video.py set <slug> <url>       attach it, fix the nav line, link the timestamps
```

Do not guess an id. A wrong one points every timestamp in the note at the wrong class, which
is worse than leaving them plain.
