# State of CyberJudah

The CEO keeps this file current at the end of every cycle (see `ops/RUNBOOK.md`). It holds the roadmap, the decisions and their dates, what is waiting on the owner, what is blocked, and the next actions, so that any runtime can take the CEO seat by reading it. Every assignment and decision is also a Paperclip issue or comment; this file is the summary, Paperclip is the record.

**Last updated:** 5 October 2026, ~02:40 UTC, by CeeJay (chief of staff): the thirteen seats now exist in Paperclip (`ops/SETUP.md` §3); routines and the CEO's first run wait on PR #51 merging (§5.1, §6). Built from the handoff of 4 October 2026 (~18:00 UTC) and a read of both GitHub repositories at 5 October ~01:45 UTC. Where the two differ, both are given; the CEO verifies on GitHub before acting.

---

## 1. Standing approvals from the owner

| Approval | Scope | Given | Status |
|---|---|---|---|
| Precept passes may be merged by the reviewer when every check passes and the pass is faithful to its class | `data/precepts/classes/<video id>.json`, one file per PR | Implied by the Claude routine "Review ChatGPT precept passes" (merges passes that are good) | **To confirm with the owner before the Precepts reviewer merges anything.** Until the owner confirms it here, the reviewer comments only. |

No other standing approval exists. Every other merge and every production deploy needs the owner's go-ahead in the current conversation (rule 1).

## 2. Roadmap (handoff §3), in priority order

