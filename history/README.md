# Our Hidden History

The OUR HIDDEN HISTORY RADIO channel (@ourhiddenhistoryradio1991), every full episode.

- `transcripts/<videoId>.json`: the verbatim captions, written by `scripts/history/ingest.py`
  from YouTube's caption track. Nothing is paraphrased; caption noise is dropped and `start`
  marks the second the speakers begin. This is the BACKLOG: the transcripts are the source
  the notes are written from and are never published. Nothing in this folder reaches the
  site until it has been written up.
- `notes/<year>/<date>-<slug>.md`: an episode written up in the teacher's own words, book
  readings quoted verbatim, scripture linked, once it has been. The slug is the transcript's
  `slug` field. `scripts/notes/README.md` has the spec (section "Our Hidden History
  episodes"). The site lists an episode only once its note exists; the note is the page.
- `channel-meta.tsv`: id, upload date, duration, title, views for every episode at the time
  of the first pull. `no-captions.tsv`: episodes YouTube has no English captions for.

New episodes: pull the caption track (yt-dlp `--write-auto-subs --sub-format json3`, or
`python3 scripts/history/harvest.py --backend transcriptapi`) and run `python3 scripts/history/ingest.py
<captions> --id <videoId> --title "<title>" --date YYYY-MM-DD --duration <seconds>`. The engine
picks the file up on the next publish.
