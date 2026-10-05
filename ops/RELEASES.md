# Ready to merge — 2026-10-05 23:20 UTC

Under the owner's standing job [CYB-100](/CYB/issues/CYB-100): the Release Manager reviews, discusses with submitters, and merges what qualifies; this list is now also posted as a sweep report on CYB-100, which is the primary record. This file is the same list committed to the repo.

## Merged this sweep
| # | Repo | PR | Title | Why |
|---|---|---|---|---|
| 1 | telegram | [#144](https://github.com/DevSecObie/cyberjudah-telegram/pull/144) | Dependabot: ignore major versions of TS, Vite, plugin-react, workers-types | Config-only, CI green, not security-sensitive |
| 2 | telegram | [#145](https://github.com/DevSecObie/cyberjudah-telegram/pull/145) | Deps (production): react-query, hono, Anthropic SDK patch/minor bumps | Minor/patch only, CI green (main merged in to resolve a CHANGELOG.md conflict with #144), not security-sensitive |

## Not yet ready
| Repo | PR | Title | Why not | Who acts |
|---|---|---|---|---|
| telegram | [#146](https://github.com/DevSecObie/cyberjudah-telegram/pull/146) | Deps (production): react-router 7→8 | Major upgrade named in the standing job's "ask the owner first" list | Owner |
| telegram | [#147](https://github.com/DevSecObie/cyberjudah-telegram/pull/147) | Deps (production): marked 16→18 | Major upgrade, renders transcript text; owner's call per the standing job | Owner |
| telegram | [#148](https://github.com/DevSecObie/cyberjudah-telegram/pull/148) | People show their portraits; 37 approved Timeline portraits | CI green, content reviewed (CYB-92 pass), but all six commits are authored `Claude <noreply@anthropic.com>` — rule 12 on the commit identity itself | Owner: fix authorship or say how to write the squash commit |
| telegram | [#149](https://github.com/DevSecObie/cyberjudah-telegram/pull/149) | Tests: People portraits guard for #148 | Stacked on #148 | Follows #148 |
| telegram | [#139](https://github.com/DevSecObie/cyberjudah-telegram/pull/139) | AI answer block in search | Reviewer verdict (CYB-93): fail on wording/docs (stale PR-body claim, "no sign-in" claim is false, PRIVACY.md out of date on the new per-IP counter, per-IP quota larger than the daily breaker); code safety passed. Owner's `ceejay/*` branch | Owner, via the CEO |
| telegram | [#152](https://github.com/DevSecObie/cyberjudah-telegram/pull/152) | Browser test for the AI answer block (tests #139) | Based onto `ceejay/search-ai-answer` (#139's branch), not `main`; follows #139's disposition | Follows #139 |
| telegram | [#150](https://github.com/DevSecObie/cyberjudah-telegram/pull/150) | Timeline portraits: 11 public-domain sources (Rome, the Reformers) | CI green; QA+Security review (CYB-101) opened 22:15 UTC, still in backlog, not started | Reviewer |
| telegram | [#151](https://github.com/DevSecObie/cyberjudah-telegram/pull/151) | Portraits: batch m-03, eleven more | Stacked on #148; review opened this sweep ([CYB-127](/CYB/issues/CYB-127)) | Reviewer, then follows #148 |
| telegram | [#153](https://github.com/DevSecObie/cyberjudah-telegram/pull/153) | Pictures from R2: portraits and Timeline paintings served from the bucket | Touches `.github/workflows/deploy.yml` and a new public route against the existing `CLOUDFLARE_API_TOKEN` — security-sensitive; review opened this sweep ([CYB-128](/CYB/issues/CYB-128), high priority). Stacked on #151 → #148 | Reviewer, then follows the stack |
| telegram | [#142](https://github.com/DevSecObie/cyberjudah-telegram/pull/142) | Bump the production group with 5 updates (Dependabot) | Superseded by #144/#145/#146/#147 once all land; `stage` red by design (no secrets on Dependabot PRs); `mergeStateStatus: BEHIND` | Close once the four replacements merge |
| cyberjudah | [#58](https://github.com/DevSecObie/cyberjudah/pull/58) | notes --plan: skip classes whose note is already in an open PR | CI green; Security/QA review (CYB-98) still in progress | Reviewer |
| cyberjudah | [#59](https://github.com/DevSecObie/cyberjudah/pull/59) | Precept pass: The Slave Mentality Yesterday & Today | Precepts Reviewer requested 12 fixes (CYB-110); author (Precepts Writer) owns the fix on the same branch (CYB-74) | Precepts Writer |
| cyberjudah | [#54](https://github.com/DevSecObie/cyberjudah/pull/54) | Precept pass: Revelation 2 Message to the 7 Churches (corrections) | Precepts Reviewer requested 19 fixes incl. a rule-12 commit trailer (CYB-91); author is the owner's own session | Owner |
| cyberjudah | [#57](https://github.com/DevSecObie/cyberjudah/pull/57) | Precept pass: You Are Hated And In Hell | Precepts Reviewer requested 8 fixes (CYB-97); author is the owner's own session | Owner |
| cyberjudah | [#47](https://github.com/DevSecObie/cyberjudah/pull/47) | R2 outlines: match all 1,262 by text, date 151 classes | CI green, no conflict now (was dirty), but no content review yet and changes class dates/teacher attributions — "what the app teaches" territory | CEO: assign a content review before this goes on the ready list |
| cyberjudah | [#40–#44](https://github.com/DevSecObie/cyberjudah/pull/40) | Copilot's draft class notes | Disposition pending the owner's per-class choice, tracked on [CYB-96](/CYB/issues/CYB-96) | Owner |

## Held (leave unless the owner asks)
cyberjudah #10 (`claude/*`, DIRTY/CONFLICTING — not the team's to rebase), #25 (audio draft), #4 (TypeScript 5→7 and other majors)

## Deploys that will follow
- A production deploy (`deploy.yml`) follows every telegram merge above once it happens; the owner approves it in Actions.
- A data publish (`data.yml`) follows every cyberjudah merge that touches the vault; the owner approves `production` there too.
