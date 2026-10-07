# Ready to merge — 2026-10-07 08:50 UTC

Supersedes [#88](https://github.com/DevSecObie/cyberjudah/pull/88)'s 09:40 UTC version on this same branch (`ops/releases-2026-10-07`). One change of substance since then: telegram **#169** came off Ready — see "What changed" below. Checks and `mergeable_state` re-verified fresh against GitHub at 08:45–08:50 UTC, not carried forward from the prior version.

## Ready, in order

| # | Repo | PR | Title | Checks | Reviews | Merge order | Deploy approval that follows |
|---|---|---|---|---|---|---|---|
| 1 | cyberjudah | [#80](https://github.com/DevSecObie/cyberjudah/pull/80) | ops: one working tree, several seats (RUNNER.md §7) | `validate` green, `CLEAN` | Reviewer PASS ([CYB-249](/CYB/issues/CYB-249)) | standalone | none (content repo, no gate) |
| 2 | cyberjudah | [#84](https://github.com/DevSecObie/cyberjudah/pull/84) | ops: the research kit's tools belong to the App engineer, its data to the researchers | `validate` green, `CLEAN` | Reviewer PASS ([CYB-267](/CYB/issues/CYB-267)) | standalone | none |
| 3 | cyberjudah | [#94](https://github.com/DevSecObie/cyberjudah/pull/94) | tag-notes: derive tags for new notes only by default | `validate` green, `CLEAN` | Reviewer PASS ([CYB-298](/CYB/issues/CYB-298)) | standalone | none |
| 4 | cyberjudah | [#95](https://github.com/DevSecObie/cyberjudah/pull/95) | fix-names: skip a row with no variants | `validate` green, `CLEAN` | Reviewer PASS ([CYB-299](/CYB/issues/CYB-299)) | standalone | none |
| 5 | cyberjudah | [#88](https://github.com/DevSecObie/cyberjudah/pull/88) | ops: releases 2026-10-07 (this list) | `validate` green, `CLEAN` | this PR is the release list itself | standalone | none |
| 6 | cyberjudah | [#89](https://github.com/DevSecObie/cyberjudah/pull/89) | ops: state 2026-10-07 | `validate` green, `CLEAN` | no Reviewer verdict found in Paperclip search; ops/** is the CEO's/Chief of Staff's own write scope (CYB-293 is the correcting work, not an independent review) | standalone | none |
| 7 | cyberjudah | [#91](https://github.com/DevSecObie/cyberjudah/pull/91) | Notes: To Whom Much Is Given: The Burden and Beauty of Godly Leadership | `validate` green, `CLEAN` | no Reviewer verdict found in Paperclip search (unconfirmed by this agent) | standalone | none |
| 8 | cyberjudah | [#92](https://github.com/DevSecObie/cyberjudah/pull/92) | Notes: The Mind of Mattathias: Let's Search the Scriptures | `validate` green, `CLEAN` | no Reviewer verdict found in Paperclip search (unconfirmed by this agent) | standalone | none |
| 9 | telegram | [#167](https://github.com/DevSecObie/cyberjudah-telegram/pull/167) | People avatar manifest: batch 2 sourcing (20 ids, CYB-209) | all green incl. `stage`, browser-tests ×3, `CLEAN` | Reviewer PASS re-review ([CYB-300](/CYB/issues/CYB-300)), clearing the earlier FAIL ([CYB-250](/CYB/issues/CYB-250)) | must merge before #170 (below) | production deploy (`deploy.yml`) |
| 10 | telegram | [#171](https://github.com/DevSecObie/cyberjudah-telegram/pull/171) | Test for #139: an admin's search answer is not metered against the breaker | all green incl. `stage`, browser-tests ×3, `CLEAN` | Reviewer PASS ([CYB-235](/CYB/issues/CYB-235)) | standalone | production deploy |
| 11 | telegram | [#172](https://github.com/DevSecObie/cyberjudah-telegram/pull/172) | Timeline: Levi and Simeon batch (30 events, 0 drafts, 0 problems) | all green incl. `stage`, browser-tests ×3, `CLEAN` | Reviewer PASS ([CYB-266](/CYB/issues/CYB-266)) | standalone | production deploy |
| 12 | telegram | [#173](https://github.com/DevSecObie/cyberjudah-telegram/pull/173) | Research kit: fix hardcoded and unresolvable paths | all green incl. `stage`, browser-tests ×3, `CLEAN` | QA PASS ([CYB-258](/CYB/issues/CYB-258)), Security PASS ([CYB-259](/CYB/issues/CYB-259)) | standalone | production deploy |
| 13 | telegram | [#174](https://github.com/DevSecObie/cyberjudah-telegram/pull/174) | Research kit: gitignore the pickle search index | all green incl. `stage`, browser-tests ×3, `CLEAN` | QA PASS ([CYB-263](/CYB/issues/CYB-263)), Security PASS ([CYB-264](/CYB/issues/CYB-264)) | standalone | production deploy |
| 14 | telegram | [#170](https://github.com/DevSecObie/cyberjudah-telegram/pull/170) | People avatar manifest: batch 3 sourcing (18 ids, CYB-209) | all green, browser-tests ×3, `CLEAN`, but based on #167's branch, not `main` | Reviewer PASS on content ([CYB-251](/CYB/issues/CYB-251)) | second of the #167/#170 pair; retargets to `main` once #167 merges (CYB-240, CYB-288) | production deploy, after #167's |

No production deploy is currently sitting on the `production` approval gate on either repository (checked `pending_deployments` on recent telegram deploy runs).

## What changed since the 09:40 UTC version

- **#75 (cyberjudah) is off the list — merged.** Confirmed via `gh pr view 75`: `state: MERGED`, `mergedAt: 2026-10-07T07:54:59Z`. Not by this agent.
- **#169 (telegram) comes off Ready.** It was row 8 in the prior version on Reviewer PASS [CYB-234](/CYB/issues/CYB-234). A new commit landed on its branch (head now `2ed7437d4`), and `browser-tests (chromium)` and the required `playwright` check are now **failing** (firefox/webkit, `check`, `codeql`, `dependency-review`, `changelog`, `cms-content` all still green; `mergeable_state: UNSTABLE`). The Chief of Staff flagged this on [CYB-234](/CYB/issues/CYB-234) two minutes before this sweep started (08:28 UTC) and is actively deciding between two readings: it's the same shared chromium flake as [CYB-320](/CYB/issues/CYB-320) ("Chromium e2e red on every main-based branch today"), or it's #169's own regression (its diff touches audio-player media-start handling, so a playwright spec going red on it specifically is a live possibility). Not re-litigating that call here — it is already in progress on CYB-234/CYB-320. #169 stays off Ready until it resolves.
- **#94, #95 added.** Both green, both Reviewer-passed, not on the 09:40 UTC list.

## Not yet ready / stale (merge nothing)

| Repo | PR | Title | Why not | Who acts |
|---|---|---|---|---|
| telegram | [#169](https://github.com/DevSecObie/cyberjudah-telegram/pull/169) | Audio player: clear active after a rejected media start | See "What changed" above — chromium/playwright red on the latest commit, disposition pending | Chief of Staff / Reviewer, [CYB-234](/CYB/issues/CYB-234) |
| telegram | [#175](https://github.com/DevSecObie/cyberjudah-telegram/pull/175), [#176](https://github.com/DevSecObie/cyberjudah-telegram/pull/176), [#177](https://github.com/DevSecObie/cyberjudah-telegram/pull/177), [#178](https://github.com/DevSecObie/cyberjudah-telegram/pull/178), [#179](https://github.com/DevSecObie/cyberjudah-telegram/pull/179) | QA/engineer tests and app changes (CYB-275, #147 PDF lists, Apocrypha CI check, search AI answer, audio settings) | Same `browser-tests (chromium)` + `playwright` failure pattern as #169, consistent with the shared [CYB-320](/CYB/issues/CYB-320) regression. Reviews already PASSed on several (#176 CYB-306, #177 CYB-302, #178 CYB-311, #179 CYB-330/CYB-331) but CI itself is not green. | CEO owns CYB-320; not ready until it resolves |
| telegram | [#180](https://github.com/DevSecObie/cyberjudah-telegram/pull/180) | Drawers: stop a link-starting swipe from native drag | `mergeable_state: UNSTABLE`, browser-tests pending; review in progress ([CYB-333](/CYB/issues/CYB-333)) | Reviewer |
| telegram | [#181](https://github.com/DevSecObie/cyberjudah-telegram/pull/181) | live-smoke.yml: chromium only, 35-minute cap, keep traces on cancel | `mergeable_state: BLOCKED`; had no QA/Security review issue before this sweep — opened [CYB-336](/CYB/issues/CYB-336), assigned to the Reviewer, blocking [CYB-325](/CYB/issues/CYB-325) | Reviewer |
| cyberjudah | [#98](https://github.com/DevSecObie/cyberjudah/pull/98) | Apocrypha people: Tobit batch (27 new, 6 patched) | Reviewer PASS ([CYB-305](/CYB/issues/CYB-305)), but based on `apocrypha/judith` (#101), not `main` — can't land until that chain resolves | Timeline/Apocrypha work, [CYB-304](/CYB/issues/CYB-304) |
| cyberjudah | [#99](https://github.com/DevSecObie/cyberjudah/pull/99) | Notes: The Slave Mentality Yesterday & Today — timestamps | `validate` green, `CLEAN`, but the faithfulness pass is still open ([CYB-317](/CYB/issues/CYB-317)) | Reviewer |
| cyberjudah | [#101](https://github.com/DevSecObie/cyberjudah/pull/101) | Apocrypha people: 2 Maccabees and Judith batches onto main | `mergeable_state: DIRTY`. Verified by a dry merge in a scratch worktree (never pushed): conflicts in `data/people/people.json` — content data, not mine to resolve. Review still open ([CYB-314](/CYB/issues/CYB-314)) too | Author ([CYB-304](/CYB/issues/CYB-304)) |
| cyberjudah | [#96](https://github.com/DevSecObie/cyberjudah/pull/96) | Classes: add Deacon Isaac for TVP5_nyFcHs | `mergeable_state: DIRTY`. Verified by a dry merge in a scratch worktree (never pushed): conflicts in `data/sources/class-teachers.tsv` — the Class Archivist's own data, not mine to resolve. Review open ([CYB-307](/CYB/issues/CYB-307)); also bound up with the teacher-rank question on #87/#90 (CYB-301) | Junior Class Archivist |
| cyberjudah | [#102](https://github.com/DevSecObie/cyberjudah/pull/102) | Engine: scripture-evidence check for People batches (CYB-313) | `validate` green, `CLEAN`, but had no QA/Security review issue before this sweep — opened [CYB-337](/CYB/issues/CYB-337), assigned to the Reviewer, blocking [CYB-313](/CYB/issues/CYB-313) | Reviewer |
| cyberjudah | [#103](https://github.com/DevSecObie/cyberjudah/pull/103) | ops: the CEO's instructions say the pass standing approval is confirmed | `validate` green, `CLEAN`, but its own tracking issue ([CYB-334](/CYB/issues/CYB-334)) is still `in_progress` with the Chief of Staff — not calling this ready while its author is still mid-edit | Chief of Staff |

## Held (record, do not resolve)

| Repo | PR | Title | Why held | Who acts |
|---|---|---|---|---|
| cyberjudah | [#87](https://github.com/DevSecObie/cyberjudah/pull/87) | CMS: Edit note: You Are Hated And In Hell (`teacher: "Deacon Isaac"`) | Conflicting teacher rank with #90 — exactly one of the two may ever merge | Junior Class Archivist ([CYB-287](/CYB/issues/CYB-287), in progress) |
| cyberjudah | [#90](https://github.com/DevSecObie/cyberjudah/pull/90) | CMS: Edit note: You Are Hated And In Hell (`teacher: "Captain Isaac"`) | Conflicting teacher rank with #87 | Junior Class Archivist ([CYB-287](/CYB/issues/CYB-287)) |

## Held (leave unless the owner asks)

| Repo | PR | Title | Why | Who acts |
|---|---|---|---|---|
| cyberjudah | [#41](https://github.com/DevSecObie/cyberjudah/pull/41) | Copilot draft: class note for EBEwdiVcsTg ("Spiritual Uprising") | Draft, `copilot/*` (not the team's) | Notes Writer's review |
| cyberjudah | [#25](https://github.com/DevSecObie/cyberjudah/pull/25) | Continue licensed KJV recording alignment | Draft, held | Owner |
| cyberjudah | [#10](https://github.com/DevSecObie/cyberjudah/pull/10) | notes: attach the recordings of twelve classes that had no video id | `claude/*` branch (not the team's), `DIRTY` | Owner / original author |
| cyberjudah | [#4](https://github.com/DevSecObie/cyberjudah/pull/4) | chore(deps): bump the production-dependencies group (13 updates) | Dependabot, base `v5` (not `main`), held | Owner |

## Process notes (08:50 UTC sweep)

- **Authority, unchanged.** Operating list-only per the owner's direct resolution recorded on the now-closed [CYB-100](/CYB/issues/CYB-100) (2026-10-06 15:25 UTC): `ops/RULES.md` / `ops/STATE.md` / `ops/agents/release-manager/AGENTS.md` govern. This agent never merges a PR or approves a production deploy. [CYB-335](/CYB/issues/CYB-335)'s own description carries the same override language CYB-100 did ("approve and merge what qualifies") — noted, not acted on, for the same reason.
- **No team branch needed `main` merged in this sweep.** Every team branch checked (`app/*`, `eng/*`, `qa/*`, `timeline/*`, `image-curator/*`, `notes/*`, `bot/*`, `ops/*`, `apocrypha/*`, `archive/*`) is `CLEAN` or failing on its own current head, not behind `main` in a way a merge would fix. Deliberately did **not** merge `main` into the green branches (#167/#170/#171/#172/#173/#174 etc.): doing so now would import whatever commit is behind the CYB-320 chromium regression into branches that are currently passing that exact check, which is a regression risk serving no purpose this sweep.
- **Two review issues opened** (both lacked one before this sweep): [CYB-336](/CYB/issues/CYB-336) for telegram #181, [CYB-337](/CYB/issues/CYB-337) for cyberjudah #102. Both assigned to the Reviewer; both parented under this agent's run issue ([CYB-335](/CYB/issues/CYB-335)) rather than under #181's/#102's own tracking issues (CYB-325, CYB-313), because both of those were created by the Reviewer agent itself and Paperclip correctly refused a delegation cycle. Set `blockedByIssueIds` on CYB-325 and CYB-313 to the new review issues instead, so the engineering side still wakes on the verdict.
- **Two dry-run merge checks**, never pushed: #101 (`apocrypha/judith` → `main`) conflicts in `data/people/people.json`; #96 (`archive/class-teachers-tvp5` → `main`) conflicts in `data/sources/class-teachers.tsv`. Both are content data this seat never resolves; left exactly as found.
- **CYB-335's own instruction to report on CYB-100 not followed.** CYB-100 was closed 2026-10-06 ~22:21 UTC by the Chief of Staff after a `spawn E2BIG` crash (112 KB of comments against a 128 KB run-launch limit) with an explicit "do not write to this thread again." This report goes on [CYB-335](/CYB/issues/CYB-335) instead, per that instruction.
