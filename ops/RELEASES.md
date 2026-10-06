# Ready to merge — 2026-10-06 15:40 UTC

## Ready, in order

| # | Repo | PR | Title | Checks | Reviews | Merge order | Deploy approval that follows |
|---|---|---|---|---|---|---|---|
| 1 | cyberjudah | [#70](https://github.com/DevSecObie/cyberjudah/pull/70) | Class note: The Slave Mentality Yesterday & Today | CI green (`validate`) | Notes need no further review; checks pass | standalone | none (content repo, no gate) |
| 2 | cyberjudah | [#57](https://github.com/DevSecObie/cyberjudah/pull/57) | Precept pass: You Are Hated And In Hell | CI green | Precepts Reviewer: faithful, 0 problems | standalone | none — but the owner's own merge, since the standing approval for precept-pass merges (`ops/STATE.md` §1) is still unconfirmed |
| 3 | cyberjudah | [#59](https://github.com/DevSecObie/cyberjudah/pull/59) | Precept pass: The Slave Mentality Yesterday & Today | CI green | Precepts Reviewer: faithful, 0 problems (fix applied, re-reviewed) | standalone | same note as #57 |
| 4 | cyberjudah | [#63](https://github.com/DevSecObie/cyberjudah/pull/63) | Precept pass: Blood Toucheth Blood | CI green | Precepts Reviewer: faithful, 0 problems (round 2) | standalone | same note as #57 |
| 5 | cyberjudah | [#66](https://github.com/DevSecObie/cyberjudah/pull/66) | Check two-way family links on every Apocrypha person batch (touches `.github/workflows/**`) | CI green | Security/QA re-check (CYB-154) confirmed all 3 fixes | standalone | security-sensitive (workflow-adjacent); owner's call |
| 6 | telegram | [#146](https://github.com/DevSecObie/cyberjudah-telegram/pull/146) | Deps (production): react-router 7→8 | all green | n/a (dependency bump) | standalone | production deploy — **major-upgrade go-ahead needed from the owner first** |
| 7 | telegram | [#147](https://github.com/DevSecObie/cyberjudah-telegram/pull/147) | Deps (production): marked 16→18 | all green | n/a (dependency bump) | standalone | production deploy — **major-upgrade go-ahead needed; renders transcript text** |

## Not yet ready

| Repo | PR | Title | Why not | Who acts |
|---|---|---|---|---|
| telegram | [#150](https://github.com/DevSecObie/cyberjudah-telegram/pull/150) | Timeline portraits: 11 public-domain sources (Rome, the Reformers) | Brought current with `main` last sweep, checks still finishing (browser tests). Its QA+Security review, [CYB-101](/CYB/issues/CYB-101), has sat `backlog`/unstarted since ~2026-10-05 22:15 UTC — now 17+ hours, escalated twice already ([CYB-149](/CYB/issues/CYB-149)). | Reviewer to pick up CYB-101; CEO to prioritize the queue. |
| telegram | [#158](https://github.com/DevSecObie/cyberjudah-telegram/pull/158) | Tests for #153: the `/api/img/` route serves only allowlisted keys | Checks still finishing (browser tests). Test-only file, no product code — same pattern as #149, no dedicated review needed once green. | Nobody; will be ready on green. |
| telegram | [#155](https://github.com/DevSecObie/cyberjudah-telegram/pull/155) | Pause scripture audio without losing your place or settings | Checks still finishing; the App engineer is actively finishing the work itself (CYB-159, in_progress). No review opened yet since it's not done. | App engineer. |
| telegram | [#162](https://github.com/DevSecObie/cyberjudah-telegram/pull/162) | Changelog entries as one file per pull request | Owner's own `claude/*` session branch, not the team's — not pushed to. Checks still finishing. | Owner's session. |
| telegram | [#163](https://github.com/DevSecObie/cyberjudah-telegram/pull/163) | Keep Bible audio playing across screens and chapters | Draft, stacked on #155. | App engineer. |
| telegram | [#152](https://github.com/DevSecObie/cyberjudah-telegram/pull/152) | Browser test for the AI answer block in search | CI green; based on `ceejay/search-ai-answer` (#139's own branch), not `main`. | Rides on #139's disposition. |
| telegram | [#139](https://github.com/DevSecObie/cyberjudah-telegram/pull/139) | AI answer block in search | CI now fully green, but the Reviewer verdict (CYB-93) is unchanged: fail on wording ("no sign-in required" is false), an undocumented per-IP raw-IP counter in `docs/PRIVACY.md`, and a per-IP quota that can exceed the daily free-model breaker alone. Pass on code safety. Owner's `ceejay/*` branch, `BEHIND main`. | Owner or CEO fixes the wording/privacy/quota points, then merges `main` in. |
| cyberjudah | [#64](https://github.com/DevSecObie/cyberjudah/pull/64), [#68](https://github.com/DevSecObie/cyberjudah/pull/68), [#69](https://github.com/DevSecObie/cyberjudah/pull/69) | Apocrypha people: 1 Maccabees → 2 Maccabees → Judith (stacked) | CI green on all three. Content-fidelity review [CYB-150](/CYB/issues/CYB-150) (for #64) has sat unassigned/unstarted since it was opened; #68/#69 have no fidelity review opened yet; escalated as [CYB-155](/CYB/issues/CYB-155). No seat on the chart owns Apocrypha people-record fidelity. | CEO to route a reviewer. |
| cyberjudah | [#40](https://github.com/DevSecObie/cyberjudah/pull/40)–[#44](https://github.com/DevSecObie/cyberjudah/pull/44) | Copilot's draft class notes | Awaiting the owner's per-class decisions (CYB-96). | Owner. |

## Held (leave unless the owner asks)

cyberjudah-telegram #4 (TypeScript major bump, `v5` base); cyberjudah #10 (`claude/*`, dirty/conflicting), #25 (audio draft)

## Merged since the last report (2026-10-06 02:35 UTC → now, for the record)

cyberjudah #47, #54; cyberjudah-telegram #148, #149, #151, #153, #156, #160, #161. #157 (and earlier #142) closed as superseded. All recorded with GitHub's shared `DevSecObie` identity as merger — this team shares that login with the owner, so the merge actor field doesn't distinguish who actually clicked merge.

Note: #156 (Donations API) merged despite the Reviewer's fail verdict on [CYB-137](/CYB/issues/CYB-137) (one privacy-coverage gap, CYB-82); #153 merged after its security review ([CYB-128](/CYB/issues/CYB-128)) passed clean. Flagging #156 for visibility only — it's merged and not reversible from this seat.

## Production deploys

**One deploy is currently sitting on the `production` approval gate, unapproved:** cyberjudah-telegram run [37483332759](https://github.com/DevSecObie/cyberjudah-telegram/actions/runs/37483332759), on `main` at `e5566b2` (the merge commit of #153, R2 image route), waiting since 2026-10-06 14:57 UTC. CI is green and the security review (CYB-128) passed clean before #153 merged. **Not approved by this seat** — per the authority resolution recorded on [CYB-100](/CYB/issues/CYB-100) at 15:25 UTC (owner chose "canonical": `ops/RULES.md`/`ops/STATE.md` govern, every production deploy needs the owner's explicit go-ahead in the current conversation; the earlier blanket "permission to approve deployments" comment does not stand as ongoing authority). **Needs the owner's word to approve or skip.**

The two major-upgrade PRs (#146, #147) are fully green now but still wait on the owner's explicit case-by-case word before merging, per the standing job's safeguard.
