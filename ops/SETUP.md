# Setup checklist for the owner

What only you can do to bring the team in `ops/TEAM.md` to life. Each step says why it is yours. Where CeeJay (your chief of staff in Paperclip) can do the step for you once you have given it the means, it says so.

Tick the boxes in order. Nothing in the team can open a PR until §1 is done, and nothing content-side can read the class archive until §2.

---

## 1. Connect GitHub to Paperclip

- [ ] **Accept the GitHub connection card** CeeJay posted on the Paperclip issue for this work ([CYB-2](/CYB/issues/CYB-2)). It asks for a personal access token. Create a **fine-grained token**: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.
  - Resource owner: `DevSecObie`.
  - Repository access: **Only select repositories** → `cyberjudah` and `cyberjudah-telegram`.
  - Repository permissions: **Contents: Read and write**, **Pull requests: Read and write**, **Issues: Read and write**, **Checks: Read-only**, **Actions: Read-only**, **Commit statuses: Read-only**. Metadata read is automatic.
  - Do **not** grant Actions write, Workflows, Administration, Environments, Secrets, or organization access. The team must not be able to approve a deploy or bypass a branch rule with it.
  - Choose an expiry and put its renewal date in your calendar; the Security reviewer's weekly check will remind you a week before.
- [ ] Paste the token only into the Paperclip connection card. Never into chat, a file, an issue or a PR (rule 2).

Why you: the token acts as your account. This one token is for the Paperclip team; it is separate from the Worker's `CYBERJUDAH_TOKEN` and the CMS's `APP_REPO_TOKEN` (§6).

## 2. Add the secrets in Paperclip's secret settings, never in files

Paperclip injects a secret into a seat's run as an environment variable; the seat never sees it otherwise and never writes it anywhere. Add these under the company's secrets and bind each to the seats named.

| Secret (environment variable name) | Value | Bind to | Why |
|---|---|---|---|
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | A **read-only** R2 S3 credential for the bucket `sabbath-classes-images` (Cloudflare → R2 → Manage R2 API tokens → Object Read only, scoped to that bucket). The same pair already exists in the content repo's Actions secrets; create a separate read-only pair for Paperclip so it can be revoked on its own. | Class archivist; Notes writer; Precepts writer | Reading the class outlines/transcripts directly from R2 (handoff §2). Never a write credential. |
| `R2_BUCKET_NAME` | `sabbath-classes-images` | same three seats | Not secret, but `scripts/r2/r2.py` reads it from the environment. |
| `R2_ENDPOINT` | `https://2ab28c80faa4e6e48e1671865852cb45.r2.cloudflarestorage.com` | same three seats | Same. |
| GitHub token | Set in §1; Paperclip's GitHub connection provides it to runs. If a seat needs it as a plain variable for `gh`, bind the connection's token as `GH_TOKEN`. | every seat that opens PRs or reads Actions: all but the Data steward's read-only use (it also needs read) | PRs, reviews, workflow status. |
| Cloudflare API token (optional) | **Read-only**: Account → Workers Scripts Read, D1 Read, Workers R2 Storage Read, scoped to the account that holds `cyberjudah-audio`. | Data steward only, and only if you want its sweep to look at D1 row counts and R2 object counts directly instead of through the public endpoints | Everything the steward checks today is reachable without it (GitHub Actions runs, `data.cyberjudah.io`, the catalog route). Skip it unless the steward's issues say a check needs it. |

Do **not** add to Paperclip: `BOT_TOKEN`, `WEBHOOK_SECRET`, `CLOUDFLARE_API_TOKEN` with write rights, `ANTHROPIC_API_KEY`, `APP_REPO_TOKEN`, `CYBERJUDAH_TOKEN`, `ADMIN_IDS`, `TRANSCRIPTAPI_KEY`, `GJT`. Those belong to the Worker and to GitHub Actions and no seat needs them (rule 2; the team never deploys or publishes).

Why you: only you hold the Cloudflare account and the GitHub account.

## 3. Create each agent in Paperclip with the right adapter and model

**Done 5 October 2026, ~02:40 UTC.** You accepted the confirmation card on [CYB-2](/CYB/issues/CYB-2) and CeeJay created all thirteen seats below through the hire API, each with the matching `ops/agents/<role>/AGENTS.md` as its managed instructions, the `paperclip` skill, the budget, icon and reporting line in this table, and timer heartbeats off. The company does not require board approval for new agents, so every seat is `idle` and ready. The table stays as the record of what was set; the exact model names are in `ops/TEAM.md` and nowhere else.

