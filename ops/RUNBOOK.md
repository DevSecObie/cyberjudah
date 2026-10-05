# Runbook: how the CyberJudah team runs

How the day goes, how a change travels from an idea to production, who escalates to whom, and how the CEO seat is swapped. The chart is `ops/TEAM.md`; the owner's rules are `ops/RULES.md`; what is in flight is `ops/STATE.md`; the owner's one-time setup is `ops/SETUP.md`.

Two things shape everything here. First, **the owner merges and deploys; nobody else does** (rule 1). The team's job is to leave the owner with green, reviewed, ordered PRs and one short daily report. Second, **the team runs in Paperclip**: an agent does nothing until an issue wakes it, it works inside that issue, and it leaves a clear end state. There is no chat between agents; there are issues, comments, documents and PRs.

---

## 1. The daily cycle (UTC)

The schedule is staggered so the heavy content seats never run at the same time and the weekly limit of the subscription the `claude_local` seats share is spread out (see §5).

| Time (UTC) | Who | What |
|---|---|---|
| 00:10 | Notes writer | One class note from the queue (`auto.py --plan`), one PR. |
| 02:30 | Release manager | Sweep both repos: merge `main` into team branches, rerun checks, update the ready list and the stacked order. |
| 03:17 | GitHub (`deploy.yml` nightly) | Search index reload and embed on the app's Worker. Not the team's. |
| 03:45 | Data steward | Health sweep: data publish, link check, D1 load, deploy runs and pending approvals, live smoke, bundle artifact, catalog, routine health. Opens issues on failures. |
| 05:10 | Notes writer | Second note. |
| 05:23 Mon | GitHub (`holy-days.yml`) | Reads the IUIC calendar; opens or updates a PR on `bot/holy-days` if it changed. |
| 06:00 | **CEO** | **The daily run.** Reads `STATE.md`, the open issues, the PRs and the steward's issues. Assigns the day's work. Reviews what landed against the rules. Posts the **daily report** to the owner. Updates `STATE.md`. |
| 06:23 Sun | GitHub (`classes-weekly.yml`) | Transcribes the week's Sabbath classes into `blog/transcripts/`. |
| 06:30 Mon | Data steward | Holy-days check: did `holy-days.yml` run; did it open a PR; is the PR on the ready list for the owner. |
| 08:30 | Release manager | Sweep. |
| 09:00 Wed | Class archivist | Weekly R2 inventory check: new files since last week, reported to the CEO. |
| 09:45 | Data steward | Health sweep. |
| 10:10 | Notes writer | Third note. |
| 11:23 | GitHub (`live-smoke.yml`) | Production user journeys. The steward reads the result at 15:45. |
| 13:45 | Precepts writer | One precept pass (the next class, or the book the CEO set), one PR. Replaces the Claude Code routine "Precept breakdowns: next book". |
| 14:30 | Release manager | Sweep. |
| 15:10 | Notes writer | Fourth note. |
| 15:45 | Data steward | Health sweep. |
| 16:45 | Precepts reviewer | Reviews every open `precepts/*` PR against its class. Merges only under the standing approval in `STATE.md` §1; otherwise comments exact fixes. Replaces the Claude Code routine "Review ChatGPT precept passes". |
| 20:10 | Notes writer | Fifth note. |
| 20:30 | Release manager | Sweep. |
| 21:45 | Data steward | Health sweep. |
| any time | App engineer, Backend engineer, QA, Security, Timeline researchers, Class archivist | Wake when the CEO (or a sweep) assigns an issue; work it; end it. |
| any time | Owner | Merges from the ready list; approves `production` deploys in Actions; answers the CEO's cards. |

The Notes writer's five runs replace the Claude Code routine "Write the next class note" (every 5 hours). Unlike that routine, the seat opens a PR; it never pushes to `main`.

### The CEO's daily run, step by step