1. **The CMS** (the owner's top priority; Codex builds it). Review each Codex PR against: server-side rights checks (`ADMIN_IDS`), a path allowlist, compare-and-swap on each file's sha, validators that mirror `check.mjs` and `classes.py check`, and tests. Order of what it edits: first PR Timeline events + outside-source whitelist screen + resource catalog publish/rollback; later, one PR each: class details (teacher, date, title via `class-teachers.tsv` and note front matter), People, precept passes, the existing photo and note editors moved onto the PR flow.
2. **The twelve-tribes Timeline**: finish the Judah, Benjamin and Levi–Simeon batches; retry the 30 drafts' sources; the owner's three tagging decisions (below).
3. **Bible resources**: the four approved bundles published to R2 by the owner; then the installer and Ask on the same releases.
4. **Class notes and precept passes**, continuously, replacing the three Claude routines.
5. **The R2 transcripts**: match the unmatched files, date the 53 undated classes, use the text to check garbled captions.
6. **Operations**: credits at cost, the holy-days gate, the weekly calendar check, D1 loads, data publishes, workflow health.

## 3. Open work and its state

| Where | What | Handoff (4 Oct 18:00) | GitHub (5 Oct 01:45) | Next step and owner |
|---|---|---|---|---|
| telegram **#140** | Timeline second wave: 144 new events, tribes on 112 more (346 events, 30 drafts, 0 problems) | Waiting on the owner | **Merged** 5 Oct 01:24 (`d60e141`); deploy run 777 completed; the research kit is now on `main` | Timeline researchers start the remaining batches on fresh branches from `main` (CEO assigns). |
| telegram **#133** | Codex: resource installer, offline reading, rollback, Ask on the same releases | Mark ready when green; owner merges | **Merged** 4 Oct 18:08 | Done. Follow-ups Codex was sent are tracked by the Backend engineer. |
| telegram **#132**, **#131** | Approved study bundles (#132); Phase 1 offline shell and release contracts (#131, `a16f211`) | Deploy of #131 needs owner approval | Both merged 4 Oct | Confirm the production deploy ran for the current `main` (Data steward checks `deploy.yml` runs). |
| telegram **#134 → #135 → #136 → #137** | Codex's CMS stack: foundation (Timeline, notes, outside sources, resources, Photos link) → Classes → People → Precepts | Being built | **Open, draft, checks clean**, rebased on `main` after #140 | Security and QA review each against the CMS checklist; Release manager keeps the stack's order and retargets each dependent PR after its parent merges; owner merges #134 first. Owner setup first: `APP_REPO_TOKEN` (see §5). |
| telegram **#138**, **#139** | Scale hardening (free-tier cap, quota sweep, search cache); AI answer block in search (stacked on #138) | Not in the handoff | **Open, ready**, `mergeable_state: unstable` (a check is not green); opened from `ceejay/*` branches by the owner's chat session, not by this team | QA reproduces the red check (the body says one pre-existing timezone test fails on `main` too); Security reviews the per-IP counters and KV dedup; Release manager puts them in the ready list once green. |
| content **#46** | Teachers for 279 classes from R2; teacher fallback in `auto.prepare`; the R2 inventory workflow | CI green; owner merges | **Merged** 5 Oct 00:49 (`bc62440`); data publish run 294 succeeded | Done. |
| content **#47** | R2 outlines: match all 1,262 by their text (`scripts/r2/match.py` → `data/sources/r2-classes.tsv`), date 141 classes | Not in the handoff | **Open**, `mergeable_state: dirty` (conflicts with `main` after #46 merged); says the R2 `text/` files are the text of each class's PDF **outline**, not speech transcripts | Class archivist reviews the matching and the dates; the author's branch needs a rebase (ask the CEO who; it is a `claude/*` branch, not the team's). |
| content **#48, #49, #50** | CMS readers: class metadata, People validation and pictures, precept timestamp corrections | — | Merged 4 Oct 19:24; data publish for #48/#49 was cancelled by the next push, #50's succeeded | Data steward confirms the current data set includes all three (`api/classes/metadata.json`, `api/classes/corrections.json` present). |
| telegram deploys | Production deploy of #131 and later merges | Only the owner approves, in Actions | Deploy runs for pushes to `main` show `completed success` within minutes, so either the `production` environment has no required reviewers yet or the owner approved at once | **Owner:** confirm required reviewers are set under Settings → Environments → production in **both** repositories (OPERATIONS.md and CMS.md both ask for it). |
| R2 bundles | The four approved resource bundles | The owner runs `node resources/publish.mjs --bundle <CI artifact> --execute --bucket cyberjudah-audio --api https://<app host>` | Unchanged | **Owner.** Until then the app behaves as before. Backend engineer keeps the artifact fresh (Resource bundles workflow). |
| Codex environment | Network draft | Owner removes the api.bible hosts, keeps ebible.org and CrossWire, saves and publishes | Unchanged | **Owner.** |
| Held PRs | content #4 (TypeScript 5→7 and major bumps), #10 (conflicts), #25 (audio draft); app #91, #103 | Leave them unless the owner asks | content #4, #10, #25 still open; **app #91 and #103 were merged 4 Oct 16:24 and 16:36** | Leave #4, #10, #25. Nothing to do on #91/#103. |
| content **#40–44** | Copilot's draft class notes (mgZyw88Kvhs, bx1Ub_OMoZ4, QczbDHIehUU, EBEwdiVcsTg, JDW1q70sbhI; issues #35–39) | Review them against the class | Still open drafts | Notes writer reviews each against `scripts/notes/README.md` and the class; comments fixes or recommends to the CEO. |
| content **#47** vs the handoff | The handoff calls the R2 files "transcripts" (about 1,270; 1,021 English, 248 Spanish) | — | #47 calls them outline texts: title, teacher, date, the scriptures in reading order with a line each | Both recorded. The archivist confirms from the files themselves and the CEO corrects this file. |

## 4. Decisions and their dates

| Date | Decision | Where recorded |
|---|---|---|
| 2026-10-03 | The `israel-united-in-christ` Timeline period covers IUIC's leaders and the organization only; no outside characterisations of IUIC anywhere on the Timeline. | `app/scripts/final-captivity/README.md`, research `BRIEF.md` rule 0 |
| 2026-10-04 | Resources: approved Strong's (CC-BY-SA, version unstated), Josephus/Whiston (Scranton 1905), the Jewish Encyclopedia (1901–06, all twelve volumes), Smith's (Houghton Mifflin 1889). On hold: Easton's new bundle, Brenton. Dropped: Webster 1828, Britannica 1911, Nave's, Matthew Henry, Treasury of Scripture Knowledge. Link only: Zondervan, Nelson's, Blue Letter Bible, Bible Hub. | `docs/resources.md`, rule 8 |
| 2026-10-04 | API.Bible is out entirely; ebible.org and CrossWire for catalog research only. KJV with the Apocrypha is the only Bible text; other languages are a later, owner-approved step. American English is covered by the KJV. | `docs/BIBLE_LANGUAGES.md`, rule 4 |
| 2026-10-04 | Credits at cost; $1, $5, $20 top-ups; the free model stays free; no buying from evening to evening on the Sabbath, feast opening and closing days and New Moons by the IUIC calendar. | README of cyberjudah-telegram, rule 9 |
| 2026-10-04 | Timeline wording: "From the classes" and "Quotes and sources". Precept passes: never "the teacher says", "the class teaches", "this precept". | rule 11 |
| 2026-10-04 | Tribe names exactly as the chart (rule 10). | rule 10 |
| 2026-10-05 | The Paperclip team is set up as in `ops/TEAM.md`; the three Claude routines are to be switched off once the Notes writer, Precepts writer and Precepts reviewer are running. | this folder, `ops/SETUP.md` |

## 5. Waiting on the owner

1. **Set up the team** (`ops/SETUP.md`). Done: GitHub connected (§1); the thirteen seats created, all `idle` (§3). Still yours: **merge PR #51** so the seats can read `ops/` from `main`; add the R2 secrets (§2); create the nine routines in the UI or tell CeeJay to dispatch the routine issues (§4); assign [CYB-3](/CYB/issues/CYB-3) to the CEO or run its routine once by hand (§7); switch off the three Claude routines after their replacements' first runs (§5); delete or keep Dex (§3).
2. **Confirm or withdraw the standing approval for precept-pass merges** (§1).
3. **Timeline tagging decisions:**
   - Is Brazil Asher? A class places it in Asher's span: video `0FPiXYsd-z8` at 1:18:56.
   - Should the teacher on "A Time Of Defamation" be Bishop Nathanyel? The re-upload `Dvja0vhkJ6o` is titled that way.
   - Confirm the Caste War Maya as Issachar and Zebulon, and the Garifuna and canal workers as Zebulon and Benjamin.
4. **CMS setup** (from `docs/CMS.md` on the `codex/cms-foundation` branch): create the fine-grained `APP_REPO_TOKEN` (only cyberjudah-telegram; Contents read/write, Pull requests read/write, Checks read) as a Worker secret; give `CYBERJUDAH_TOKEN` the same permissions on cyberjudah; set required reviewers on `production` in both repositories; add `playwright` and `cms-content` as required checks on `main`.
5. **Merges**, when the team reports them ready: the CMS stack #134 → #135 → #136 → #137; #138 and #139 once green.
6. **Publish the four resource bundles** to R2 (§3).
7. **The Codex environment network draft** (§3).
8. **The Spanish R2 files** (248 by the handoff's count): what, if anything, to do with them. The archivist will list them; the CEO asks.
9. **Production deploy approvals** for every merge to `main` of cyberjudah-telegram, and the `production` approval for cyberjudah's data publish when CMS publication begins.

## 6. Blocked

| Item | Blocked on | Owner of the unblock |
|---|---|---|
| ~~Any PR from the team to either repository~~ | Unblocked 5 October 2026, ~02:15 UTC: the owner installed the GitHub connection in Paperclip (token acts as `DevSecObie`). First PR from it: cyberjudah #51 (this `ops/` tree). | — |
| Class archivist: reading R2 | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (read-only) as Paperclip secrets for the archivist's seat, with `R2_BUCKET_NAME=sabbath-classes-images` and `R2_ENDPOINT` | Owner |
| 30 Timeline drafts | Sources at splcenter.org, adl.org and apnews.com could not be reached from the previous environment | Timeline researchers retry from Paperclip (web access); if still blocked, say so plainly |
| Precepts reviewer merging | §1 standing approval unconfirmed | Owner |
| Any seat's first run | PR #51 not merged: every seat's instructions start by reading `ops/` from `main`, which has no `ops/` yet | Owner merges cyberjudah #51 |
| The nine routines (`ops/SETUP.md` §4) | Paperclip refuses an agent creating a routine for another seat (403) | Owner creates them in the UI, or tells CeeJay to dispatch one routine-setup issue per seat after #51 merges |

## 7. Next actions (for the CEO's first cycle)

1. Read `ops/agents/ceo/AGENTS.md`, `ops/RULES.md`, this file, and the open Paperclip issues. Post "Took the seat; here's my understanding" to the owner.
2. Create the first issues: Timeline Judah batch (researcher A); Benjamin batch (researcher B); review issues for #134 (Security, QA); review issues for #138/#139 (QA, Security); Copilot drafts #40–44 review (Notes writer); #47 review (Class archivist, once R2 secrets exist); a Data steward baseline sweep.
3. Ask the owner, with one `ask_user_questions` card: the standing approval for passes (§1); the three tagging decisions (§5.3).
4. Post the first daily report.

## 8. Infrastructure facts (from the handoff §2, for quick reference)

- **cyberjudah** (content and engine): transcripts `blog/transcripts/<video>.json` (about 7,000); passes `data/precepts/classes/<video>.json`; Bible `data/bible/<slug>.json`; People, Strong's, the library; `engine/build.mjs`; `.github/workflows/data.yml` publishes `dist/` to the `data` branch and the static Worker **data.cyberjudah.io** and loads search into D1 (`environment: production`). Notes tooling `scripts/notes/auto.py` (`prepare()`, `--plan`, `--from-json`, `SPEC`); precepts tooling `scripts/precepts/classes.py` (`next`, `series`, `check`); `data/sources/class-teachers.tsv` and `r2-class-teachers.tsv` (merged in #46); `scripts/r2/r2.py` (read-only S3 client).
- **cyberjudah-telegram** (the app): Mini App in `app/` (React, Vite, TelegramUI); one Cloudflare Worker (Hono) in `bot/` with D1, KV `SUBS`, R2 `AUDIO` = bucket `cyberjudah-audio` (also `resources/` bundles and the catalog), Vectorize, Workers AI. Deploys need the GitHub `production` environment approval. Ask: `bot/src/agent.ts`, `ask-tools.ts`, `ai.mjs`, `resource-tools.ts`. Admin APIs: `/api/admin/ask-sources`, `/api/admin/photos`, `/api/admin/usage|refund|adjust`, `PUT /api/resources/catalog` (`ADMIN_IDS`). Timeline: `app/scripts/final-captivity/` (`events.json`, `drafts.json`, `ledger.json`, `periods.json`, `leaders.json`, `check.mjs` with `CJ_ROOT`, `build.mjs` → `app/src/data/final-captivity.json`, `research/`). Resources: `shared/resources.ts`, `app/public/sw.js`, IndexedDB installer, NDJSON bundles in R2, `resources/publish.mjs`; docs `docs/BIBLE_RESOURCES_PHASE1.md`, `PHASE2.md`, `docs/resources.md`, `docs/BIBLE_LANGUAGES.md`, `resources/README.md`.
- **R2 `sabbath-classes-images`** (the owner's): endpoint `https://2ab28c80faa4e6e48e1671865852cb45.r2.cloudflarestorage.com`; about 1,270 `.txt` files under `text/<Rank>/<Teacher>/<en|es>/…` (Bishop, Deacon, Captain, Officer, Unorganized); 1,021 English, 248 Spanish; more coming. Supplementary; read directly; never copied wholesale. "Inventory R2" workflow lists it with Actions secrets `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`.
- **Other agents:** Codex (ChatGPT) builds app features and writes passes (one PR per class); GitHub Copilot drafts notes (#40–44); Claude Code routines on the owner's account: "Write the next class note" (every 5 h, pushes to main), "Precept breakdowns: next book" (daily 13:45 UTC), "Review ChatGPT precept passes" (daily 16:45 UTC), "Resume twelve-tribes timeline research" (disabled).
- **Scheduled GitHub workflows:** cyberjudah: `classes-weekly.yml` (Sunday 06:23 UTC, transcribes the week's classes), `data.yml` (on push to main), `quality.yml` (PRs), `precepts-check.yml` (pass PRs), `r2-inventory.yml` (manual). cyberjudah-telegram: `deploy.yml` (push to main; nightly 03:17 UTC embed/search reload), `e2e.yml` (PRs; Chromium, WebKit, Firefox), `holy-days.yml` (Monday 05:23 UTC; opens a PR on `bot/holy-days` when the calendar changes), `live-smoke.yml` (daily 11:23 UTC against production), `resource-bundles.yml` (PRs touching resources), `stage.yml` (PR staging), `security.yml`, `changelog.yml`.
