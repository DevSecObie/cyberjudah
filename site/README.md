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

Telegram opens its own phone-app interface at `/app` (routes/app/*), built on the same data as
the website: five tabs and two pushed screens.

- **Home**: search, continue reading, today's passage, the latest classes and Captains episodes
- **Search**: the whole library, filtered by kind, or *What was taught*, which searches the class
  transcripts and opens the recording at that moment; recent searches are kept
- **Classes**: Sabbath classes, 15 Min w/ Captains, Our Hidden History and the Truth series, with a
  filter by title, topic, book or teacher
- **Bible**: the books by testament, a chapter grid, and a reader; tap verses to share them and to
  see the classes, laws and precepts that cite them
- **More**: law, precepts, cases, dictionary, topics and the rest, as the website pages
- a class or note opens with its recording on top and its write-up below

Telegram's own controls do the navigating (`components/site/telegram-bridge.tsx`, `lib/telegram.ts`):

- the back button closes an open sheet or menu first, then goes back; on the tabs it is Close
- the bottom bar carries the screen's action: next and previous chapter in the reader, *Share
  Psalms 23:4* with verses selected, *Share* and *Watch* on a class
- Settings in the ··· menu offers *Share this page* and *Add to Home Screen*
- reading position, text size and recent searches sync through Telegram's CloudStorage
- recordings and other sites open in Telegram's browser, `t.me` links inside Telegram, downloads
  through Telegram's file sheet; the app fills the screen in the site's colours and a downward
  swipe scrolls instead of closing it

The website loads none of this unless Telegram opened it, and outside Telegram `/app` works as a
plain mobile web app.

**Deep links.** `https://t.me/<bot>/<app>?startapp=<page>` opens a screen: the site path with `_`
for `/`, and `bible_` optional for a chapter. `john_3_16`, `psalms_23`, `john_3_16-18x20` (verses
16-18 and 20), `classes`, `classes_2026_<slug>`, `law`. The Worker redirects the launch; the
codec is `lib/telegram-links.mjs`.

**Setting it up.**

1. In [@BotFather](https://t.me/BotFather): `/newbot`, then `/newapp` for that bot with the URL
   `https://cyberjudah.io/app` and a short name (e.g. `read`). Optionally, *Bot Settings → Configure
   Mini App* to make it the bot's main app, and *Menu Button* to open it from the chat.
2. Set the repository variable `TELEGRAM_APP_URL` to the app's link, e.g.
   `https://t.me/CyberJudahBot/read`. Builds read it as `VITE_TELEGRAM_APP_URL`; without it,
   sharing still works but sends the plain cyberjudah.io link.
