# The site

The CyberJudah front end: React 19 + TanStack Start, rendered on a Cloudflare Worker,
reading the content engine's data set (see `../engine/README.md`). It holds no content of
its own.

```
npm install
npm run dev          # local, at http://localhost:3000
npm run build        # dist/server/server.js (the Worker) + dist/client (static assets)
npx wrangler deploy  # ships to Cloudflare (CI does this on every push to main)
```

Routes live under `src/routes/` (file-based). Site chrome and the reader's study panel are
under `src/components/site/`; the scroll-driven film engine under
`src/components/scroll-scrub/`. The design brief is `design-brief.md`.
