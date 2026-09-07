# Docusaurus improvements — local, unpublished

Based on upstream `10e5cbb654b83492ad88249db1264b424f974a50`. This checkout is separate from the Wiki.js and other prototypes. No migration, content deletion, push or deployment was performed.

## Reader experience

- Class-first homepage, compact introduction, latest recordings and a prominent class browser. Homepage search searches Sabbath class notes; the entire-library search remains available explicitly. Captains keep their separate browser.
- Classes first in navigation; Bible, encyclopedia and law tools grouped under Reference Library. Existing routes, base URL and trailing-slash policy retained.
- Existing teacher/topic/book/year filters visible by default. Book filtering means a book **cited**, not an assertion about the class's primary subject. Facet changes support Back; typing replaces history entries.
- Loading failures and full-text search failures are visible. Title/teacher matching remains available if Pagefind fails. Search URL normalization handles the GitHub Pages prefix, `.html`, anchors and absolute URLs.
- Existing Infima theme, video player, timestamps, note text, Bible reader and reading-state behavior retained. Missing teacher/video metadata was not guessed.

## Build and checks

Run `npm run build:profile`, then `npm run typecheck`, `npm test` and `npm run build:verify`.

The profile command runs the existing generator, Pagefind and Docusaurus pipeline. It writes stage timing, OS-reported maximum RSS and raw logs under ignored `build-profile/`. macOS peak memory footprint is reported separately because it can be much higher than reported RSS. Neither is a cross-platform guarantee or a hard whole-machine memory cap.

Docusaurus's version-specific performance logger separates content loading, bundling, static rendering and post-build work. Post-build includes PWA and redirects; it does not isolate their individual cost. Heap snapshots in those logs are not peak memory measurements. These internal environment switches should be rechecked on framework upgrades.

CI and the profile command default to a 3500 MB Node heap, SSR concurrency 1 and worker count 1. The worker count matters: SSR concurrency alone is per worker. The upstream worker-enabled setting remains intact for ordinary local builds. Override the profile command's environment to benchmark other worker counts on a machine with sufficient RAM. The CI run still needs verification on GitHub's Linux/Node 22 runner.

The verifier checks note destinations, all API JSON parses, representative feeds/redirect/PWA/search files and Numbers 15:32. It records every built HTML filename and ID, including redirects that emit `index.html` despite normal pages using `.html`. For a migration, save a known-good `url-manifest.json` and pass its path to `npm run build:verify -- /absolute/path/to/previous-manifest.json`; missing URLs or anchors then fail. Asset existence checks do not prove browser offline behavior or video playback.

Five automated tests cover combined facets, all-topic matching, missing teacher data, full-text supplementation, sort order and search URL normalization. No browser interaction/visual testing was performed.

## Follow-up before publication

### Local measurements

Measured on this Mac with Node 25.6.1, not on the Linux/Node 22 CI runner. Dependency installation is excluded. The constrained run reused thumbnails and may benefit from warm caches; these are observations, not a controlled cold-build benchmark.

| Stage | Elapsed | OS-reported max RSS |
| --- | ---: | ---: |
| Generator | 3.34 s | 438 MiB |
| Pagefind | 8.23 s | 1,144 MiB |
| Docusaurus | 141.38 s | 3,765 MiB |
| Total pipeline | 152.95 s | Not additive |

Docusaurus substeps: bundling 39.05 s, SSG 90.49 s, post-build 3.47 s, broken-link checking 1.05 s. macOS reported a 6,102 MiB peak footprint for the Docusaurus stage. The earlier worker-auto run took about 100 s total but reported about 9,265 MiB peak footprint; its lower RSS reading must not be mistaken for a safe 8 GB total-memory budget.

The final output has 4,117 HTML pages and 6,061 valid API JSON files. The URL/ID inventory comparison is between the first and final local builds in this task, not an independently rebuilt pristine upstream baseline. Routing configuration and authored content were not changed.

### Remaining checks

- Review the local interface and run the changed workflow on a non-deploying test branch/workflow before treating the memory issue as solved in CI.
- The existing note linter reports 0 errors and 169 warnings across 104 notes, including missing teacher/video IDs and estimated dates. These require source/recording review, not automatic invented metadata.
- Locked dependency installation reported 30 existing advisories (9 moderate, 21 high). No dependencies or lockfile were upgraded here; review applicability separately rather than apply forced upgrades during this UI/build change.
- No framework split is justified by timing claims alone. Use the measured bundling/SSG breakdown to decide whether extracting generated reference pages is still worthwhile.
