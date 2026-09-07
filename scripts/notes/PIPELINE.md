# Running the archive pipeline

One video, start to finish, unattended. `README.md` in this directory is the editorial
spec — what a note has to be. This is the operational sequence — how one gets made.

The pipeline's whole memory is the `data-video-id` in the notes. A video is done when a
note cites it; there is no separate ledger to fall out of step.

---

## 0. What the scripts do and do not do

| step | tool | automatic? |
|---|---|---|
| find the next unwritten video | `queue.py` | yes |
| fetch the transcript | transcriptAPI (MCP) | needs the API |
| condense, extract and verify references, read the teacher | `prep.py` | yes |
| **write the note** | **a person or a model** | **no** |
| verify every quoted verse | `check.py` | yes |
| tags, timestamp links, `Opens` line | `npm run notes:fix` | yes |
| shape of the note | `npm run notes:lint` | yes |
| links | `npm run build` | yes |

Everything except writing is mechanical. Writing is not, and should not be automated into
a summary: near-verbatim in the teacher's own words is the point of the note, and a
summarised note has been rejected before.

---

## 1. What is left to write

Save the listings from the transcript API to disk, then:

```bash
scripts/notes/queue.py plan listings/*.json --as-of 2026-09-07 --limit 5
scripts/notes/queue.py plan listings/captains*.json \
    --title-contains "15 Minutes W/ The Captains"      # that channel carries other series
```

Output is `date · video id · minutes · title`, newest first, already filtered:
covered videos, anything under ten minutes, and premieres with no duration are dropped.

**A date prefixed `~` was computed from a relative age** ("Streamed 16 hours ago") against
`--as-of`, so `--as-of` must be the day the *listing* was taken, not the day you are
writing. Get that wrong and a Sabbath class is dated to the Sunday. Prefer the RSS listing
(`get_channel_latest_videos`) where you can — it carries exact timestamps, and when a video
appears in both, the exact date wins and the `~` disappears.

`list_channel_videos` carries **no dates at all**. It is the right call for discovering the
backlog and the wrong one for dating it; pair it with a search or RSS listing.

## 2. Check it has captions

`get_youtube_video_info` first — it is free and it is the one thing that will waste a whole
run. A live stream often has no caption track for hours after it ends, and some never get
one. No captions, no note: say so in the report and move on.

## 3. Fetch and prep

```bash
# save the transcript from get_youtube_transcript (format=text, include_timestamp=true)
scripts/notes/prep.py transcripts/<id>.txt --video <id> --out work/
```

Writes `<id>.condensed.txt` and `<id>.brief.md`. The brief carries the metadata, the
teacher if he introduced himself, and every scripture reference it found **already verified
against `data/bible`**. Exit status is non-zero if any reference failed to resolve.

**Read the whole condensed transcript anyway.** `prep.py` finds about 59% of the references
on a transcript it has not seen — it invents none, but it misses the ones the recogniser
mangled, books named a breath before their verse, and ranges read through without the end
announced. Treat the brief as a floor, not a list.

## 4. Write the note

Follow `README.md`. The brief means every reference is known good before the first line;
pass them to `v.py` or `lib.py` as they are, and never type a verse by hand.

Set `teacher` from the brief only if he named himself. `prep.py` declines "Stay tuned for
Bishop Nathanyel coming up next" on purpose — a wrong name is worse than an empty field,
and the field is always there to fill in later.

## 5. Gate it

```bash
python3 scripts/notes/check.py <note.md>     # 0 mismatches, or fix and rerun
npm run notes:fix                            # tags, Opens line, timestamp links
npm run notes:lint                           # 0 errors
npm run build                                # the link checker
```

Commit the note, `src/data/stats.json`, and whatever `notes:fix` rewrote. One note, one
commit — so a partial run can be dropped without taking a finished note with it.

---

## Known gaps

- **Reference recall is 59%** on held-out transcripts. Raising it wants a scored corpus:
  `prep-score.py` against a hand-built list is how the current number was measured, and
  two plausible-looking pattern changes regressed it badly before scoring caught them.
- **`prep.py` never detects a range** the teacher reads through without announcing the end
  verse, which is most of them. The brief gives the starting verse; the writer sets the range.
- **Dating the deep backlog** needs a search or RSS call per batch, because the bulk listing
  has no dates. Videos older than a few weeks resolve only to a `~` month.
- **Nothing here fetches**. The MCP calls belong to whatever drives the pipeline; these
  scripts read files and are safe to run anywhere.
