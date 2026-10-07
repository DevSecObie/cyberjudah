# Ready to merge — 2026-10-07 03:10 UTC

Supersedes [#83](https://github.com/DevSecObie/cyberjudah/pull/83) (`ops/releases-2026-10-06`), which listed three PRs that had already merged by the time it was written (telegram #146, #147, #139) and a deploy run that had already completed. This is a fresh read of both repos against GitHub at 2026-10-07 ~03:00 UTC.

## Ready, in order

| # | Repo | PR | Title | Checks | Reviews | Merge order | Deploy approval that follows |
|---|---|---|---|---|---|---|---|
| 1 | cyberjudah | [#75](https://github.com/DevSecObie/cyberjudah/pull/75) | People: Horites and Esau's Hittite wives no longer labelled Edom | `validate` green | Reviewer PASS ([CYB-233](/CYB/issues/CYB-233)) | standalone | none (content repo, no gate) |
| 2 | cyberjudah | [#80](https://github.com/DevSecObie/cyberjudah/pull/80) | ops: one working tree, several seats (RUNNER.md §7) | `validate` green | Reviewer PASS ([CYB-249](/CYB/issues/CYB-249)) | standalone | none |
| 3 | cyberjudah | [#84](https://github.com/DevSecObie/cyberjudah/pull/84) | ops: the research kit's tools belong to the App engineer, its data to the researchers | `validate` green | Reviewer PASS, QA+security ([CYB-267](/CYB/issues/CYB-267)) | standalone | none |
| 4 | telegram | [#167](https://github.com/DevSecObie/cyberjudah-telegram/pull/167) | People avatar manifest: batch 2 sourcing (20 ids, CYB-209) | all green incl. `stage` | Reviewer PASS ([CYB-250](/CYB/issues/CYB-250)) | base of #170 (held below) — merge this first | production deploy (`deploy.yml`) |
| 5 | telegram | [#169](https://github.com/DevSecObie/cyberjudah-telegram/pull/169) | Audio player: clear active after a rejected media start | all green incl. `stage` | Reviewer PASS ([CYB-234](/CYB/issues/CYB-234)) | standalone | production deploy |
| 6 | telegram | [#171](https://github.com/DevSecObie/cyberjudah-telegram/pull/171) | Test for #139: an admin's search answer is not metered against the breaker | all green incl. `stage` | Reviewer PASS ([CYB-235](/CYB/issues/CYB-235)) | standalone | production deploy |
| 7 | telegram | [#172](https://github.com/DevSecObie/cyberjudah-telegram/pull/172) | Timeline: Levi and Simeon batch (30 events, 0 drafts, 0 problems) | all green incl. `stage` | Reviewer PASS ([CYB-266](/CYB/issues/CYB-266)) | standalone | production deploy |
| 8 | telegram | [#173](https://github.com/DevSecObie/cyberjudah-telegram/pull/173) | Research kit: fix hardcoded and unresolvable paths in checkbatch.mjs, tmerge.py, tsearch.py | all green incl. `stage` | QA PASS ([CYB-258](/CYB/issues/CYB-258)), Security PASS ([CYB-259](/CYB/issues/CYB-259)) | standalone | production deploy |
| 9 | telegram | [#174](https://github.com/DevSecObie/cyberjudah-telegram/pull/174) | Research kit: gitignore the pickle search index | all green incl. `stage` | QA PASS ([CYB-263](/CYB/issues/CYB-263)), Security PASS ([CYB-264](/CYB/issues/CYB-264)) | standalone | production deploy |

No production deploy is currently sitting on the `production` approval gate on either repository (checked `pending_deployments` on the last five `deploy.yml` runs — all empty). If the owner merges rows 4–9, nine deploys to `main` will each queue `deploy.yml`'s `production` approval in turn.

## Not yet ready

| Repo | PR | Title | Why not | Who acts |
|---|---|---|---|---|
| telegram | [#170](https://github.com/DevSecObie/cyberjudah-telegram/pull/170) | People avatar manifest: batch 3 sourcing (18 ids, CYB-209) | All checks green, but still based on `image-curator/people-manifest-batch-2` (#167's branch), not `main` — the owner's no-stacked-PRs rule (CYB-157). Un-stack tracked on [CYB-240](/CYB/issues/CYB-240), blocked, assigned to the Image Curator. Retargets to `main` once #167 merges. | Image Curator retargets after #167 merges |
| cyberjudah | [#41](https://github.com/DevSecObie/cyberjudah/pull/41) | Copilot draft: class note for EBEwdiVcsTg ("Spiritual Uprising") | Draft, `copilot/*` (not the team's); disposition pending the owner's per-class decision on [CYB-96](/CYB/issues/CYB-96) | Owner |
| cyberjudah | [#25](https://github.com/DevSecObie/cyberjudah/pull/25) | Continue licensed KJV recording alignment | Draft, held per `ops/STATE.md` §3 | Owner |
| cyberjudah | [#10](https://github.com/DevSecObie/cyberjudah/pull/10) | notes: attach the recordings of twelve classes that had no video id | `claude/*` branch (not the team's), `mergeable_state: dirty`/conflicting | Owner / original author |
| cyberjudah | [#4](https://github.com/DevSecObie/cyberjudah/pull/4) | chore(deps): bump the production-dependencies group (13 updates) | Dependabot, base `v5` (not `main`); held | Owner |

## Held (leave unless the owner asks)

cyberjudah #4, #10, #25

## Process notes (03:10 UTC sweep)

- **Authority, unchanged.** Operating list-only under the authority resolution the owner gave directly on the old standing-job thread ([CYB-100](/CYB/issues/CYB-100), now closed — its override paragraph does not govern; `ops/RULES.md`/`ops/STATE.md`/`ops/agents/release-manager/AGENTS.md` do). I never merge a PR or approve a production deploy myself. Standing-job continuity moved to [CYB-265](/CYB/issues/CYB-265) after CYB-100 grew too large to launch the seat (`spawn E2BIG`, 112 KB of comment body against a 128 KB environment limit) — this sweep's report is posted there and on this sweep's own issue, [CYB-276](/CYB/issues/CYB-276), not on CYB-100.
- **Merged since the last list (#83, 21:10 UTC 2026-10-06), not by me** — shared `DevSecObie` GitHub login, so no actor attribution: cyberjudah #74, #81, #82, #85, #86 (class notes); telegram #146 (react-router 8, 17:52 UTC), #147 (marked 18, 18:14 UTC), #139 (AI answer in search, 18:38 UTC), #148, #149, #150, #151, #153, #156, #160, #161, #162, #163, #166, #168. No production deploy is currently pending approval.
- **GitHub identity:** working normally this run (every `gh` read and the branch push below succeeded). The intermittent "no managed GitHub identity" failures on timer/routine-started runs, tracked on [CYB-210](/CYB/issues/CYB-210) → [CYB-237](/CYB/issues/CYB-237) (`in_review`), did not reproduce this run.
- **CYB-265 item 1** (amend the release list) is completed by this PR instead of a further amendment to #83, since a new UTC day opened since CYB-265 was written and `ops/RELEASES.md`'s own convention is one dated branch a day. Items 2 and 3 on CYB-265 (the five review pairs, closing the duplicate CYB-215) were already completed in an earlier run.
