# Ready to merge — 2026-10-06 16:00 UTC

## Ready, in order

| # | Repo | PR | Title | Checks | Reviews | Merge order | Deploy approval that follows |
|---|---|---|---|---|---|---|---|
| 1 | cyberjudah | [#70](https://github.com/DevSecObie/cyberjudah/pull/70) | Class note: The Slave Mentality Yesterday & Today | CI green (`validate`) | Notes need no further review; checks pass | standalone | none (content repo, no gate) |
| 2 | cyberjudah | [#57](https://github.com/DevSecObie/cyberjudah/pull/57) | Precept pass: You Are Hated And In Hell | CI green | Precepts Reviewer: faithful, 0 problems | standalone | none — standing approval for precept-pass merges (`ops/STATE.md` §1) still unconfirmed, so this is the owner's own merge |
| 3 | cyberjudah | [#59](https://github.com/DevSecObie/cyberjudah/pull/59) | Precept pass: The Slave Mentality Yesterday & Today | CI green | Precepts Reviewer: faithful, 0 problems (fix applied, re-reviewed) | standalone | same note as #57 |
| 4 | cyberjudah | [#63](https://github.com/DevSecObie/cyberjudah/pull/63) | Precept pass: Blood Toucheth Blood | CI green | Precepts Reviewer: faithful, 0 problems (round 2) | standalone | same note as #57 |
| 5 | cyberjudah | [#66](https://github.com/DevSecObie/cyberjudah/pull/66) | Check two-way family links on every Apocrypha person batch (touches `.github/workflows/**`) | CI green | Security/QA re-check (CYB-154) confirmed: 0 problems, one non-blocking nit | standalone | security-sensitive (workflow-adjacent); owner's call |
| 6 | telegram | [#146](https://github.com/DevSecObie/cyberjudah-telegram/pull/146) | Deps (production): react-router 7→8 | all green | n/a (dependency bump) | standalone | production deploy — **major-upgrade go-ahead needed from the owner first** |
| 7 | telegram | [#147](https://github.com/DevSecObie/cyberjudah-telegram/pull/147) | Deps (production): marked 16→18 | all green | n/a (dependency bump) | standalone | production deploy — **major-upgrade go-ahead needed; renders transcript text** |

## For the owner right now — two production deploys sitting on the gate

| Run | Repo | Commit | What | Status |
|---|---|---|---|---|
| [37483332759](https://github.com/DevSecObie/cyberjudah-telegram/actions/runs/37483332759) | telegram | `e5566b2` (#153, R2 image route) | security+QA reviewed clean before merge | Owner already answered **skip** on this one via the issue-thread confirmation — left unapproved, no further action |
| [37489577515](https://github.com/DevSecObie/cyberjudah-telegram/actions/runs/37489577515) | telegram | `514eb53` (#150, Timeline portraits: Rome + Reformers) | merged directly on GitHub; its own QA+Security review (CYB-101) never completed (see below) | **New — needs the owner's go or skip** |

## Not yet ready

| Repo | PR | Title | Why not | Who acts |
|---|---|---|---|---|
| cyberjudah | [#64](https://github.com/DevSecObie/cyberjudah/pull/64) | Apocrypha people: Mattathias's family (1 Maccabees 1-7) | CI green. Fidelity review (CYB-150) now routed to the Precepts Reviewer (todo/high, per the Chief of Staff's 2026-10-06 standup) but not yet started. | Precepts Reviewer |
| cyberjudah | [#68](https://github.com/DevSecObie/cyberjudah/pull/68), [#69](https://github.com/DevSecObie/cyberjudah/pull/69) | Apocrypha people: 2 Maccabees, Judith | Stacked on #64 → #68. Deliberately held with no review issue yet per the standup's "no stacked-PR review" rule; reviews open once #64 merges and these retarget to `main`. | Chief of Staff / Precepts Reviewer, after #64 |
| cyberjudah | [#40–44](https://github.com/DevSecObie/cyberjudah/pull/40) | Copilot draft class notes | Disposition pending the owner's per-class decisions, [CYB-96](/CYB/issues/CYB-96) | Owner |
| cyberjudah | [#25](https://github.com/DevSecObie/cyberjudah/pull/25), [#10](https://github.com/DevSecObie/cyberjudah/pull/10), [#4](https://github.com/DevSecObie/cyberjudah/pull/4) | Audio alignment draft; dirty `claude/*` branch; Dependabot on `v5` base | Unchanged holds — draft, conflicting, or not in today's priority list | Owner / original authors |
| telegram | [#139](https://github.com/DevSecObie/cyberjudah-telegram/pull/139) | AI answer block in search | CI green, but Reviewer verdict (CYB-93) unchanged: fail on PR-body wording (rule 12), a privacy-doc gap on the new per-IP counter, and a quota-math question. Owner's `ceejay/*` branch. | Owner |
| telegram | [#152](https://github.com/DevSecObie/cyberjudah-telegram/pull/152) | Browser test for #139 | Based on #139's own branch; rides on its disposition | Follows #139 |
| telegram | [#158](https://github.com/DevSecObie/cyberjudah-telegram/pull/158) | Tests for #153: `/api/img/` serves only allowlisted keys | Brought current with `main` this sweep (clean merge, no conflict); checks re-running on the new head | Nobody; ready once green |
| telegram | [#155](https://github.com/DevSecObie/cyberjudah-telegram/pull/155) | Pause scripture audio without losing your place | Behind `main`; the App engineer is actively mid-task on exactly this "merge main in" step — not touched, to avoid racing | App engineer (in progress) |
| telegram | [#163](https://github.com/DevSecObie/cyberjudah-telegram/pull/163) | Keep Bible audio playing across screens | Draft, stacked on #155; QA and Security review issues exist but are blocked/not started | QA / Security reviewers, after #155 |
| telegram | [#162](https://github.com/DevSecObie/cyberjudah-telegram/pull/162) | Changelog entries as one file per PR | Owner's `claude/*` session branch; checks still running (`stage`, one browser-tests job pending) | Owner's session |

## Held (leave unless the owner asks)

content #4, #10, #25

## Process notes

- A lot of movement happens directly on GitHub between sweeps (shared `DevSecObie` login for every seat, so the actor field can't distinguish who merged). Since the last report: cyberjudah #47, #54, #71 and telegram #148, #149, #150, #151, #153, #156, #160, #161, #164 are now merged; #157 and #142 closed as superseded. None of this was me — I am operating list-only per the authority resolution on CYB-100 (owner chose "canonical" rules: I never merge or approve a deploy myself).
- **#150 and #156 both merged with their QA/Security reviews unresolved** (CYB-101 never started; CYB-137 was a fail verdict). Flagging for visibility only — already live, not reversible from this seat.
- Found the CEO seat reported in `error` ("Process adapter missing command") in a comment thread today; this may be why some escalations (e.g. CYB-149, still `blocked` despite #150 already merging) aren't moving. Worth the owner's attention if escalations keep stalling.
- Cleaned up a dangling local merge conflict left in the shared `cyberjudah-telegram` workspace checkout (a stray, unpushed local branch with an unresolved conflict in `app/scripts/timeline-portraits.json` from an earlier sweep's aborted attempt on #150 — #150 merged through another path since, so the local state was stale). Aborted it; no push involved, nothing lost.
