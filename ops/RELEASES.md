# Ready to merge — 2026-10-07 07:00 UTC

Supersedes [#88](https://github.com/DevSecObie/cyberjudah/pull/88) (`ops/releases-2026-10-07`, 03:10 UTC), which listed 9 PRs. This is a fresh read of both repos against GitHub, re-verified with `gh pr view`/`gh pr checks` at ~07:05 UTC against the 06:50 UTC list from the 7 October standup. All 14 are `MERGEABLE` + `CLEAN` with every required check green; `deploy`/`embed`/`refresh-search` reporting "skipping" on a PR is normal (those jobs only run on `main`).

## Ready, in order

| # | Repo | PR | Title | Checks | Reviews | Merge order | Deploy approval that follows |
|---|---|---|---|---|---|---|---|
| 1 | cyberjudah | [#89](https://github.com/DevSecObie/cyberjudah/pull/89) | ops: state 2026-10-07 | `validate` green | no review issue found in Paperclip search; recorded per the 7 October standup's 06:50 UTC verification | standalone | none (content repo, no gate) |
| 2 | cyberjudah | [#88](https://github.com/DevSecObie/cyberjudah/pull/88) | ops: releases 2026-10-07 03:10 UTC | `validate` green | this PR is the prior release list itself | standalone | none |
| 3 | cyberjudah | [#80](https://github.com/DevSecObie/cyberjudah/pull/80) | ops: one working tree, several seats (RUNNER.md §7) | `validate` green | Reviewer PASS ([CYB-249](/CYB/issues/CYB-249)) | standalone | none |
| 4 | cyberjudah | [#84](https://github.com/DevSecObie/cyberjudah/pull/84) | ops: the research kit's tools belong to the App engineer, its data to the researchers | `validate` green | Reviewer PASS, QA+security ([CYB-267](/CYB/issues/CYB-267)) | standalone | none |
| 5 | cyberjudah | [#75](https://github.com/DevSecObie/cyberjudah/pull/75) | People: Horites and Esau's Hittite wives no longer labelled Edom | `validate` green | Reviewer PASS ([CYB-233](/CYB/issues/CYB-233)) | standalone | none |
| 6 | cyberjudah | [#91](https://github.com/DevSecObie/cyberjudah/pull/91) | Notes: To Whom Much Is Given: The Burden and Beauty of Godly Leadership | `validate` green | no review issue found in Paperclip search; recorded per the 7 October standup's 06:50 UTC verification | standalone | none |
| 7 | cyberjudah | [#92](https://github.com/DevSecObie/cyberjudah/pull/92) | Notes: The Mind of Mattathias: Let's Search the Scriptures | `validate` green | no review issue found in Paperclip search; recorded per the 7 October standup's 06:50 UTC verification | standalone | none |
| 8 | telegram | [#169](https://github.com/DevSecObie/cyberjudah-telegram/pull/169) | Audio player: clear active after a rejected media start | all green | Reviewer PASS ([CYB-234](/CYB/issues/CYB-234)) | standalone | production deploy (`deploy.yml`) |
| 9 | telegram | [#171](https://github.com/DevSecObie/cyberjudah-telegram/pull/171) | Test for #139: an admin's search answer is not metered against the breaker | all green incl. `stage` | Reviewer PASS ([CYB-235](/CYB/issues/CYB-235)) | standalone | production deploy |
| 10 | telegram | [#173](https://github.com/DevSecObie/cyberjudah-telegram/pull/173) | Research kit: fix hardcoded and unresolvable paths in checkbatch.mjs, tmerge.py, tsearch.py | all green incl. `stage` | QA PASS ([CYB-258](/CYB/issues/CYB-258)), Security PASS ([CYB-259](/CYB/issues/CYB-259)) | standalone | production deploy |
| 11 | telegram | [#174](https://github.com/DevSecObie/cyberjudah-telegram/pull/174) | Research kit: gitignore the pickle search index | all green incl. `stage` | QA PASS ([CYB-263](/CYB/issues/CYB-263)), Security PASS ([CYB-264](/CYB/issues/CYB-264)) | standalone | production deploy |
| 12 | telegram | [#172](https://github.com/DevSecObie/cyberjudah-telegram/pull/172) | Timeline: Levi and Simeon batch (30 events, 0 drafts, 0 problems) | all green incl. `stage` | Reviewer PASS ([CYB-266](/CYB/issues/CYB-266)) | standalone | production deploy |
| 13 | telegram | [#167](https://github.com/DevSecObie/cyberjudah-telegram/pull/167) | People avatar manifest: batch 2 sourcing (20 ids, CYB-209) | all green incl. `stage` | Reviewer PASS ([CYB-250](/CYB/issues/CYB-250)) | base of #170 (next row) — merge this one first | production deploy |
| 14 | telegram | [#170](https://github.com/DevSecObie/cyberjudah-telegram/pull/170) | People avatar manifest: batch 3 sourcing (18 ids, CYB-209) | all green incl. `stage` | Reviewer PASS ([CYB-251](/CYB/issues/CYB-251)) | **stacked on #167** — base is `image-curator/people-manifest-batch-2` (#167's branch), not `main`. GitHub retargets #170's base to `main` automatically once #167 merges; checks must be re-read on that version before this row is actually ready to merge. The Image Curator owes the un-stacking fix separately ([CYB-240](/CYB/issues/CYB-240), blocked; a parallel run is on it as [CYB-288](/CYB/issues/CYB-288)) — do not rewrite #170's branch. | production deploy |

No production deploy is currently sitting on the `production` approval gate on either repository. If the owner merges rows 8–14, seven deploys to `main` will each queue `deploy.yml`'s `production` approval in turn.

## Held (record, do not resolve)

| Repo | PR | Title | Why held | Who acts |
|---|---|---|---|---|
| cyberjudah | [#87](https://github.com/DevSecObie/cyberjudah/pull/87) | CMS: Edit note: You Are Hated And In Hell (`teacher: "Deacon Isaac"`) | Held: conflicting teacher rank, one of two. #87 and #90 edit the same line of `blog/2026/2026-10-03-2026-10-03-you-are-hated-and-in-hell.md` — #87 sets Deacon, #90 sets Captain. Exactly one may ever merge. | Junior Class Archivist is settling the rank ([CYB-287](/CYB/issues/CYB-287), in progress) |
| cyberjudah | [#90](https://github.com/DevSecObie/cyberjudah/pull/90) | CMS: Edit note: You Are Hated And In Hell (`teacher: "Captain Isaac"`) | Held: conflicting teacher rank, one of two (see #87) | Junior Class Archivist ([CYB-287](/CYB/issues/CYB-287)) |

## Not yet ready / stale (merge nothing)

| Repo | PR | Title | Why not | Who acts |
|---|---|---|---|---|
| cyberjudah | [#41](https://github.com/DevSecObie/cyberjudah/pull/41) | Copilot draft: class note for EBEwdiVcsTg ("Spiritual Uprising") | Draft, no checks have ever reported, `copilot/*` (not the team's) | Notes Writer's review |
| cyberjudah | [#25](https://github.com/DevSecObie/cyberjudah/pull/25) | Continue licensed KJV recording alignment | Draft, held | Owner |
| cyberjudah | [#10](https://github.com/DevSecObie/cyberjudah/pull/10) | notes: attach the recordings of twelve classes that had no video id | `claude/*` branch (not the team's), `mergeable_state: dirty`/`CONFLICTING`, 10.7 days old | Owner / original author |
| cyberjudah | [#4](https://github.com/DevSecObie/cyberjudah/pull/4) | chore(deps): bump the production-dependencies group (13 updates) | Dependabot, base `v5` (not `main`), 54 days old; held | Owner |

## Held (leave unless the owner asks)

cyberjudah #4, #10, #25, #87, #90

## Process notes (07:00 UTC sweep)

- **Source of this list.** Courier task [CYB-284](/CYB/issues/CYB-284) from the 7 October standup supplied the verified 14-PR order and the two holds; this sweep re-checked `mergeable`/`mergeStateStatus` and `gh pr checks` for all 14 plus the holds and the four stale PRs against live GitHub before recording them — none had gone red or changed mergeable state.
- **Reviews not found for #89, #91, #92.** A Paperclip issue search (`q=89`, `q=91`, `q=92`, and title-based queries) found no completed QA/Security/Reviewer verdict issue for these three. They are recorded as ready on the courier's explicit 06:50 UTC verification, not on a confirmed review issue — the owner should treat the Reviews column for these three as unconfirmed by this agent.
- **Same branch, not a new PR.** Per the one-open-PR-per-agent-per-repo-area rule (6 October standup), this update was pushed to the existing `ops/releases-2026-10-07` branch (PR #88, still open) rather than opening `ops/releases-2026-10-07b`.
- **GitHub identity:** resolved normally this run under this issue's main-account identity context (`gh api user` → `DevSecObie`), confirming the courier's note that CYB-284 (unlike the six parked second-account issues it names) is not affected by the identity-broker gap.
