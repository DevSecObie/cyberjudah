# The CyberJudah team in Paperclip

The org chart for the always-on team that builds and maintains CyberJudah. Each seat has a working-instructions file under `ops/agents/<role>/AGENTS.md` that the agent reads at every start; the owner's rules are in `ops/RULES.md`; how the day runs is in `ops/RUNBOOK.md`; what is in flight is in `ops/STATE.md`; the owner's one-time setup is in `ops/SETUP.md`.

**This is the only file where model names may appear** (owner's rule 12). Everywhere else, speak of tiers and seats.

## The chart

```
Owner (Obie, DevSecObie)  ──  approves every merge and every production deploy
│
├── CeeJay (chief of staff, existing)  ──  the owner's point of contact in Paperclip; sets the team up and keeps this folder current
│
└── CEO  ──  owns the roadmap, assigns, reviews against the rules, reports daily
    ├── App engineer            (cyberjudah-telegram: app/)
    ├── Backend engineer        (cyberjudah-telegram: bot/, shared/, resources/)
    ├── QA engineer             (reviews every PR; tests)
    ├── Security reviewer       (reviews every PR; secrets, admin checks, allowlists, privacy)
    ├── Release manager         (branches current, CI green, merge order, changelog, "ready to merge" list)
    ├── Notes writer            (cyberjudah: one class note at a time)
    ├── Precepts writer         (cyberjudah: one precept pass per PR; next-book breakdowns)
    ├── Precepts reviewer       (checks every pass against its class)
    ├── Timeline researcher A   (Judah batch, then shared upkeep)
    ├── Timeline researcher B   (Benjamin, Levi–Simeon batches, then shared upkeep)
    ├── Class archivist         (the sabbath-classes-images R2 bucket, read-only)
    └── Data steward            (publishes, link check, D1 loads, holy-day calendar check, workflow health)
```

Everyone reports to the CEO. The CEO reports to the owner. CeeJay is outside the production chain: it hires and configures seats, carries the owner's requests into Paperclip, and does not write product code or content. The existing agent **Dex** (codex_local, unconfigured) is not part of the team: CeeJay could not reconfigure it, so a separate Backend engineer was hired (5 October 2026); the owner can delete Dex or keep it for other work. See `ops/SETUP.md` §3.

## Model tiers in this Paperclip

The adapters installed here are `claude_local`, `codex_local`, `gemini_local`, `opencode_local`, `kimi_local` and others. These are the models the tiers map to, chosen from what the host actually exposes (checked 5 October 2026).

| Tier | Model | Fallback | Reason |
|---|---|---|---|
| Frontier | `claude_local` · `claude-fable-5-1` | `claude-opus-5` | The strongest judgement available here, for fidelity to the classes, review and security. |
| Frontier coding | `codex_local` · `gpt-6-astra` (reasoning effort `high`) | `claude_local` · `claude-opus-5` | Strong unattended coding; it also spreads the load off the Claude subscription's weekly limit, and Codex already builds the app's features. |
| Frontier (long context) | `claude_local` · `claude-opus-5` | `claude-sonnet-5` | Reads a whole class transcript and the KJV data in one sitting without losing the thread. Never below Mid for content. |
| Mid | `claude_local` · `claude-sonnet-5` | `claude-opus-5` (content) or `codex_local` · `gpt-5.6-sol` (QA) | Strong and cheaper; web fetch and search are available for research. |
| Low-cost | `claude_local` · `claude-haiku-4-5` | `claude-sonnet-5` | Fast and cheap for mechanical work. |
| Free or local | `opencode_local` · `opencode/nemotron-3.5-lightning-free` | `gemini_local` (default model, free tier) | No-cost model for scripted checks that open issues. No local model server (Ollama) is installed on this host; if one is added, point this seat at it. |

Budgets below are Paperclip monthly caps (`budgetMonthlyCents`) used to track estimated spend and pause a runaway seat; the Claude and Codex seats run on the owner's subscriptions, so the caps are a tracking ceiling, not a bill. **Weekly-limit risk:** every `claude_local` seat draws on one subscription's weekly allowance. The schedules below are staggered so that the heavy content runs never overlap, the two engineers sit on Codex, and the CEO reports spend in every daily report (see `ops/RUNBOOK.md`, "Spending").

## The seats

| Seat | Role | Reports to | Tier · model (fallback) | Runs | Budget / month | May write to | Never |
|---|---|---|---|---|---|---|---|
| **CEO** | Owns the roadmap (handoff §3); turns it into Paperclip issues and assigns them; reviews work against the rules; keeps `ops/STATE.md`; sends the owner one daily report: done, waiting on the owner, blocked, next. | Owner | Frontier · `claude-fable-5-1` (`claude-opus-5`) | Routine daily 06:00 UTC + wake on demand (assignments, mentions, children completed) | $60 | **cyberjudah:** `ops/**` only (`STATE.md`, this folder). Paperclip: issues, comments, documents, routines of its own. | Merge or deploy; write product code or content; create agents without the owner's confirmation. |
| **App engineer** | The Telegram Mini App (`app/`): React, TelegramUI, Liquid Glass, the reader and Bible Strong layout, the Timeline, the CMS screens, the resource installer, offline. | CEO | Frontier coding · `gpt-6-astra` (`claude-opus-5`) | Trigger: issues assigned by the CEO | $150 | **cyberjudah-telegram:** `app/**`, `shared/**` (with the Backend engineer), `docs/**` for the app, `CHANGELOG.md`, `app/scripts/final-captivity/*.mjs` (tools only, not the data files). | Touch `bot/`, Worker secrets or `wrangler.jsonc` bindings without a Backend engineer review; edit `events.json`/`drafts.json` by hand; merge; deploy; force-push another's branch. |
| **Backend engineer** | The Worker (`bot/`): Ask and its tools, credits at cost and the holy-days gate, D1, KV, R2, resources and catalog, the CMS API, admin APIs, reminders. | CEO | Frontier coding · `gpt-6-astra` (`claude-opus-5`) | Trigger: issues assigned by the CEO | $150 | **cyberjudah-telegram:** `bot/**`, `shared/**`, `resources/**`, `docs/**` for the Worker, `.github/workflows/*.yml` (with Security review), `CHANGELOG.md`. | Run `wrangler deploy`, `publish.mjs --execute` or any remote write; change `ADMIN_IDS`, token scopes or the whitelist mechanism without Security review; merge; deploy. |
| **QA engineer** | Reviews every PR. Runs typecheck, the unit tests and Playwright in Chromium, Firefox and WebKit. Reproduces bugs. Blocks anything red and writes the missing tests. | CEO | Mid · `claude-sonnet-5` (`gpt-5.6-sol`) | Trigger: a review issue per PR (created by the Release manager's sweep or the CEO) | $60 | **both repos:** test files only (`app/tests/**`, `app/e2e/**`, `bot/tests/**`, `engine/*.test.mjs`, `scripts/**/test_*.py`), on the PR's own branch or a `qa/<pr>` branch. Review comments on any PR. | Change product code to make a test pass; skip, disable or quarantine a test; approve a PR with a red check; merge. |
| **Security reviewer** | Reviews every PR for: secrets; admin checks (`ADMIN_IDS`); the CMS path allowlist and sha compare-and-swap; token scopes; the outside-source whitelist; keys staying out of the client; the privacy rules. | CEO | Frontier · `claude-fable-5-1` (`claude-opus-5`) | Trigger: a review issue per PR; plus the weekly token-and-scope check (Monday) | $60 | Review comments only. May open a PR of its own only for a security fix the CEO assigns. | Merge; "fix" a finding on someone else's branch without being asked; paste any secret, token fragment or `initData` anywhere. |
| **Release manager** | Keeps PR branches current (merge main in; never force-push someone else's branch) and CI green. Keeps the merge order of stacked PRs and the changelog. Hands the owner an ordered "ready to merge" list. | CEO | Low-cost · `claude-haiku-4-5` (`claude-sonnet-5`) | Routine every 6 h (02:30, 08:30, 14:30, 20:30 UTC) + trigger | $20 | **both repos:** merge commits from `main` into team PR branches (never Codex's, Copilot's, Dependabot's or the owner's branches without being asked); `CHANGELOG.md`; `ops/RELEASES.md` (the ready-to-merge list). | Merge; approve deploys; force-push; rebase someone else's branch; retarget a PR without the CEO's note; resolve a conflict in content data files (`events.json`, `drafts.json`, passes, notes). |
| **Notes writer** | One class note at a time: `python3 scripts/notes/auto.py --plan`, a draft by `auto.SPEC`, then render and gate with `auto.py --from-json`. Replaces the 5-hourly Claude routine. Also reviews Copilot's draft notes. | CEO | Frontier (long context) · `claude-opus-5` (`claude-sonnet-5`) | Routine every 5 h at 00:10, 05:10, 10:10, 15:10, 20:10 UTC (one note per run) + trigger for reviews | $120 | **cyberjudah:** one new note under `blog/<year>/` or `captains/<year>/` per PR plus what `npm run notes:fix` rewrites; `data/names.tsv` rows for new spellings; review comments on `copilot/*` PRs. | Push to `main`; type a verse by hand; edit transcripts; write about captions or the recording; soften the teacher's words; guess a teacher, date or video id. |
| **Precepts writer** | Precept passes, one class per PR, strictly by `AGENTS.md` at the repo root (the depth and voice of its approved example), plus the "next book" breakdowns. Replaces the daily "Precept breakdowns: next book" routine. | CEO | Frontier (long context) · `claude-opus-5` (`claude-sonnet-5`) | Routine daily 13:45 UTC (one pass) + trigger for assigned classes | $120 | **cyberjudah:** exactly one `data/precepts/classes/<video id>.json` per PR on `precepts/<video id>`. Nothing else. | Edit any other file in a pass PR; open a second PR for a fix (push to the same branch); invent a reference; write "the teacher says", "the class teaches" or "this precept"; merge. |
| **Precepts reviewer** | Checks every pass against its class: refs actually read, `at`, `ts`, exact KJV quotes, the voice. Merges only with the owner's standing approval for passes; otherwise comments the writer with exact fixes. Replaces the daily "Review ChatGPT precept passes" routine. | CEO | Frontier · `claude-fable-5-1` (`claude-opus-5`) | Routine daily 16:45 UTC + trigger when a `precepts/*` PR opens or is updated | $60 | Review comments on `precepts/*` PRs (team, Codex or others). Merge of a pass **only** under the standing approval recorded in `ops/STATE.md`. | Edit a pass itself; merge anything that is not a single-file pass with green checks; merge when the standing approval line is absent. |
| **Timeline researcher A** | Finish **Judah** (the gaps 1619 to today) with the research kit; then the 30 drafts' unreachable sources, and upkeep. Every event is sourced and searched in the classes; "the ring" rule applies to charges. | CEO | Mid, with web access · `claude-sonnet-5` (`claude-opus-5`) | Trigger: one batch per issue | $50 | **cyberjudah-telegram:** `app/scripts/final-captivity/research/batches/<batch>.json`; the merged `events.json`, `drafts.json`, `ledger.json` through `tmerge.py` only; `COVERAGE.md`. | Hand-edit `events.json`/`drafts.json`; invent a number, quote or source; record outside characterisations of IUIC; use a tribe name not on the chart; merge. |
| **Timeline researcher B** | Finish **Benjamin** (the West Indies) and **Levi–Simeon** (Haiti and the Dominican Republic) the same way; then share the drafts and upkeep. | CEO | Mid, with web access · `claude-sonnet-5` (`claude-opus-5`) | Trigger: one batch per issue | $50 | Same as A. The two never work the same batch; the CEO assigns batches and the researchers' PRs are stacked, not parallel, on the three data files. | Same as A. |
| **Class archivist** | The `sabbath-classes-images` R2 bucket (read-only): match files to classes; fill teacher and date gaps (corrections to `class-teachers.tsv`, the R2 table to `r2-class-teachers.tsv`); list the classes found only in R2; hand the Spanish files to the CEO for a decision; give the writers checked wording with its R2 key and line. | CEO | Low-cost · `claude-haiku-4-5` (`claude-sonnet-5`) | Trigger: issues from the CEO or a writer's request; weekly inventory check (Wednesday 09:00 UTC) | $25 | **cyberjudah:** `data/sources/class-teachers.tsv`, `data/sources/r2-class-teachers.tsv`, `data/sources/r2-classes.tsv` (if #47 lands), `scripts/r2/**` (tools), `r2-inventory/**` on a working branch only. | Copy R2 text wholesale into a repo; write notes or passes; set a teacher or date it cannot point to a file name or line for; merge. |
| **Data steward** | Watches data.cyberjudah.io publishes, the link check, D1 search loads, the weekly IUIC holy-day calendar check, the health of routines and workflows, and R2 bundle status. Opens an issue on any failure. | CEO | Free or local · `opencode/nemotron-3.5-lightning-free` (`gemini_local`) | Routine every 6 h at 03:45, 09:45, 15:45, 21:45 UTC + Monday 06:30 UTC holy-days check | $0 | Paperclip issues only. No repository writes. | Re-run a workflow that deploys or publishes; close someone else's issue; "fix" anything; touch secrets. |

Seat notes:

- **Two researchers, one `AGENTS.md`.** Both Timeline seats read `ops/agents/timeline-researcher/AGENTS.md`; the seat letter and the batch come from the Paperclip issue. They are two agents in Paperclip (A and B) so they run in parallel on different batches.
- **CeeJay** keeps its existing configuration and instructions; it is listed here so the chart is complete.
- **Codex (ChatGPT) and GitHub Copilot** keep working from the owner's prompts and issue templates as before. They are not Paperclip agents. The team reviews their PRs (QA, Security, the Precepts reviewer, the Notes writer) and the Release manager keeps their merge order, but never rewrites their branches.

## What each seat may write to, by repository

| Repository | Paths | Seats |
|---|---|---|
| **DevSecObie/cyberjudah** | `ops/**` | CEO (`STATE.md`, `RELEASES.md` via the Release manager), CeeJay |
| | `blog/<year>/*.md`, `captains/<year>/*.md`, `data/names.tsv` | Notes writer |
| | `data/precepts/classes/<video id>.json` (one per PR) | Precepts writer |
| | `data/sources/class-teachers.tsv`, `data/sources/r2-*.tsv`, `scripts/r2/**`, `r2-inventory/**` | Class archivist |
| | `engine/*.test.mjs`, `scripts/**/test_*.py` | QA engineer |
| | everything else (`engine/`, `scripts/`, `data/bible/`, `blog/transcripts/`, `history/`, `site/`, workflows) | nobody on the team without an explicit CEO issue; `blog/transcripts/**` and `data/bible/**` are never edited by agents |
| **DevSecObie/cyberjudah-telegram** | `app/**` | App engineer; QA (tests) |
| | `bot/**`, `resources/**`, `.github/workflows/**` | Backend engineer; QA (tests); Security (assigned fixes) |
| | `shared/**` | App and Backend engineers together |
| | `app/scripts/final-captivity/research/**`, and `events.json`/`drafts.json`/`ledger.json`/`COVERAGE.md` through the kit | Timeline researchers |
| | `CHANGELOG.md`, `docs/**` | the engineer whose change it is; Release manager for the changelog |
| | `strong/**` (the Bible Strong fork), `PRIVACY.md`, `SECURITY.md`, `LICENSE` | nobody without the owner |
| **R2 `sabbath-classes-images`** | read only | Class archivist; Notes and Precepts writers may read a file the archivist points them to |
| **R2 `cyberjudah-audio`**, D1, KV, Vectorize, Worker secrets | no agent writes; the owner (an admin) publishes bundles and deploys | — |

## What nobody on the team ever does

1. Merge a PR or approve a production deploy (rule 1). The sole, revocable exception: the Precepts reviewer's merge of a single-file pass under the owner's standing approval.
2. Put a secret, token, key or Telegram `initData` in the client, a commit, a PR, a comment, a document or a chat (rule 2).
3. Force-push or rebase someone else's branch; resolve another's conflicts in content data by hand.
4. Skip, disable, quarantine or weaken a test or a checker to get green.
5. Invent a scripture reference, quote, date, number, teacher, video id or source (rule 3).
6. Change the Bible text or the transcripts (rule 4; `data/bible/**`, `blog/transcripts/**`, `history/transcripts/**`).
7. Record outside characterisations of IUIC on the Timeline, or use a tribe name not on the chart (rules 6 and 10, and the owner's direction of 3 October 2026).
8. Name an AI model anywhere but this file (rule 12).
9. Work around an outside block (a proxy, a usage limit, a 403) instead of saying so plainly and telling the owner what to set up.
10. Ask the owner to do what an agent on the team can do; escalate to the CEO first.
