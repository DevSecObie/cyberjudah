# claude/project-thread-fgmsr4

The data set moves to Cloudflare R2, so no file is ever too big to publish again.

## Why
"Publish the data set" failed on every run that got past the build: `library.sqlite.gz` grew past the 25 MiB a Workers static asset may be, and `search.sql.gz` (56.7 MB) was heading for GitHub's 100 MB push limit on the `data` branch. Git was being used to store and serve built files.

## What
- `engine/publish.mjs`: uploads `dist/` to the R2 bucket `cyberjudah-data`, each file once under its content hash, only what the live build does not already have. A build's manifest lists its files; one write of `pointer.json` makes it live. Keeps the newest 10 builds and removes the rest; `--rollback <build-id>` restores a kept build.
- `engine/r2.mjs`: a small dependency-free S3 (SigV4) client for one bucket.
- `engine/worker/`: data.cyberjudah.io is now a small read-only Worker that serves the live build from R2 (no size limit, CORS, cache lifetimes per path, ETags, Range requests). The build no longer writes `.assetsignore` or `_headers`.
- `.github/workflows/data.yml`: no more `data` branch push, so the job's repository access drops to read-only. Uploads use bucket-scoped R2 keys.
- `library.sqlite.gz` and `search.sql.gz` are served whole from data.cyberjudah.io again; the site's Downloads and API pages, `api/index.json` and the docs say so. The site's jsDelivr fallback and its CSP entry are removed.
- Tests: `engine/publish.test.mjs` (publisher, Worker, rollback, cleanup, SigV4 against AWS's published example) and `engine/data-assets.test.mjs` (the real build, published to memory and read back through the Worker, plus Wrangler's dry run).
