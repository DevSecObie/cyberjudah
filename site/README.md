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

## Telegram Mini App

The same site runs as a Telegram Mini App. When Telegram opens it, `lib/telegram.ts` loads
Telegram's SDK (only then; on the open web nothing loads) and `components/site/telegram-bridge.tsx`
wires the site into Telegram's own controls:

- the app opens full height in the site's colours, and a downward swipe scrolls instead of closing it
- Telegram's **back button** closes an open sheet, menu or search first, then walks back through the pages
- the **bottom bar** carries each page's main action: *Continue · John 3* and *Search* on the front
  door; next and previous chapter in the reader; with verses selected, *Share John 3:16* and *Study*
- **Settings** in the ··· menu offers *Share this page* and *Add to Home Screen* (or *Open in browser*)
- sharing opens Telegram's chat picker with a link that opens that page, and those verses, in the app
- the reader's text size and where they left off sync through Telegram's CloudStorage, across devices
- links to other sites open in Telegram's browser, `t.me` links inside Telegram, and downloads
  through Telegram's file sheet; moving between pages ticks the haptics

**Deep links.** `https://t.me/<bot>/<app>?startapp=<page>` opens a page: the path with `_` for `/`,
and `bible_` optional for a chapter. `john_3_16`, `psalms_23`, `john_3_16-18x20` (verses 16-18 and
20), `law`, `classes_2026_<slug>`. The Worker redirects the launch to that page; the codec is
`lib/telegram-links.mjs`.

**Setting it up.**

1. In [@BotFather](https://t.me/BotFather): `/newbot`, then `/newapp` for that bot with the URL
   `https://cyberjudah.io` and a short name (e.g. `read`). Optionally, *Bot Settings → Configure Mini
   App* to make it the bot's main app, and *Menu Button* to open it from the chat.
2. Set the repository variable `TELEGRAM_APP_URL` to the app's link, e.g.
   `https://t.me/CyberJudahBot/read`. Builds read it as `VITE_TELEGRAM_APP_URL`; without it,
   sharing still works but sends the plain cyberjudah.io link.
