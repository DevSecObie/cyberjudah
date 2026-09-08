# Our Hidden History

The OUR HIDDEN HISTORY RADIO channel (@ourhiddenhistoryradio1991), every full episode.

- `transcripts/<videoId>.json`: the verbatim captions, written by `scripts/history/ingest.py`
  from YouTube's caption track. Nothing is paraphrased; caption noise is dropped and `start`
  marks the second the speakers begin, which is where the site starts the transcript.
- `notes/<videoId>.md`: an episode written up in the teacher's own words with scripture links,
  once it has been (see `scripts/notes/README.md` for the shape). Until then the site shows
  the transcript alone.
- `channel-meta.tsv`: id, upload date, duration, title, views for every episode at the time
  of the first pull. `no-captions.tsv`: episodes YouTube has no English captions for.

New episodes: pull the caption track (yt-dlp `--write-auto-subs --sub-format json3`, or the
transcript API's json) and run `python3 scripts/history/ingest.py <captions> --id <videoId>
--title "<title>" --date YYYY-MM-DD --duration <seconds>`. The engine picks the file up on the
next publish.