| Paperclip agent name | Role key | Adapter | Model (from TEAM.md) | Effort / options | Budget (cents/month) | Timer heartbeat | Reports to | Icon |
|---|---|---|---|---|---|---|---|---|
| CEO | `ceo` | `claude_local` | Frontier | effort `high` | 6000 | off (routine + wake on demand) | — (owner) | `crown` |
| App Engineer | `app-engineer` | `codex_local` | Frontier coding | `modelReasoningEffort: high`, `search: true` | 15000 | off | CEO | `code` |
| Backend Engineer | `backend-engineer` | `codex_local` | Frontier coding | `modelReasoningEffort: high`, `search: true` | 15000 | off | CEO | `database` |
| QA Engineer | `qa-engineer` | `claude_local` | Mid | effort `medium` | 6000 | off | CEO | `bug` |
| Security Reviewer | `security-reviewer` | `claude_local` | Frontier | effort `high` | 6000 | off | CEO | `shield` |
| Release Manager | `release-manager` | `claude_local` | Low-cost | effort `low` | 2000 | off (routine) | CEO | `git-branch` |
| Notes Writer | `notes-writer` | `claude_local` | Frontier (long context) | effort `high` | 12000 | off (routine) | CEO | `file-code` |
| Precepts Writer | `precepts-writer` | `claude_local` | Frontier (long context) | effort `high` | 12000 | off (routine) | CEO | `sparkles` |
| Precepts Reviewer | `precepts-reviewer` | `claude_local` | Frontier | effort `high` | 6000 | off (routine) | CEO | `eye` |
| Timeline Researcher A | `timeline-researcher` | `claude_local` | Mid, with web access | effort `medium` | 5000 | off | CEO | `telescope` |
| Timeline Researcher B | `timeline-researcher` | `claude_local` | Mid, with web access | effort `medium` | 5000 | off | CEO | `telescope` |
| Class Archivist | `class-archivist` | `claude_local` | Low-cost | effort `low` | 2500 | off | CEO | `search` |
| Data Steward | `data-steward` | `opencode_local` | Free or local | — | 0 | off (routine) | CEO | `radar` |

For every seat:

- [x] **Instructions.** The full text of `ops/agents/<role>/AGENTS.md` is in each agent's managed instructions bundle as `AGENTS.md` (hire API field `instructionsBundle.files["AGENTS.md"]`), with this line prepended so the seat always reads the latest copy from the repository before working:
  `Before any work: fetch and read the current ops/RULES.md, ops/STATE.md and ops/agents/<role>/AGENTS.md from the main branch of DevSecObie/cyberjudah; the copy below is the version at hire time.`
  That line only works once PR #51 is merged, so **merge PR #51 before any seat runs.**
- [x] **Working directory.** No `adapterConfig.cwd` was set: Paperclip gives each run the project's managed workspace (the `Onboarding` project, strategy `project_primary`), which already holds a `cyberjudah` checkout. The Timeline researchers and the two engineers also need `cyberjudah-telegram`; they clone it beside `cyberjudah` on first use and set `CJ_ROOT` to the cyberjudah checkout. If you prefer a fixed directory per seat, set `cwd` in the agent's settings.
- [x] **Skills.** Every seat has the `paperclip` skill and nothing else. CeeJay keeps `paperclip-create-agent` and `paperclip-board`.
- [ ] **Secrets.** Bind the §2 secrets to the seats named there (owner; see §2).
- [ ] **Existing agent Dex: delete it in the Paperclip UI** (Agents → Dex → Terminate or Delete). The owner decided on 5 October to terminate Dex and keep the hired **Backend Engineer** as its replacement. CeeJay cannot do it: terminate, delete and configure on another agent all answer 403 ("Board access required"), so this is a UI step for the owner. Until then Dex sits idle, unconfigured and outside the team; nothing is assigned to it.
- [x] **Approval.** The company does not require board approval for new agents; every hire landed `idle`.
- [ ] **Verify one seat.** CeeJay cannot read back another agent's configuration (the API redacts it), so open one agent in the Paperclip UI (the CEO, say) and confirm the model, effort, budget and instructions match the table above.

Why you (or CeeJay with your confirmation): hiring is a governed action.

## 4. Create the routines

Routines create an issue for their seat on a schedule; the seat picks it up like any issue. All times UTC. Concurrency `skip_if_active` (never two of the same run at once); catch-up `skip_missed`.

