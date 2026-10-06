# Ready to merge — 2026-10-06 01:20 UTC

Under the owner's standing job [CYB-100](/CYB/issues/CYB-100): the Release Manager reviews, discusses with submitters, and merges what qualifies; this list is now also posted as a sweep report on CYB-100, which is the primary record. This file is the same list committed to the repo.

## Merged this sweep
| # | Repo | PR | Title | Why |
|---|---|---|---|---|
| 1 | telegram | [#160](https://github.com/DevSecObie/cyberjudah-telegram/pull/160) | Timeline: rebuild data so the 37 newly approved portraits attach | Reviewed PASS (CYB-141, QA+security), straight data regeneration following merged #148, CI green, no conflict |

## Brought current this sweep (not merged)
| Repo | PR | Title | What changed |
|---|---|---|---|
| telegram | [#146](https://github.com/DevSecObie/cyberjudah-telegram/pull/146) | Deps (production): react-router 7→8 | Merged `main` in; only conflict was `CHANGELOG.md` (combined both Unreleased entries) — mine to resolve. Still held: major upgrade needs the owner's go-ahead |
| telegram | [#147](https://github.com/DevSecObie/cyberjudah-telegram/pull/147) | Deps (production): marked 16→18 | Same treatment. Still held: renders transcript text, owner's call |

## Flagged back to the author this sweep (content-data conflict, not mine to resolve)
| Repo | PR | Title | What's wrong | Who acts |
|---|---|---|---|---|
| telegram | [#150](https://github.com/DevSecObie/cyberjudah-telegram/pull/150) | Timeline portraits: 11 public-domain sources (Rome, the Reformers) | Behind `main` since #148; merging `main` in conflicts in `app/scripts/timeline-portraits.json` | Author (owner's `bot/*` session) |
| telegram | [#151](https://github.com/DevSecObie/cyberjudah-telegram/pull/151) | Portraits: batch m-03, eleven more of the most-named people | Same — behind `main`, same file conflicts. Review (CYB-127) already passed clean; ready the moment it's current | Author (owner's `claude/*` session) |

## Not yet ready
| Repo | PR | Title | Why not | Who acts |
|---|---|---|---|---|
| telegram | [#149](https://github.com/DevSecObie/cyberjudah-telegram/pull/149) | Tests: People portraits guard for #148 | CI green, reviewed indirectly (CYB-92, CYB-127 pass); GitHub's merge API now refuses it as "part of a stack" and refuses a branch update the same way — a platform/stacking quirk, not a content or CI problem | Needs investigation (CEO) or a retry next sweep |
| telegram | [#154](https://github.com/DevSecObie/cyberjudah-telegram/pull/154) | Bump @types/node 22→26 (development group) | devDependency-only, not security/content-sensitive; branch updated to current `main`, but GitHub reports `mergeStateStatus: BLOCKED` ("base branch policy prohibits the merge") right after the update — checks need to finish re-running on the new head | Retry once checks finish (next sweep) |
| telegram | [#156](https://github.com/DevSecObie/cyberjudah-telegram/pull/156) | Donations: GET /api/donations and a gift-aware POST /api/invoice | Security/QA verdict (CYB-137): **fail** — one required privacy fix from CYB-135 still outstanding (`donations` table untouched by delete/export paths). Already correctly blocking the author's tracking issue (CYB-82) | Backend engineer |
| telegram | [#153](https://github.com/DevSecObie/cyberjudah-telegram/pull/153) | Pictures from R2: portraits and Timeline paintings served from the bucket | Security+QA review (CYB-128) passed clean; stacked on #151 → #148. Waits for #151 to land on `main`, then GitHub retargets it | Follows #151 |
| telegram | [#158](https://github.com/DevSecObie/cyberjudah-telegram/pull/158), [#152](https://github.com/DevSecObie/cyberjudah-telegram/pull/152) | Tests for #153 / browser test for #139 | Based on `claude/images-r2` and `ceejay/search-ai-answer` respectively, not `main` — ride on their parent PR's disposition | Follow their stacks |
| telegram | [#139](https://github.com/DevSecObie/cyberjudah-telegram/pull/139) | AI answer block in search | Reviewer verdict (CYB-93): fail on wording/docs (stale PR-body claim, false "no sign-in" claim, PRIVACY.md gap, per-IP quota math), pass on code safety. Owner's `ceejay/*` branch | Owner, via the CEO |
| telegram | [#150](https://github.com/DevSecObie/cyberjudah-telegram/pull/150) | Timeline portraits (Rome, Reformers) | Its review, [CYB-101](/CYB/issues/CYB-101), has sat unstarted in the Reviewer's backlog since ~22:15 UTC yesterday — 3+ hours, flagged three sweeps running. Escalated to the CEO this sweep ([CYB-149](/CYB/issues/CYB-149)) | Reviewer / CEO |
| telegram | [#155](https://github.com/DevSecObie/cyberjudah-telegram/pull/155) | Pause scripture audio without losing your place or settings | Draft, dirty; GitHub Actions never triggered on it (tracked separately, [CYB-131](/CYB/issues/CYB-131)) | Author / CEO |
| telegram | [#157](https://github.com/DevSecObie/cyberjudah-telegram/pull/157) | Bump the production group across 1 directory with 2 updates | Duplicates #146/#147 exactly; held like the earlier #142 until those two land | Closes once #146/#147 resolve |
| cyberjudah | [#54](https://github.com/DevSecObie/cyberjudah/pull/54), [#57](https://github.com/DevSecObie/cyberjudah/pull/57), [#59](https://github.com/DevSecObie/cyberjudah/pull/59), [#63](https://github.com/DevSecObie/cyberjudah/pull/63) | Precept passes | Each already has its own CEO-routed "ready to merge" tracking issue (CYB-129, CYB-140, CYB-143) pending the owner's fixes or the standing approval in `ops/STATE.md` §1 (still unconfirmed) — not the Release Manager's to merge under any reading of the standing job | Owner / CEO |
| cyberjudah | [#47](https://github.com/DevSecObie/cyberjudah/pull/47) | R2 outlines: match all 1,262 by text, date 151 classes | CI green, no conflict, but changes class dates/teacher attributions — content-direction territory with no review assigned yet | CEO: assign a content review |
| cyberjudah | [#40–44](https://github.com/DevSecObie/cyberjudah/pull/40) | Copilot's draft class notes | Unchanged; owner's per-class choice tracked on [CYB-96](/CYB/issues/CYB-96) | Owner |

## Held (leave unless the owner asks)
cyberjudah #10 (`claude/*`, dirty — not the team's to rebase), #25 (audio draft), #4 (TypeScript 5→7 and other majors, `v5` base)

## Deploys that will follow
- A production deploy (`deploy.yml`) follows every telegram merge above once it happens; the owner approves it in Actions. #160 merged this sweep — a deploy is waiting.
- A data publish (`data.yml`) follows every cyberjudah merge that touches the vault; the owner approves `production` there too.
