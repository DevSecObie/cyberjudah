# Codex Handoff: Transcript Archive

## Repository

- GitHub: https://github.com/DevSecObie/cyberjudah
- Branch: `main`
- Do not store transcript, audio, cookie, or channel archive data persistently on the local computer.
- Use GitHub Actions and commit completed transcript artifacts directly to GitHub.

## Objective

Archive all available transcripts from these IUIC classroom YouTube channels:

- `IUICintheClassRoom`
- `iuicintheclassroom2`

Process ordinary captioned videos first. Defer age-restricted, bot-gated, and no-caption videos to the separate audio workflow.

## Active workflows

### Hourly Transcript Harvest

Path: `.github/workflows/transcripts-hourly.yml`

- Runs hourly and supports manual dispatch.
- Uses TranscriptAPI only.
- Processes captains, history, and both classroom channels.
- Batch limit is 200 candidates per channel.
- Updates the backlog dashboard in `dashboard/`.
- Required GitHub secrets: `TRANSCRIPTAPI_KEY`, `GJT`.
- Audio downloading and Whisper are intentionally excluded.

### Audio Transcript Fallback

Path: `.github/workflows/audio-fallback.yml`

- Manual dispatch only.
- Select one classroom channel or both.
- Accepts a per-channel batch limit.
- Uses authenticated yt-dlp plus faster-whisper.
- Required GitHub secret: `YOUTUBE_COOKIES`.
- Leave this workflow idle until the normal-caption backlog is addressed.

## Important implementation files

- `scripts/history/harvest.py`: TranscriptAPI and legacy yt-dlp caption harvesting.
- `scripts/history/audio_fallback.py`: authenticated audio download and Whisper fallback.
- `scripts/history/dashboard.py`: backlog dashboard generation.
- `blog/transcripts/`: committed transcript JSON files.
- `blog/channel-meta.tsv`: transcript metadata.
- `dashboard/transcript-backlog.html`: browser dashboard.

## Captions arrive after the stream ends

A class is a livestream, and YouTube publishes its auto-captions some hours after the stream
finishes. A harvest that runs in that window sees no caption track and records the id in
`blog/no-captions.tsv`.

That file used to be folded into the harvester's `done` set unconditionally, which made a
temporary condition permanent. Because every new class passes through that window, recent
classes were dropped on an ongoing basis rather than as a one-off: the 2026-09-12 and 09-13
classes went missing exactly this way, and all three had captions by the time anyone looked.

`harvest.py` now stamps each no-captions row with the day it was parked and retries any row
younger than `--recheck-nocaption-days` (default 30). The first sighting is the one that
counts, so a video that never gets captions stops being retried on schedule. Rows written
before the date column existed carry no date and stay skipped.

- Rows with no date are the pre-existing backlog. If one of them is recent, stamp it with the
  stream date by hand and the next harvest will pick it up.
- `blog/age-restricted.tsv` is deliberately still permanent: an age gate does not lift on its
  own. Those belong to the audio fallback workflow.

## Known inventory caveat

TranscriptAPI channel listing previously exposed only about 398 and 399 classroom videos, while yt-dlp inventory reported approximately:

- `IUICintheClassRoom`: 2,102 listed
- `iuicintheclassroom2`: 1,423 listed

The dashboard therefore undercounts the true YouTube inventory when it relies only on TranscriptAPI listing results.

## Recent work

- Restored TranscriptAPI-only hourly workflow: commit `8324c1d`.
- Added separate manual audio workflow: commit `c6b4749`.
- One successful audio run previously added:
  - `wXtq-ETpB38`
  - `_yurpcNOz_I`
  - `hFwr31rSzqU`
  - `LRKAqsdDNcM`
- Later audio attempts hit YouTube HTTP 429, age confirmation, and bot checks.
- Do not represent a green audio workflow as transcript success without checking its logs and committed files.

## Resume instructions

1. Check the latest `Hourly Transcript Harvest` run and inspect its log for exact archived, skipped, and failed counts.
2. Keep the TranscriptAPI workflow moving through ordinary captions.
3. Verify progress by inspecting commits and transcript files on GitHub, without pulling the transcript archive locally.
4. Improve the dashboard inventory later so it reflects the full yt-dlp-discovered channel totals.
5. Handle age-restricted and no-caption videos later through the separate audio workflow.
6. After a Sabbath, check that the classes that streamed actually landed. The channel RSS
   (`https://www.youtube.com/feeds/videos.xml?channel_id=<id>`) carries exact dates; the
   `/videos` tab listing carries none and will not tell you what is missing.

## Security

This handoff intentionally contains no credential values. Do not share the original Codex conversation because credentials were pasted into it. Rotate the exposed TranscriptAPI credentials before creating any public share link.
