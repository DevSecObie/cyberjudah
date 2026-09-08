# CyberJudah

The vault behind [cyberjudah.io](https://cyberjudah.io): the King James Bible with the
Apocrypha, and everything taught from it, as one linked library.

```
docs/study/         4 Chapters a Day notes, one file per chapter        (hand-written)
docs/encyclopedia/  standing subjects                                    (hand-written)
blog/               Sabbath class notes                                  (hand-written)
captains/           15 Minutes w/ The Captains                           (hand-written)
data/               the KJV text, the handbook of law, precepts, cases, cross references
engine/             turns all of the above into one data set             (node engine/build.mjs)
site/               the front end, a TanStack Start app on Cloudflare    (reads the data set)
scripts/notes/      the editorial spec and helpers for writing a note
brand/              the lion, the icons, the social card
```

Nothing is hand-written except the notes and the data. The engine builds the JSON API, the
full-text index, the SQLite library and the feeds on every push to `main` and publishes them
to the `data` branch and to `data.cyberjudah.io`; the site reads them from there. The front
end is replaceable: anything that can read JSON can render this library. The contract is in
[engine/README.md](engine/README.md).

## Working on the notes

```
npm ci --prefix engine        # once
npm run notes:fix             # timestamps, topic tags, scripture index
npm run notes:lint            # the shape of every note
npm run check                 # every link resolves to a real chapter, verse, note, law, precept or case
```

The editorial spec is [scripts/notes/README.md](scripts/notes/README.md).

## Working on the site

```
cd site && npm ci && npm run build
```

`site/README.md` covers the app. Deploys run from GitHub Actions on push:
`.github/workflows/data.yml` publishes the data set, `.github/workflows/site.yml` deploys the
Worker. The old GitHub Pages address forwards to cyberjudah.io (`.github/workflows/redirect.yml`).
