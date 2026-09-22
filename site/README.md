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

## AI study assistant (free-only activation)

`/assistant` retrieves up to four transcript passages from D1, then calls Gemini
(`gemini-3.8-flash`). Availability failures fall back to Workers AI
(`@cf/qwen/qwen3-30b-a3b-fp8`). Gemini policy refusals do not trigger fallback.
Secrets and provider calls stay on the server. Citation numbers link to the
retrieved excerpts; recording links seek to the start of the displayed passage.

**Both providers are disabled by default.** The owner requires $0 AI charges.
Activate each provider only after verifying its billing configuration:

- Gemini: use a project on the free tier with billing disabled. Add its key as a
  `GEMINI_API_KEY` Worker secret, then set `STUDY_GEMINI_FREE_ONLY=true` as a Worker
  variable. Never commit keys or use VITE variables for them.
- Cloudflare: verify the Workers account is on the Free plan, which stops requests
  above its free allowance. Only then set `STUDY_CLOUDFLARE_FREE_ONLY=true`. Do not
  enable this on a paid account: app limits cannot guarantee zero charges because
  other apps share the account allowance. The `AI` binding needs no separate key.
- These flags are owner attestations, not automatic billing-plan detection. If
  billing is enabled later, disable the corresponding flag first. No workflow
  enables either flag, upgrades a plan, or creates a billing account.

Without verified free access the UI links to ordinary transcript search. With
both providers enabled, exhausted Gemini app quota, missing key, timeouts, errors,
incomplete output or invalid citation IDs trigger Cloudflare fallback. If both
are unavailable, it stops without paid retries.

The deploy workflow applies the additive, idempotent
`migrations/0001-study-assistant.sql` before publishing. It does not alter either
search index. Atomic D1 reservations enforce 3 requests/minute and 10/day per
connection, 100 Gemini attempts/day, and 40 Cloudflare attempts/day. UTC day
boundaries apply. Failed calls consume reservations. Provider free quotas may be
lower and may change; the app limits are not a substitute for free billing plans.

Answers are cached for 24 hours under a hash of question, previous topic, collection
and retrieved sources. Raw questions/IPs are not stored in D1, but answers can echo
question text. IP hashes rotate daily. Provider data policies still apply; the UI
explains this before submission. Expired usage/cache rows are removed on later
requests. Conversations stay in browser memory.

Retrieval uses ranked keyword search, not embeddings. Follow-ups carry the preceding
question as topic context, not the complete conversation. Citation-ID checks verify
references exist, not that every claim is supported; readers should check sources.
Input is bounded to four 2,400-character excerpts; output is capped at 1,400 tokens.
Gemini times out after 20 seconds, Cloudflare after 35 seconds.

Validation: `ALLOW_CASE_ERRORS=1 npm test`, `npm run build`, and the existing CI
Playwright gates. Tests cover failover, refusals, truncation, citations, quota
exhaustion, and free-only activation guards. Live generation still requires the
verified free provider configuration above.
