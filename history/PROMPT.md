# Prompt: write up an Our Hidden History episode

Give this to any capable AI that can run shell commands in a clone of
https://github.com/DevSecObie/cyberjudah. Paste it whole. Replace `<videoId>` at the end.

---

You are writing up one episode of Our Hidden History Radio (an IUIC Philadelphia radio show
taught by Deacon Eythan, with captains as guests; the regular guest is Captain Yahn) as a
note for the CyberJudah study site. The repository is cloned in front of you. Work from the
repo root.

## The two rules

1. The note is a NEAR-VERBATIM record of the episode in the speakers' own words. It is not a
   summary, not a paraphrase, not an essay about the episode. If he read a page of a book,
   the note has that page, word for word, as a quotation. Filler ("go ahead", "read on",
   "uh"), crosstalk about the screen, and profanity are the only things you drop. A written-up
   episode runs 15,000 to 25,000 words; a short note is a wrong note.
2. The note is STRUCTURED: each verse is quoted once and the commentary on it follows at
   once. Never a whole passage in one block and then the commentary re-telling the verses.
   The commentary bullets never re-read the verse; they are what he said about it. Speakers
   other than the teacher are labelled where they speak.

## What you have

- `history/transcripts/<videoId>.json`: the episode's caption track. Fields: `title`,
  `cleanTitle`, `episode`, `slug`, `date`, `duration`, `start` (the second the speakers begin,
  after the intro music) and `segments`, a list of `[seconds, text]`. Captions are machine-made:
  names and scripture references are often misspelt ("first Macabes", "Ecclesiastes 44" for
  Ecclesiasticus, "Pathos" for Pathros, "Captain Y" for Captain Yahn). Resolve them from what
  was read aloud. `>>` in the text marks a change of speaker. Episodes from 2020 to 2022 have
  no punctuation or capitals at all; punctuate as the speech runs. The transcript is never
  published; only your note is.
- `scripts/notes/README.md`: the editorial spec for every note on the site. Read all of it,
  then its section "Our Hidden History episodes", which has the rules specific to this feed.
- `scripts/notes/v.py "Daniel 8:1-14"`: prints a reference as note markdown and fails if the
  reference does not exist. Run it on EVERY scripture before you write.
- `scripts/notes/lib.py`: `W(ref, timestamp, walk)` builds a scripture walked verse by verse
  and `R(source, timestamp, walk, reader=None)` builds a book reading; import both from a
  builder script. Never type a verse by hand.
- `scripts/notes/check.py <note>`: verifies every quoted verse byte for byte. Must say
  `0 mismatches`.
- `scripts/notes/condense.py`: collapses timestamped lines into readable paragraphs.
- A finished example to match: `history/notes/2026/2026-09-06-ep-206-the-prophet-and-the-fourth-beast-pt-2.md`,
  built by a script shaped like the one described below. Open it first. Your note should
  look exactly like it in shape.

## Steps

1. Print the transcript from `start` onward as one line per segment in the form
   `[459.76s] text`, condense it with `python3 scripts/notes/condense.py in.txt out.txt`, and
   READ THE WHOLE CONDENSED FILE. Do not skim. Do not sample. Do not stop at the break; the
   second half is usually where the book readings are.
2. As you read, list in order: every scripture opened (book, chapter, verses, timestamp, and
   for each verse or small group of verses what he said right after reading it), every book
   reading (title, author, page as stated, who read it, the timestamp, the exact words read,
   and the commentary after each stretch), every video or clip played (what was said in it),
   and every text or call-in question and the answer.
3. Check every scripture with `v.py`. If a reference does not resolve, find what was actually
   read aloud in the transcript and fix the reference, not the words.
