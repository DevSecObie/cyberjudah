# Copilot instructions: CyberJudah library

This repository is the CyberJudah library: the King James Bible (1611, with the Apocrypha), the
IUIC classes' notes, their transcripts and the precepts. Two kinds of task come to you here:

- **"Write class notes for <video id>"** (issue template *Write class notes*): follow the section
  below exactly.
- **Precept passes**: follow `AGENTS.md`.

## Writing a class note

One issue, one class, one pull request, adding only that class's note (plus any file
`npm run notes:fix` rewrites). Never edit anything else, never push to `main`, never merge.

1. Read the spec first: `scripts/notes/README.md`, above all "The note is a study guide, not a
   transcript", "The note starts where the teaching starts", "Nothing about the recording" and
   "Anatomy". A Sabbath class note runs 3,000 to 8,000 words; it is not a transcript.
2. Prepare the class and read **all** of it, in chunks, before writing anything:
   ```python
   import sys, json; sys.path.insert(0, "scripts/notes"); import auto
   t = json.load(open("blog/transcripts/<VIDEO>.json"))
   text, refs, who = auto.prepare(t)   # the condensed class with [m:ss] times; verified references in order; the teacher
   ```
   Write `text` to a scratch file outside the repo and read every chunk. `refs` are the scripture
   references already verified against `data/bible`, in the order they were called for.
3. Write the draft as JSON in exactly the shape described in `auto.SPEC` (teacher, about,
   intro_ts, news, passages with ref/ts/points/precepts, questions, closing, announcements):
   - passages in the order opened, only verses the teacher actually read, 12 to 30 for a full
     Sabbath class;
   - three to six concrete points per passage, in his words without the run-on;
   - precepts with the one line he drew from them;
   - clips named, not transcribed;
   - timestamps as `m:ss` or `h:mm:ss` from the paragraph where it happened;
   - the teacher with his title exactly as he gives it ("Bishop Nathanyel", "Deacon Malachi",
     "Captain Gideon"). If he never names himself, leave it empty rather than guess.
4. Render and gate it:
   `python3 scripts/notes/auto.py --video <VIDEO> --from-json <draft.json> --commit`.
   It pulls every verse from `data/bible`, drops any reference that does not resolve, runs
   `check.py`, `npm run notes:fix` and `npm run notes:lint`, and commits the note only if all
   pass. If it reports **NOT written**, read the failure, fix the draft and run it again.
5. Push your branch and open the pull request titled `Notes: <class title>`, with the word count,
   the number of passages, the teacher, and anything that read wrong under **Notes**.

### Never

- Type a verse by hand, or quote scripture any way other than through the gate.
- Invent a reference, a quote, a name or a timestamp. If you cannot tell, leave it out and say so
  in the pull request.
- Write anything about captions, transcripts or the recording into the note.
- Soften or clean up the teacher's words, or add commentary of your own.
- Add outside views about IUIC, its teachers or the classes.