1. Read `ops/STATE.md`, then `GET` the open Paperclip issues (todo, in progress, in review, blocked), then the open PRs and the latest workflow runs on both repositories (`gh pr list`, `gh run list`).
2. Triage the Data steward's new issues: assign each to the seat that owns the thing that failed, or close it with a note if it is a duplicate.
3. Turn the roadmap (`STATE.md` §2) into the day's issues. One issue, one deliverable, one seat. Self-contained descriptions: the seat may not be able to read anything else. For every new PR that has no review issues yet, create one QA review issue and one Security review issue as children of the PR's issue, and block the PR's issue on them.
4. Review what landed since yesterday against `ops/RULES.md`: open the PRs, read the descriptions, spot-check the content PRs' quotes against `data/bible`. Anything that breaks a rule gets a comment and comes off the ready list.
5. Post the daily report (below) as one comment on the CEO's standing "CEO seat" issue, and as the same text in a `report-YYYY-MM-DD` document on that issue.
6. Update `ops/STATE.md`: decisions and their dates, waiting on the owner, blocked, next actions, the standing approvals. Open the small `ops: state YYYY-MM-DD` PR on branch `ops/state-YYYY-MM-DD` and keep the same text in the `state` document on the "CEO seat" issue, so the file in the repo and the document in Paperclip say the same thing even while the PR waits.
7. If the owner must decide something, save **one** `ask_user_questions` card on the relevant issue (several questions on one card, not several cards) and set that issue to `in_review`. For a yes/no on a specific document or plan, use `request_confirmation`.
8. End the run with the "CEO seat" issue `in_progress` (its routine wakes it tomorrow) and every other issue in a clear state.

### The daily report

One comment, four headings, nothing else. Short. Links to PRs and issues (ticket links in the `[CYB-12](/CYB/issues/CYB-12)` form).

```
## Daily report YYYY-MM-DD

### Done
- …merged / landed / published since the last report…

### Waiting on the owner
- Ready to merge, in order: #… , #… (from ops/RELEASES.md)
- Production deploys to approve: …
- Decisions: … (link to the card)

### Blocked
- … (what, on whom, the exact action that unblocks it)

### Next
- … (what each seat does today)

Spend this month: <seat>: $x of $y … Subscription weekly allowance: <used / headroom as the host reports it, or "not reported">.
```

## 2. How work flows: issue → agent → PR → QA → Security → Release manager → owner

```
 roadmap (STATE.md §2)            Data steward's failure issues           owner's requests (via CeeJay or a comment)
          │                                   │                                        │
          └──────────────► CEO: one Paperclip issue per deliverable, assigned to a seat ◄┘
                                              │
                                              ▼
                   the seat: works the issue in its own branch, runs the repo's checks, opens ONE PR
                   (gh pr create; pull_request work product on the issue; comment with what changed / blocked / needs the owner)
                                              │
                           ┌──────────────────┼──────────────────┐
                           ▼                  ▼                  │
                 QA review issue      Security review issue      │   (children of the PR's issue; the PR's issue is blocked on both)
                 typecheck, unit,     secrets, ADMIN_IDS,        │
                 Playwright ×3,       allowlist + sha CAS,       │
                 reproduce, write     token scopes, whitelist,   │
                 missing tests        keys out of client,        │
                                      privacy                    │
                           │                  │                  │
                           └────────┬─────────┘                  │
                                    ▼                            │
                 both `done` with verdicts → the PR's issue wakes (issue_blockers_resolved)
                                    │                                               
                                    ▼                                               
                 Release manager (6-hourly sweep): main merged in, CI green, changelog in order,
                 stacked-PR order recorded → the PR goes on ops/RELEASES.md ("ready to merge")
                                    │
                                    ▼
                 CEO's daily report → the OWNER merges, in the listed order, and approves the
                 `production` deploy in GitHub Actions (cyberjudah-telegram: deploy.yml;
                 cyberjudah: data.yml publishes the data set)
                                    │
                                    ▼
                 Data steward confirms the deploy / publish ran; CEO records it under Done.
```

Rules of the road:

