# Ready to merge — 2026-10-06 02:35 UTC

## Ready, in order

| # | Repo | PR | Title | Checks | Reviews | Merge order | Deploy approval that follows |
|---|---|---|---|---|---|---|---|
| 1 | telegram | [#146](https://github.com/DevSecObie/cyberjudah-telegram/pull/146) | Deps (production): react-router 7→8 | all green | n/a (dependency bump) | standalone | production deploy (`deploy.yml`) — **major-upgrade go-ahead needed from the owner first** |
| 2 | telegram | [#147](https://github.com/DevSecObie/cyberjudah-telegram/pull/147) | Deps (production): marked 16→18 | all green | n/a (dependency bump) | standalone | production deploy — **major-upgrade go-ahead needed; renders transcript text** |

## Not yet ready

| Repo | PR | Title | Why not | Who acts |
|---|---|---|---|---|
| telegram | [#149](https://github.com/DevSecObie/cyberjudah-telegram/pull/149) | Tests: People portraits guard for #148 | CI fully green, content already reviewed (CYB-92, CYB-127 pass) clean. GitHub's merge API refuses it as "part of a stack" (likely leftover stacking metadata from when its base was #148's branch); the standard and REST-async merge paths both reject it. | Needs someone with repo-admin access to look at the PR's stack metadata; not fixable via `gh`/API from this seat. |
| telegram | [#150](https://github.com/DevSecObie/cyberjudah-telegram/pull/150) | Timeline portraits: 11 public-domain sources (Rome, the Reformers) | `DIRTY`/conflicting: merging `main` in conflicts in `app/scripts/timeline-portraits.json` (content data) after #148/#160 merged. Flagged on the PR; not mine to hand-resolve. | Backend engineer (author) reconciles and pushes. |
| telegram | [#151](https://github.com/DevSecObie/cyberjudah-telegram/pull/151) | Portraits: batch m-03, eleven more of the most-named people | `BEHIND` `main`; review (CYB-127) already passed clean. This is the owner's own branch (`claude/portraits-m03`), not the team's — not pushed to. | Owner's session merges `main` in. |
| telegram | [#153](https://github.com/DevSecObie/cyberjudah-telegram/pull/153), [#158](https://github.com/DevSecObie/cyberjudah-telegram/pull/158) | R2 image route; tests for it | CI green, security/QA review (CYB-128) passed clean, but both are stacked on #151 → #148's chain. | Follow #151. |
| telegram | [#152](https://github.com/DevSecObie/cyberjudah-telegram/pull/152) | Browser test for the AI answer block in search | CI green; based on `ceejay/search-ai-answer` (#139's own branch), not `main`. | Rides on #139's disposition. |
| telegram | [#139](https://github.com/DevSecObie/cyberjudah-telegram/pull/139) | AI answer block in search | CI green; Reviewer verdict (CYB-93): fail on wording ("no sign-in required" is false), an undocumented per-IP raw-IP counter in `docs/PRIVACY.md`, and a per-IP quota that can exceed the daily free-model breaker alone. Pass on code safety. | Owner's own branch; the owner or CEO fixes the wording/privacy/quota points. |
| telegram | [#156](https://github.com/DevSecObie/cyberjudah-telegram/pull/156) | Donations: GET /api/donations and a gift-aware POST /api/invoice | CI green; Security/QA verdict (CYB-137): fail — the `donations` table isn't covered by the Delete/Download-my-data paths (CYB-135). | Backend engineer, tracked on CYB-82. |
| telegram | [#161](https://github.com/DevSecObie/cyberjudah-telegram/pull/161) | Timeline: wire Between the Testaments as a ready-for-data period; Angel heading | Browser tests still running; Reviewer found 3 fixable things (CYB-152), fixes pushed, re-check in progress (CYB-154, actively being worked). | Reviewer (QA and security), in progress. |
| telegram | [#157](https://github.com/DevSecObie/cyberjudah-telegram/pull/157) | Dependabot: production group, 2 updates | Duplicates #146/#147 exactly (reviewer verdict CYB-147: done). Held pending #146/#147's disposition. | Owner's go-ahead on #146/#147 first. |
| telegram | [#155](https://github.com/DevSecObie/cyberjudah-telegram/pull/155) | Pause scripture audio without losing your place or settings | Draft, `DIRTY`, Actions never triggered (CYB-131). | App engineer. |
| cyberjudah | [#66](https://github.com/DevSecObie/cyberjudah/pull/66) | Check two-way family links on every Apocrypha person batch (touches `.github/workflows/**`, security-sensitive) | CI green; Reviewer found 3 fixes (CYB-152), pushed, re-check in progress (CYB-154). | Reviewer (QA and security), in progress. |
| cyberjudah | [#64](https://github.com/DevSecObie/cyberjudah/pull/64), [#68](https://github.com/DevSecObie/cyberjudah/pull/68), [#69](https://github.com/DevSecObie/cyberjudah/pull/69) | Apocrypha people: 1 Maccabees → 2 Maccabees → Judith (stacked) | CI green on all three. Content-fidelity review (CYB-150, for #64) has sat unassigned/unstarted since it was opened; #68 and #69 have no fidelity review opened yet. | Escalated to the CEO this sweep — no seat on the chart owns Apocrypha people-record fidelity; needs routing. |
| cyberjudah | [#59](https://github.com/DevSecObie/cyberjudah/pull/59) | Precept pass: The Slave Mentality Yesterday & Today | Precepts Reviewer found one more fix (a trimmed quote at Deut. 28:16) on re-review. | Precepts Writer (CYB-74). |
| cyberjudah | [#63](https://github.com/DevSecObie/cyberjudah/pull/63) | Precept pass: Blood Toucheth Blood | Changes requested, 5 fixes; PR says explicitly not to merge until the owner does. | Owner's own session. |
| cyberjudah | [#54](https://github.com/DevSecObie/cyberjudah/pull/54), [#57](https://github.com/DevSecObie/cyberjudah/pull/57) | Precept passes: Revelation 2 corrections; You Are Hated And In Hell | Fix lists on the PRs (CYB-91, CYB-97); standing approval for precept-pass merges still unconfirmed (`ops/STATE.md` §1). | Owner's own session. |
| cyberjudah | [#47](https://github.com/DevSecObie/cyberjudah/pull/47) | R2 outlines: match all 1,262 by their text, date 151 classes | CI green, clean, no conflict. Changes class dates/teacher attributions; no content review routed yet. | CEO to assign a reviewer. |
| cyberjudah | [#40](https://github.com/DevSecObie/cyberjudah/pull/40)–[#44](https://github.com/DevSecObie/cyberjudah/pull/44) | Copilot's draft class notes | Awaiting the owner's per-class decisions (CYB-96). | Owner. |

## Held (leave unless the owner asks)

telegram #4 (TypeScript 5→7, major bump); cyberjudah #10 (`claude/*`, dirty/conflicting), #25 (audio draft)

## Merged this cycle (for the record)

cyberjudah-telegram #144, #145, #148, #149 *(attempted, blocked by GitHub's stack check — see above)*, #154, #160; cyberjudah #51, #52, #55, #56, #58, #60, #62. #142 closed as superseded by #145/#146/#147.

## Production deploys

No deploy is currently waiting on an approval gate. telegram #160 (Timeline rebuild, 37 portraits) was approved and deployed 2026-10-06 ~02:00 UTC under the owner's standing authorization for this conversation (posted on [CYB-100](/CYB/issues/CYB-100) ~01:51 UTC: "You have my permission to approve deployments… don't want to fall behind"). Routine telegram deploys following #144/#145/#154 (dependency bumps, no security/content surface) completed on their own; nothing further needed from the owner on those. The two major-upgrade PRs (#146, #147) still wait on the owner's explicit case-by-case word before merging, per the standing job's safeguard — the blanket deploy authorization is read as covering the deploy-gate click itself, not the separate major-upgrade and content-direction categories.
