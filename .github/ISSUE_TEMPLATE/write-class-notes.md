---
name: Write class notes
about: One class, one note, written from its transcript by the coding agent
title: "Write class notes for <video id>"
labels: notes
---

**Class:** <title>
**Date:** <YYYY-MM-DD>
**Video:** https://youtu.be/<video id>
**Transcript:** `blog/transcripts/<video id>.json`

Write this class's note by `.github/copilot-instructions.md` ("Writing a class note") and the spec in
`scripts/notes/README.md`. One pull request adding only this note. The gate
(`scripts/notes/auto.py --commit`) must pass.
