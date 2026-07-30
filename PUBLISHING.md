# Publishing CyberJudah

The working Obsidian vault is the parent folder. The public website contains a
curated copy of:

- `Bible/`
- `Study Bible/` Markdown notes, excluding `_tools/`, `_pdf/`, and PDFs
- `Encyclopedia/`
- `Class Notes/`
- `Classroom/Missing Transcripts.md`

Raw transcripts and private Obsidian data are not published.

## Refresh content

From the `Website` folder:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/sync-vault.ps1
```

## Build locally

```powershell
npm install
npx quartz build
```

## Publish

Commit and push the `v5` branch. GitHub Actions builds the site and deploys it
to GitHub Pages.
