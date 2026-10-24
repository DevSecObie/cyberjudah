# claude/project-thread-eni3gw

## Retry TranscriptAPI 408s patiently in the harvest

- `scripts/history/harvest.py`: transcript fetches now try 5 times (was 2) with a 60 s timeout (was 20 s). Retries wait 2, 4, 6 then 8 s unless the API sends Retry-After, which is honored (capped at 30 s). TranscriptAPI documents 408 as a temporary failure that is safe to retry after 1-5 s and charges no credits for failed calls; every fetch in run #245 failed with 408 after a single retry.

## Harvest IUIC Atlanta in the ClassRoom

- `.github/workflows/transcripts-hourly.yml`: the hourly harvest now takes the IUIC Atlanta in the ClassRoom channel (@IUIC.ATLANTA.CLASSROOM) right after IUIC Raleigh, its videos and streams, up to 200 transcripts a run, until its completion marker is written. Before this it sat at rank 105 of the 304-channel queue.
- `scripts/history/dashboard.py`: the backlog dashboard reports the channel next to the other fixed sources.