4. Write a Python builder script that imports `lib.py` and writes the note to
   `history/notes/<year>/<date>-<slug>.md`, where `<year>/<date>-<slug>` is the `slug` field
   of the transcript, exactly. Define `Y = "**Captain Yahn:** "`, `D = "**Deacon Eythan:** "`,
   `T = "**Text:** "` and prefix lines with them where the speaker changes. The frontmatter:

   ```
   ---
   title: "<cleanTitle>"
   slug: "<slug from the transcript>"
   date: "<date>"
   episode: <episode number, omit the line if none>
   teacher: "Deacon Eythan"        (unless the recording says someone else is teaching)
   description: "Our Hidden History · <date> · with Captain Yahn"   (drop the guest if none)
   tags: ["Our Hidden History"]
   ---
   ```

   Then, in order: `<p class="taught">Our Hidden History · <date> · Deacon Eythan, with Captain Yahn</p>`,
   a blank line, `<!-- truncate -->`, a blank line,
   `<div class="class-video-mount" data-video-id="<videoId>"></div>`, and the sections:

   - `## Introduction`: the opening in their words, with `*[m:ss]*` timestamps at paragraph
     starts. Who is on the show, what was covered last time, what today is about.
   - `## Readings and Scriptures`: the body, in the order the episode ran.

     Scripture is a `W()` call: `W("Jeremiah 44:1-30", "9:51", [("1", [bullets]), ("2-6", [bullets]), ...])`.
     One linked heading for the passage, then each verse (or the two or three he read in one
     breath) quoted, then the bullets of what he said about it, in his words. Every verse in
     the heading must be walked; a verse he read without comment is grouped with the next
     one he commented on. The bullets do not repeat the verse text.

     A book reading is an `R()` call: `R("*Title* by Author, page N, what it is about", "42:20", [([paragraphs read], [bullets]), ...], reader="Captain Yahn")`.
     The words read as blockquote paragraphs, then the commentary on that stretch, then the
     next stretch, in sequence. Clips and videos the same way: the words heard, then the
     commentary. Text messages and call-ins are `T + question` followed by `D + answer`.
   - `## In Closing`: his closing words, first person, with the guest's lines labelled.
   - `## Announcements & References`: the announcements as given (subscribe, donations,
     missing persons, land fund), the show's text line, and then a bullet list of every source
     read from, once each, with the pages and who read it.
   - The last line: `[Our Hidden History Index](/history) · [Watch the full episode on YouTube ↗](https://www.youtube.com/watch?v=<videoId>)`

   Timestamps are `*[m:ss]*` or `*[h:mm:ss]*` in italics with square brackets. The tooling turns
   them into links into the recording.
5. Run, from the repo root, and fix anything that is not clean:

   ```
   python3 scripts/notes/check.py history/notes/<year>/<date>-<slug>.md   # 0 mismatches
   npm ci --prefix engine --no-audit --no-fund                              # once
   npm run notes:fix                                                        # links timestamps, adds tags
   npm run notes:lint                                                       # 0 errors
   npm run check                                                            # 0 broken links
   ```
6. Commit the note (and whatever `notes:fix` rewrote) as `history: write up EP <n> <title>`
   and push to `main`. Do not commit the builder script or the transcript printouts.

## Things that get a note rejected

- Summarising. "He explained that the ram represents Persia" is a summary. "So the ram is the
  Medo-Persian Empire, which is the bear in Daniel 7" is his words. Write the second.
- A passage quoted whole and then the commentary walking back through it. Quote a verse,
  comment, next verse, comment.
- Commentary that re-reads the verse ("Verse 3, because of their wickedness they went to burn
  incense..."). The verse is already on the page; write what he said about it.
- Shortening a book reading, or paraphrasing it. Quote what was read, all of it.
- Typing a verse from memory. Every verse comes through `lib.py` and passes `check.py`.
- Inventing a page number, author or title that was not stated. Write what was stated;
  if the title was not said, describe the source ("a Bible commentary on Psalm 18:34").
- Guessing the teacher. Deacon Eythan unless someone else says he is teaching.
- Misnaming the guest. It is Captain Yahn. A name the captions mangle beyond recovery is
  left out ("another captain is here"), never invented.
- Skipping the second half of the episode.
- A note under 12,000 words for a two hour episode.

Episode to write up now: `history/transcripts/<videoId>.json`
