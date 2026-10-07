# Ready to merge — 2026-10-07 07:15 UTC

Supersedes [#88](https://github.com/DevSecObie/cyberjudah/pull/88) (`ops/releases-2026-10-07`, 03:10 UTC), which listed 9 PRs. This is a fresh read of both repos against GitHub, re-verified with `gh pr view`/`gh pr checks` at ~07:05 UTC against the 06:50 UTC list from the 7 October standup, then corrected at 07:15 UTC on [CYB-255](/CYB/issues/CYB-255): rows 13–14 (telegram #167/#170) are moved out of Ready — see the note under "Not yet ready" below. The other 12 are `MERGEABLE` + `CLEAN` with every required check green; `deploy`/`embed`/`refresh-search` reporting "skipping" on a PR is normal (those jobs only run on `main`).

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

No production deploy is currently sitting on the `production` approval gate on either repository. If the owner merges rows 8–12, five deploys to `main` will each queue `deploy.yml`'s `production` approval in turn.

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
| telegram | [#167](https://github.com/DevSecObie/cyberjudah-telegram/pull/167) | People avatar manifest: batch 2 sourcing (20 ids, CYB-209) | Base is `main`, `MERGEABLE`/`CLEAN`, all checks green on head `1ffb324`. But [CYB-250](/CYB/issues/CYB-250)'s verdict on the prior head (`3612d40c`) was **FAIL** (14 archival `author` fields overwritten with `***REDACTED***`); the fix landed as [CYB-253](/CYB/issues/CYB-253) (head `1ffb324`), but CYB-250's own text says not to list #167 until that head is re-reviewed, and no re-review verdict has been posted. Release Manager independently confirmed via raw `git diff origin/main 1ffb324 -- app/public/people/manifest.json` that the diff is 182 insertions/1 deletion (the one deletion is the old `_readme` string, replaced), zero `REDACTED` occurrences — but this is supporting evidence, not a verdict. Re-review requested: [CYB-300](/CYB/issues/CYB-300). | Reviewer (QA and security), on [CYB-300](/CYB/issues/CYB-300) |
| telegram | [#170](https://github.com/DevSecObie/cyberjudah-telegram/pull/170) | People avatar manifest: batch 3 sourcing (18 ids, CYB-209) | Retargeted to `main` directly ([CYB-288](/CYB/issues/CYB-288), base-pointer change, no rebase, `MERGEABLE`/`CLEAN`), head `c9993fe` carries the CYB-253 fix, all checks green. Content review already PASSed ([CYB-251](/CYB/issues/CYB-251)). Still not ready: (1) its current head's diff against `main` is additive but still bundles #167's 20 entries (since #167 hasn't merged yet) — #167 must merge first; (2) #167 itself is pending re-review (see above). List this row once #167 clears CYB-300 and merges, and #170's diff against the then-current `main` is re-confirmed as additive-only. | Follows #167; Release Manager re-checks after #167 merges |

## Held (leave unless the owner asks)

cyberjudah #4, #10, #25, #87, #90

## Process notes (07:15 UTC correction)

- **Source of this list.** Courier task [CYB-284](/CYB/issues/CYB-284) from the 7 October standup supplied the verified PR order and the two holds; the 07:00 UTC sweep re-checked `mergeable`/`mergeStateStatus` and `gh pr checks` against live GitHub before recording them.
- **Rows 13–14 corrected this pass ([CYB-255](/CYB/issues/CYB-255)).** The 07:00 UTC version listed telegram #167 as "Reviewer PASS (CYB-250)" — that is wrong: CYB-250's actual verdict on #167 was **FAIL**, with an explicit instruction not to list #167 or the stacked #170 until the fix is re-reviewed. The fix ([CYB-253](/CYB/issues/CYB-253)) and the un-stacking retarget ([CYB-240](/CYB/issues/CYB-240)/[CYB-288](/CYB/issues/CYB-288)) both landed on 2026-10-06, but no re-review of #167's new head has been posted. Moved both PRs to "Not yet ready" and opened [CYB-300](/CYB/issues/CYB-300) for the Reviewer to re-check #167's fixed head; CYB-255 is blocked on it and will resume when it closes.
- **Reviews not found for #89, #91, #92.** A Paperclip issue search (`q=89`, `q=91`, `q=92`, and title-based queries) found no completed QA/Security/Reviewer verdict issue for these three. They are recorded as ready on the courier's explicit 06:50 UTC verification, not on a confirmed review issue — the owner should treat the Reviews column for these three as unconfirmed by this agent.
- **Same branch, not a new PR.** Per the one-open-PR-per-agent-per-repo-area rule (6 October standup), this update was pushed to the existing `ops/releases-2026-10-07` branch (PR #88, still open) rather than opening a new one.
- **GitHub identity:** resolved normally this run under this issue's main-account identity context (`gh api user` → `DevSecObie`).