**Status 5 October 2026:** Paperclip refuses an agent creating a routine for another seat (403, "Agents can only manage routines assigned to themselves"), so **each seat creates its own** (the owner's choice on 5 October). CeeJay has pre-created one routine-setup issue per seat, parked in `backlog` and unassigned so no seat wakes before `ops/` is on `main`: [CYB-4](/CYB/issues/CYB-4) CEO, [CYB-5](/CYB/issues/CYB-5) Notes Writer, [CYB-6](/CYB/issues/CYB-6) Precepts Writer, [CYB-7](/CYB/issues/CYB-7) Precepts Reviewer, [CYB-8](/CYB/issues/CYB-8) Release Manager, [CYB-9](/CYB/issues/CYB-9) Data Steward (two routines), [CYB-10](/CYB/issues/CYB-10) Class Archivist, [CYB-11](/CYB/issues/CYB-11) Security Reviewer. Each carries the exact title, cron, policies and the paused-until-§5 rule. **When PR #51 merges**, CeeJay (which checks the PR on a schedule from [CYB-2](/CYB/issues/CYB-2)) assigns each issue to its seat and sets it `todo`; the seat creates its routine, paused, and posts its "took the seat" note on that issue. The standing **"CEO seat" issue is [CYB-3](/CYB/issues/CYB-3)** (unassigned until the merge); the CEO's routine uses it as the parent of its run issues.

Either way, create them **paused** until §5 is done for the one they replace, then activate.

| Routine | Seat | Cron (UTC) | Notes |
|---|---|---|---|
| CEO daily cycle | CEO | `0 6 * * *` | Parent issue: the standing "CEO seat" issue (create it once; the daily reports live there). |
| Write the next class note | Notes Writer | `10 0,5,10,15,20 * * *` | Five runs a day; one note per run. Replaces the Claude Code routine of the same name. |
| Precept pass of the day | Precepts Writer | `45 13 * * *` | Replaces "Precept breakdowns: next book". |
| Review precept passes | Precepts Reviewer | `45 16 * * *` | Replaces "Review ChatGPT precept passes". |
| Keep branches current | Release Manager | `30 2,8,14,20 * * *` | |
| Health sweep | Data Steward | `45 3,9,15,21 * * *` | |
| Holy-days check | Data Steward | `30 6 * * 1` | Monday, after `holy-days.yml` at 05:23. |
| R2 inventory check | Class Archivist | `0 9 * * 3` | Wednesday. Needs §2. |
| Weekly token and scope check | Security Reviewer | `0 7 * * 1` | Monday. Lists token expiries and scopes from the docs and `STATE.md`; never reads a token value. |

## 5. Switch off the Claude Code routines the team replaces

In the Claude Code routines on your account, disable (do not delete, until the team has run a week):

- [ ] **"Write the next class note"** (every 5 hours; it pushed notes straight to `main`). Replaced by the Notes Writer's routine, which opens PRs.
- [ ] **"Precept breakdowns: next book"** (daily 13:45 UTC). Replaced by the Precepts Writer's routine.
- [ ] **"Review ChatGPT precept passes"** (daily 16:45 UTC). Replaced by the Precepts Reviewer's routine. Until you confirm the standing approval in `ops/STATE.md` §1, the reviewer only comments; if you want passes merged daily as before, confirm it on the CEO's card.
- [ ] Leave **"Resume twelve-tribes timeline research"** disabled; the Timeline researcher seats replace it.
- [ ] The GitHub workflow `notes-auto.yml` ("Write class notes", manual only) stays as the fallback it already is.

Switch each off only after its replacement has made one successful run, so no day is missed.

## 6. Repository settings the team's flow relies on

These are in the repos' own docs (`docs/CMS.md`, `docs/OPERATIONS.md`, `engine/README.md`); listed here because the runbook assumes them.

- [ ] **Required reviewers on the `production` environment in both repositories** (Settings → Environments → production). Without them the environment is a label and a merge to `main` deploys at once. The deploy runs on 5 October completed within minutes of merging, so confirm this is set.
- [ ] **Required checks on `main` of cyberjudah-telegram:** keep the existing ones and add `playwright` and `cms-content` (CMS.md).
- [ ] **CMS tokens** (CMS.md "Owner setup"): `APP_REPO_TOKEN` as a Worker secret (fine-grained, only cyberjudah-telegram: Contents RW, Pull requests RW, Checks read); `CYBERJUDAH_TOKEN` given the same permissions on cyberjudah. Neither goes into Paperclip.
- [ ] **Codex environment network draft:** remove the api.bible hosts, keep ebible.org and CrossWire, save and publish (handoff §3).

## 7. First run and verification

- [ ] Run the CEO routine once by hand. The CEO's first post must be "Took the seat; here's my understanding" on the "CEO seat" issue. Read it; correct it in a comment if it is wrong.
- [ ] Answer the CEO's first card: the standing approval for precept-pass merges, and the three Timeline tagging decisions (`ops/STATE.md` §5).
- [ ] After the first Notes Writer and Precepts Writer runs open PRs, switch off the matching Claude Code routines (§5).
- [ ] After a week: read the daily reports' spend lines and adjust caps or tiers in `ops/TEAM.md` through CeeJay.

## What this setup deliberately does not give the team

- No merge rights, no `production` approval, no Worker deploy, no R2 write, no D1 or KV write, no Cloudflare write token.
- No access to `BOT_TOKEN`, `WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `ADMIN_IDS`, the CMS tokens or the transcription keys.
- No ability to change branch protection, environments, secrets or workflows' permissions.

Every one of those stays with you, which is what rule 1 and rule 2 require.
