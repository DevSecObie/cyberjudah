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

## Security

This handoff intentionally contains no credential values. Do not share the original Codex conversation because credentials were pasted into it. Rotate the exposed TranscriptAPI credentials before creating any public share link.
