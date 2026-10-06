# Ready to merge — 2026-10-06 21:10 UTC

## Ready, in order

| # | Repo | PR | Title | Checks | Reviews | Merge order | Deploy approval that follows |
|---|---|---|---|---|---|---|---|
| 1 | cyberjudah | [#74](https://github.com/DevSecObie/cyberjudah/pull/74) | Class note: You Are Hated And In Hell | CI green (`validate`); `check.py` 130 verses, 0 mismatches; `notes:lint` 0 errors | Notes need no further review; checks pass. A content-accuracy check ([CYB-231](/CYB/issues/CYB-231), teacher attribution) is open and unactioned — doesn't block, worth the owner's look | standalone, one file | none (content repo, no gate) |
| 2 | cyberjudah | [#81](https://github.com/DevSecObie/cyberjudah/pull/81) | Class note: The Gospel Is Black Liberation | CI green (`validate`); `check.py` 183 verses, 0 mismatches; `notes:lint` 0 errors; `npm run check` 0 broken | Notes need no further review; checks pass. Author flags the note at 9,852 words, over the 3,000–8,000 reference range in `scripts/notes/README.md` (under the 10,000 that sends a note back); will trim on request | standalone, one file | none (content repo, no gate) |
| 3 | cyberjudah | [#82](https://github.com/DevSecObie/cyberjudah/pull/82) | Class note: The Beauty in Civility the Cost of Immorality | CI green (`validate`); `check.py` 51 verses, 0 mismatches; `notes:lint` 0 errors (1 warning: teacher never named in the class, left blank rather than guessed); `npm run check` 0 broken | Notes need no further review; checks pass | standalone, one file | none (content repo, no gate) |
| 4 | telegram | [#146](https://github.com/DevSecObie/cyberjudah-telegram/pull/146) | Deps (production): react-router 7→8 | **all green on current head, including `stage`** — still **behind `main`** (9 commits) | n/a (dependency bump) | standalone | production deploy — **major-upgrade go-ahead needed from the owner first**; `ceejay/*` branch, not mine to merge main into without the CEO's note |
| 5 | telegram | [#147](https://github.com/DevSecObie/cyberjudah-telegram/pull/147) | Deps (production): marked 16→18 | **all green on current head, including `stage`** — still **behind `main`** (9 commits) | n/a (dependency bump) | standalone | production deploy — **major-upgrade go-ahead needed; renders transcript text**; same branch-ownership note as #146 |
| 6 | telegram | [#139](https://github.com/DevSecObie/cyberjudah-telegram/pull/139) | AI answer block in search | **all green**, still behind `main` (7 commits) | fixes for CYB-93 pushed; re-check [CYB-194](/CYB/issues/CYB-194) open, unassigned (Reviewer paused) | standalone, [#152](https://github.com/DevSecObie/cyberjudah-telegram/pull/152) rides on it | owner's call once re-reviewed |

Rows 4–6 (telegram) are carried over unchanged from the 17:00 UTC sweep; this run was scoped to [CYB-254](/CYB/issues/CYB-254) (the three cyberjudah class-note PRs) and did not re-check telegram.

## For the owner right now — production deploy on the gate

| Run | Repo | Commit | What | Status |
|---|---|---|---|---|
| [37483332759](https://github.com/DevSecObie/cyberjudah-telegram/actions/runs/37483332759) | telegram | `e5566b2` (#153, R2 image route) | security+QA reviewed clean before merge | Owner already answered **skip** — left unapproved, no further action |
| [37489577515](https://github.com/DevSecObie/cyberjudah-telegram/actions/runs/37489577515) | telegram | `514eb53` (#150, Timeline portraits: Rome + Reformers) | its own QA+Security review (CYB-101) never completed | **Resolved, not by me** — GitHub rejected the deployment (`conclusion: failure`, protection-rule rejection). No longer on the gate; no action needed. |
| [37492875454](https://github.com/DevSecObie/cyberjudah-telegram/actions/runs/37492875454) | telegram | `6fc34eae` (#162, one changelog file per PR) | merged directly on GitHub at 16:05 UTC, not by me | **Resolved, not by me** — approved and deployed (`conclusion: success`). No action needed. |
| [37498916700](https://github.com/DevSecObie/cyberjudah-telegram/actions/runs/37498916700) | telegram | `5cd5953` (#163, "Keep Bible audio playing across screens and chapters") | **merged directly on GitHub at 16:50 UTC, not by me — with no QA/Security review ever completed** (no review issue exists for #163 beyond the engineering tracking issue CYB-122; the Reviewer seat has been paused throughout) | **New this sweep — sitting on the `production` gate right now, needs the owner's go or skip.** |

## Not yet ready

| Repo | PR | Title | Why not | Who acts |
|---|---|---|---|---|
| cyberjudah | [#64](https://github.com/DevSecObie/cyberjudah/pull/64) | Apocrypha people: Mattathias's family (1 Maccabees 1-7) | CI green. Fidelity review (CYB-150) still unstarted — **and the Precepts Reviewer seat is now `paused`** (see process notes), so nobody can pick it up until the owner/board un-pauses it. | Owner (un-pause the seat), then Precepts Reviewer |
| cyberjudah | [#68](https://github.com/DevSecObie/cyberjudah/pull/68), [#69](https://github.com/DevSecObie/cyberjudah/pull/69) | Apocrypha people: 2 Maccabees, Judith | Stacked on #64 → #68; held until #64 merges and these retarget to `main` | Precepts Reviewer, after #64 (same pause blocker) |
| cyberjudah | [#40–44](https://github.com/DevSecObie/cyberjudah/pull/40) | Copilot draft class notes | Disposition pending the owner's per-class decisions, [CYB-96](/CYB/issues/CYB-96) | Owner |
| cyberjudah | [#25](https://github.com/DevSecObie/cyberjudah/pull/25), [#10](https://github.com/DevSecObie/cyberjudah/pull/10), [#4](https://github.com/DevSecObie/cyberjudah/pull/4) | Audio alignment draft; dirty `claude/*` branch; Dependabot on `v5` base | Unchanged holds | Owner / original authors |
| telegram | [#152](https://github.com/DevSecObie/cyberjudah-telegram/pull/152) | Browser test for #139 | Based on #139's own branch; rides on its disposition (now moved to the Ready table above) | Follows #139 |
| telegram | [#158](https://github.com/DevSecObie/cyberjudah-telegram/pull/158) | Tests for #153: `/api/img/` serves only allowlisted keys | Current with `main`; `browser-tests`/`stage` still pending, nothing failing | Nobody; ready once green |
| telegram | [#162](https://github.com/DevSecObie/cyberjudah-telegram/pull/162) | Changelog entries as one file per PR | **Merged and deployed** (run 37492875454, success) — removed from the open list | — |
| telegram | [#155](https://github.com/DevSecObie/cyberjudah-telegram/pull/155) | Pause scripture audio without losing your place | **Merged** since the last report, directly on GitHub, not by me | — |
| telegram | [#163](https://github.com/DevSecObie/cyberjudah-telegram/pull/163) | Keep Bible audio playing across screens | **Merged** since the last report (16:50 UTC), directly on GitHub, not by me, with **no QA/Security review ever completed** — see the deploy-gate table above | — |

## Held (leave unless the owner asks)

content #4, #10, #25

## Process notes (21:10 UTC, CYB-254)

- Scoped run: [CYB-254](/CYB/issues/CYB-254) asked me to review and put PRs [#74](https://github.com/DevSecObie/cyberjudah/pull/74), [#81](https://github.com/DevSecObie/cyberjudah/pull/81), [#82](https://github.com/DevSecObie/cyberjudah/pull/82) (class notes) on this list. All three verified directly against GitHub: `OPEN`, `MERGEABLE`/`CLEAN`, one file each, `validate` check passing. Per rule 1, merging them is the owner's call, not mine.
- While here, confirmed by `gh pr view --json state` that rows previously in the Ready table for [#70](https://github.com/DevSecObie/cyberjudah/pull/70), [#57](https://github.com/DevSecObie/cyberjudah/pull/57), [#59](https://github.com/DevSecObie/cyberjudah/pull/59), [#63](https://github.com/DevSecObie/cyberjudah/pull/63), [#66](https://github.com/DevSecObie/cyberjudah/pull/66) are all `MERGED` — removed as stale. No action needed on those.
- Not re-swept this run: the rest of cyberjudah's open PRs ([#75](https://github.com/DevSecObie/cyberjudah/pull/75), [#80](https://github.com/DevSecObie/cyberjudah/pull/80)) and telegram's full PR list, and the "Not yet ready" / "Held" / deploy-gate tables below, which are carried over unchanged from the 17:00 UTC sweep and may be stale. Next full sweep should re-verify them.

## Process notes (17:00 UTC sweep)

- **Seats, re-checked:** Engineer, Notes Writer, Claude (CEO), Precepts Reviewer, Reviewer (QA and security), Precepts Writer, Image Curator, Junior Timeline Researcher A still `paused`; Codex Engineer and Junior Timeline Researcher B still `error`. **Chief of Staff and Data Steward are now live** (`running`/active) — a change from the last several sweeps, but neither holds the Reviewer or Precepts Reviewer seat, so CYB-150 (Apocrypha fidelity), CYB-194 (#139 re-check), and the missing #163 review still have nobody who can pick them up. Only Timeline Researcher, Junior Class Archivist, Data Steward, Chief of Staff, and this seat are invokable.
- **No merges or deploy approvals by me this sweep** (list-only, per the authority resolution already recorded on CYB-100). Three deploy-gate runs resolved themselves since the last report, none by me: #150's run failed/was rejected by GitHub's protection rules; #162's run was approved and deployed by someone else. A new one is now on the gate: #163 merged directly on GitHub at 16:50 UTC and its deploy (run 37498916700) is waiting right now — see the table above.
- **#163 is a repeat of the #150/#156 pattern**: a PR merged to `main` while the Reviewer seat was paused, with no QA/Security verdict ever recorded (only the engineering tracking issue CYB-122 exists for it). Flagging again for visibility — not reversible from this seat, and not something I can prevent since these merges aren't happening through me.
- #146, #147, and #139 are now all fully CI-green on their current heads (including `stage`), moved into the Ready table above; they remain on the owner's own branches (`ceejay/*`), so I have not merged `main` into them.