- **One change, one PR, CI green before review** (handoff §4). A PR that is red is not reviewed; the seat fixes it first. Dependabot PRs have no secrets so their `stage` check is red by design; judge them on the rest (OPERATIONS.md).
- **Review verdicts are deliverables.** QA and Security post their findings on their own review issue and mark it `done`, whether or not they found problems. "Blocks anything red" means: the verdict says *do not merge*, the Release manager keeps the PR off the ready list, and the CEO reassigns the fix to the seat that owns the code. Reviewers never fix someone else's branch unless the CEO assigns it.
- **Only the owner merges.** The one exception is the Precepts reviewer merging a single-file precept pass under the owner's standing approval, and only while `STATE.md` §1 records that approval as confirmed.
- **Other people's branches are not ours.** Codex's (`codex/*`, `cms/*`), Copilot's (`copilot/*`), Dependabot's, the owner's and the `claude/*` and `ceejay/*` branches are reviewed and ordered, never rewritten, rebased or force-pushed. Fixes for Codex's passes are requested as `@codex` comments on the PR (the repo's `AGENTS.md`).
- **Stacked PRs** keep the order the author set (today: the CMS stack #134 → #135 → #136 → #137; #139 on #138). After a parent merges, the Release manager asks the CEO before retargeting a dependent PR that is not the team's; for the team's own stacks it retargets and reruns checks.
- **Content data files** (`events.json`, `drafts.json`, `ledger.json`, passes, notes) are never hand-merged. Conflicts go back to the author's seat, which merges `main` in and reruns the kit or the gate.
- **Secrets never move through this flow.** A token the Worker needs is a Worker secret the owner sets; a token a seat needs is a Paperclip secret the owner adds (`ops/SETUP.md` §2). Nothing is pasted into issues, comments, documents, PRs or files (rule 2).
- **Production approval is separate from merging.** Every merge to `main` of cyberjudah-telegram waits in `deploy.yml` for the `production` environment; the CMS's data publish on cyberjudah waits in `data.yml` the same way. The owner approves the newest pending run; an older run superseded by a newer one can be rejected (OPERATIONS.md). The Data steward flags pending approvals in its sweep so the daily report lists them.

### Paperclip mechanics every seat follows

- A seat works only the issue that woke it; the harness has already checked it out.
- Progress is left as comments (short status line, bullets, links), documents on the issue, and work products: a `pull_request` work product for every PR opened, an artifact for any file the owner should inspect.
- The end state is one of: `done` (complete, verified); `in_review` with a real waiting path (a reviewer, a saved card, a linked approval); `blocked` with first-class blockers (`blockedByIssueIds`) or a named owner and exact action. Nothing is left `in_progress` without a live continuation.
- Long or parallel work is delegated as child issues, never polled.
- Comments to the owner are read by the owner: terse, plain, no narration of tool calls.

## 3. Escalation paths

| Situation | Who escalates | To whom | How |
|---|---|---|---|
| A seat is blocked by something another seat can do | the seat | CEO | Mark the issue `blocked` with the blocker issue, or comment with a structured mention of the CEO. The CEO reassigns or creates the issue. Never ask the owner for what a seat can do. |
| An outside service blocks a run (proxy, usage limit, 403, unreachable host) | the seat | CEO, then owner | Say so plainly in the issue: which host, which call, what the owner must set up. Leave the branch as is. Do not work around it (handoff §4). The CEO puts it under Blocked in the daily report. |
| A rule conflict (a checker and a rule disagree; a source and a class disagree in a way the data shape cannot hold) | the seat | CEO | Stop, record both sides in the issue, ask. The CEO decides within the rules or asks the owner on a card. |
| A security finding in a PR | Security reviewer | CEO at once; owner the same day | Verdict on the review issue (`done`, *do not merge*), a comment on the PR without quoting any secret, and a mention of the CEO. If a live secret is exposed anywhere, the CEO tells the owner the same hour to rotate it, naming where, never the value. |
| A production failure (deploy failed, data publish failed, live smoke red, D1 load failed, health page) | Data steward | CEO | One issue per failure with the run URL and the failing step. The CEO assigns the owning seat. Nothing is re-run that deploys or publishes. INCIDENTS.md in cyberjudah-telegram records outages and data problems; the owning engineer writes the entry in its fix PR. |
| A content question only the owner can settle (a tribe tag, a teacher attribution, a resource edition, Spanish files) | the seat → CEO | owner | The CEO batches questions into one `ask_user_questions` card on the relevant issue and lists them under Waiting on the owner. |
| A hire, a new routine or a changed schedule | CEO | owner, via CeeJay | The CEO proposes in the daily report; CeeJay carries out hires and configuration with the owner's confirmation (formal approval gates apply). |
| The CEO itself is stuck or its runtime is failing | CeeJay or the owner | owner | Swap the seat (§6). |
| A standing approval is needed (e.g. precept-pass merges) | CEO | owner | `request_confirmation` card; the answer and its date go into `STATE.md` §1. Until it is recorded, the exception does not exist. |

Escalations never skip the CEO except two: an exposed secret, and the owner addressing a seat directly in its issue (then the seat answers there and tells the CEO).

## 4. Reviews in detail

**QA engineer**, per PR: check out the branch; `npm ci`; `npm run typecheck`; `npm test`; `npm run build`; `npx playwright install --with-deps <browser>` and `npm run test:e2e --workspace app -- --project=<browser>` for chromium, firefox and webkit (the `e2e.yml` matrix); for Timeline data, `CJ_ROOT=<cyberjudah checkout> node app/scripts/final-captivity/check.mjs` (0 problems); for the content repo, `node engine/check.mjs`, `npm run corpus:test`, `npm run notes:lint`, `python3 scripts/precepts/classes.py check <file>`. Reproduce the bug the PR claims to fix. Write the missing tests on a `qa/<pr>-<topic>` branch or as a suggestion on the PR. Verdict on the review issue: *merge-ready*, *needs tests* (with the list), or *do not merge* (with the red check or the reproduction).

**Security reviewer**, per PR, in this order: secrets (grep the diff for keys, tokens, `initData`, `.env`; check the client bundle never receives a token); admin checks (every admin route server-side on `ADMIN_IDS`; no client-side gating); the CMS path allowlist and the sha compare-and-swap on each file; token scopes (`APP_REPO_TOKEN`: only cyberjudah-telegram, Contents and Pull requests read/write, Checks read; `CYBERJUDAH_TOKEN` scoped to cyberjudah; nothing with Actions, Workflows, Administration or bypass rights); the outside-source whitelist (`ask:sources` in KV, edited only through the admin route and the CMS flow); keys staying out of the client; the privacy rules (PRIVACY.md and SECURITY.md: initData HMAC and freshness, webhook secret header, no raw initData or user profiles in logs, deletion paths). Verdict on the review issue; a comment on the PR that never quotes a secret.

**Precepts reviewer**, per `precepts/*` PR: see `ops/agents/precepts-reviewer/AGENTS.md`.

## 5. Spending and the weekly limit

- Every `claude_local` seat draws on one subscription of the owner's, which has a weekly allowance; the two engineers run on the `codex_local` adapter to spread the load. The schedule above keeps the Notes writer, Precepts writer and Precepts reviewer apart.
- Paperclip tracks estimated spend per agent against `budgetMonthlyCents` (the caps in `ops/TEAM.md`). At 80% a seat does critical work only; at 100% Paperclip pauses it. The CEO reports spend per seat every day and raises a cap only with the owner's say.
- If a run stops at a usage limit, the seat says so in its issue and stops; it does not switch models on its own. The CEO moves work later in the week or asks the owner whether to change the seat's tier (`ops/TEAM.md` lists each seat's fallback).
- Content seats never fall below Mid (`ops/TEAM.md`), whatever the spend.

## 6. Swapping the CEO seat

The CEO's knowledge lives in files and in Paperclip, never in one model's memory, so any runtime can take the seat.

What makes the seat portable:

- `ops/agents/ceo/AGENTS.md` is self-sufficient: role, rules, scope, how to work, hand-offs, backlog, background.
- `ops/STATE.md` is current at the end of every cycle: roadmap, decisions with dates, waiting on the owner, blocked, next actions, standing approvals.
- Every assignment and decision is a Paperclip issue or comment; the daily reports are on the "CEO seat" issue.

Swap steps (the owner, or CeeJay with the owner's confirmation):

1. Pause the current CEO agent in Paperclip (so no run starts mid-swap). Note the time in `STATE.md` under Decisions.
2. Change the CEO agent's adapter or model: for example `claude_local` on the server with a different model, a cloud Claude Code session the owner opens, `codex_local`, or another adapter installed here (`ops/TEAM.md` lists the tiers; the exact model name goes only in `TEAM.md`). Paste the current `ops/agents/ceo/AGENTS.md` into the agent's managed instructions bundle (`ops/SETUP.md` §3 says how), or leave it if it is unchanged.
3. Unpause the agent and run the CEO routine once by hand (Paperclip → the routine → Run now) or wake it with a comment on the "CEO seat" issue.
4. The new CEO's first action, before anything else: read `ops/agents/ceo/AGENTS.md`, `ops/RULES.md`, `ops/STATE.md` and the open Paperclip issues, then post **"Took the seat; here's my understanding"** to the owner as a comment on the "CEO seat" issue: the roadmap as it sees it, what is waiting on the owner, what is blocked, what it will do today, and any contradiction it found between `STATE.md` and GitHub. It acts only after posting.
5. The owner (or CeeJay) reads that post. If it is wrong, the owner says so in a comment and the CEO re-reads before acting.

If `STATE.md` has lagged (no update in two cycles), the incoming CEO rebuilds it from the Paperclip issues and GitHub before assigning anything, and says so in its first post.

## 7. Incidents and rollbacks

- Outages, failed deploys and data problems are recorded in `docs/INCIDENTS.md` of cyberjudah-telegram by the engineer who fixes them (CONTRIBUTING.md).
- A rollback is a production deploy and needs the owner's approval like any other (`rollback.yml` in cyberjudah-telegram targets `production`). The team prepares the rollback PR or names the commit; the owner runs it.
- Resource catalog rollback is the admin's action in the app or through `publish.mjs` with the admin's own credentials (resources/README.md). No seat does it.
