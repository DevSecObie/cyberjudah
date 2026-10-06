# Ready to merge — 2026-10-06 16:40 UTC

## Ready, in order

| # | Repo | PR | Title | Checks | Reviews | Merge order | Deploy approval that follows |
|---|---|---|---|---|---|---|---|
| 1 | cyberjudah | [#70](https://github.com/DevSecObie/cyberjudah/pull/70) | Class note: The Slave Mentality Yesterday & Today | CI green (`validate`) | Notes need no further review; checks pass | standalone | none (content repo, no gate) |
| 2 | cyberjudah | [#57](https://github.com/DevSecObie/cyberjudah/pull/57) | Precept pass: You Are Hated And In Hell | CI green | Precepts Reviewer: faithful, 0 problems | standalone | none — standing approval for precept-pass merges (`ops/STATE.md` §1) still unconfirmed, so this is the owner's own merge |
| 3 | cyberjudah | [#59](https://github.com/DevSecObie/cyberjudah/pull/59) | Precept pass: The Slave Mentality Yesterday & Today | CI green | Precepts Reviewer: faithful, 0 problems (fix applied, re-reviewed) | standalone | same note as #57 |
| 4 | cyberjudah | [#63](https://github.com/DevSecObie/cyberjudah/pull/63) | Precept pass: Blood Toucheth Blood | CI green | Precepts Reviewer: faithful, 0 problems (round 2) | standalone | same note as #57 |
| 5 | cyberjudah | [#66](https://github.com/DevSecObie/cyberjudah/pull/66) | Check two-way family links on every Apocrypha person batch (touches `.github/workflows/**`) | CI green | Security/QA re-check (CYB-154) confirmed: 0 problems, one non-blocking nit | standalone | security-sensitive (workflow-adjacent); owner's call |
| 6 | telegram | [#146](https://github.com/DevSecObie/cyberjudah-telegram/pull/146) | Deps (production): react-router 7→8 | all green on current head, still **behind `main`** | n/a (dependency bump) | standalone | production deploy — **major-upgrade go-ahead needed from the owner first**; `ceejay/*` branch, not mine to merge main into without the CEO's note |
| 7 | telegram | [#147](https://github.com/DevSecObie/cyberjudah-telegram/pull/147) | Deps (production): marked 16→18 | all green on current head, still **behind `main`** | n/a (dependency bump) | standalone | production deploy — **major-upgrade go-ahead needed; renders transcript text**; same branch-ownership note as #146 |

## For the owner right now — production deploys on the gate

| Run | Repo | Commit | What | Status |
|---|---|---|---|---|
| [37483332759](https://github.com/DevSecObie/cyberjudah-telegram/actions/runs/37483332759) | telegram | `e5566b2` (#153, R2 image route) | security+QA reviewed clean before merge | Owner already answered **skip** — left unapproved, no further action |
| [37489577515](https://github.com/DevSecObie/cyberjudah-telegram/actions/runs/37489577515) | telegram | `514eb53` (#150, Timeline portraits: Rome + Reformers) | merged directly on GitHub; its own QA+Security review (CYB-101) never completed | **Still waiting, two sweeps running now — needs the owner's go or skip.** (A prior report said this had "resolved off the gate on its own" — that was wrong; `gh run view` confirms `status: waiting` right now.) |
| [37492875454](https://github.com/DevSecObie/cyberjudah-telegram/actions/runs/37492875454) | telegram | `6fc34eae` (#162, one changelog file per PR) | merged directly on GitHub at 16:05 UTC, not by me | Still in `check` as of this sweep; will reach the gate shortly — watch next sweep |

## Not yet ready

| Repo | PR | Title | Why not | Who acts |
|---|---|---|---|---|
| cyberjudah | [#64](https://github.com/DevSecObie/cyberjudah/pull/64) | Apocrypha people: Mattathias's family (1 Maccabees 1-7) | CI green. Fidelity review (CYB-150) still unstarted — **and the Precepts Reviewer seat is now `paused`** (see process notes), so nobody can pick it up until the owner/board un-pauses it. | Owner (un-pause the seat), then Precepts Reviewer |
| cyberjudah | [#68](https://github.com/DevSecObie/cyberjudah/pull/68), [#69](https://github.com/DevSecObie/cyberjudah/pull/69) | Apocrypha people: 2 Maccabees, Judith | Stacked on #64 → #68; held until #64 merges and these retarget to `main` | Precepts Reviewer, after #64 (same pause blocker) |
| cyberjudah | [#40–44](https://github.com/DevSecObie/cyberjudah/pull/40) | Copilot draft class notes | Disposition pending the owner's per-class decisions, [CYB-96](/CYB/issues/CYB-96) | Owner |
| cyberjudah | [#25](https://github.com/DevSecObie/cyberjudah/pull/25), [#10](https://github.com/DevSecObie/cyberjudah/pull/10), [#4](https://github.com/DevSecObie/cyberjudah/pull/4) | Audio alignment draft; dirty `claude/*` branch; Dependabot on `v5` base | Unchanged holds | Owner / original authors |
| telegram | [#139](https://github.com/DevSecObie/cyberjudah-telegram/pull/139) | AI answer block in search | CI now fully green; the author pushed fixes (`f5c62a4`) for all four of the Reviewer's CYB-93 findings (model name, Telegram-launch-data wording, per-IP counter → pseudonymous ID, per-reader quota). **No fresh verdict confirming the fixes yet** — opened [CYB-194](/CYB/issues/CYB-194), left unassigned because the Reviewer seat is `paused`. | Owner (un-pause Reviewer), then Reviewer |
| telegram | [#152](https://github.com/DevSecObie/cyberjudah-telegram/pull/152) | Browser test for #139 | Based on #139's own branch; rides on its disposition | Follows #139 |
| telegram | [#158](https://github.com/DevSecObie/cyberjudah-telegram/pull/158) | Tests for #153: `/api/img/` serves only allowlisted keys | Current with `main`; `browser-tests (chromium)` still pending, nothing failing | Nobody; ready once green |
| telegram | [#155](https://github.com/DevSecObie/cyberjudah-telegram/pull/155) | Pause scripture audio without losing your place | QA and Security review issues both already `done`, clean. The App engineer is actively pushing to this branch (CYB-159, a fresh CI run started mid-sweep) — not touching it. | App engineer finishing up; ready once green |
| telegram | [#163](https://github.com/DevSecObie/cyberjudah-telegram/pull/163) | Keep Bible audio playing across screens | Draft, stacked on #155; QA ([CYB-171](/CYB/issues/CYB-171)) and Security ([CYB-172](/CYB/issues/CYB-172)) review issues exist but are `blocked`/not started | QA / Security reviewers, after #155 (also pause-affected — see below) |
| telegram | [#162](https://github.com/DevSecObie/cyberjudah-telegram/pull/162) | Changelog entries as one file per PR | **Merged** directly on GitHub at 16:05 UTC (not by me) — removed from this list; its deploy is tracked above | — |

## Held (leave unless the owner asks)

content #4, #10, #25

## Process notes (16:40 UTC sweep)

- **Most of the team's agent seats are `paused` or in `error` right now**, confirmed via the company agents list this sweep: Engineer (app and backend), Notes Writer, Claude (CEO), Precepts Reviewer, Reviewer (QA and security), Precepts Writer, Chief of Staff, Image Curator — all `paused`; Codex Engineer and Junior Timeline Researcher B are in `error`. Only Timeline Researcher, Junior Class Archivist, Data Steward, and this seat (Release Manager) are invokable. **This is almost certainly why reviews have been stalling** (CYB-150, CYB-101/CYB-171/CYB-172 all unstarted) — it isn't a queue-prioritization problem, the reviewer seats cannot currently be assigned work at all. My normal escalation path is the Chief of Staff/CEO, who are themselves paused, so I'm surfacing this directly: **the owner needs to un-pause these seats** (or say who should pick up the backlog) before any more content or security review can move. Tried assigning the new #139 re-check (CYB-194) to the Reviewer and got `Cannot assign work to a paused agent`; left it unassigned rather than fail silently.
- No new merges or deploy approvals by me this sweep (list-only, per the authority resolution on CYB-100). Run 37483332759 stays skipped per the owner's answer; run 37489577515 is still on the gate — corrected from an earlier report that wrongly said it had cleared on its own.
- One more PR merged directly on GitHub since the last report: telegram #162 (16:05 UTC, not by me), which queued a new deploy run (37492875454, still in `check`).
- #64's content-fidelity review (CYB-150) is unstarted for the same pause reason above, not a priority/queue issue as previously assumed.
- Opened [CYB-194](/CYB/issues/CYB-194) for a fresh Reviewer verdict on #139's fix commit; left unassigned (Reviewer paused).
