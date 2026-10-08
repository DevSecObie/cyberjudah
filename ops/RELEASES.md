# Ready to merge — 2026-10-08 01:10 UTC

Replaces #88 (2026-10-07 03:10 UTC), stale after six owner merges overnight: telegram [#169](https://github.com/DevSecObie/cyberjudah-telegram/pull/169), [#171](https://github.com/DevSecObie/cyberjudah-telegram/pull/171), [#183](https://github.com/DevSecObie/cyberjudah-telegram/pull/183), [#186](https://github.com/DevSecObie/cyberjudah-telegram/pull/186), [#188](https://github.com/DevSecObie/cyberjudah-telegram/pull/188); cyberjudah [#89](https://github.com/DevSecObie/cyberjudah/pull/89), [#101](https://github.com/DevSecObie/cyberjudah/pull/101). All seven leave this list.

**Mechanism change:** per the owner's instruction of 2026-10-07 22:21Z, the batch below is raised as a board approval (`request_board_approval`) rather than an `ask_user_questions`/`request_confirmation` card. This file remains the durable record. The lapsed production deploy of `d59cdb2ff` (#186) is a separate, already-raised board approval (`269b8312-0fd4-47d2-86a9-b9233fc9f822`) and is not repeated here.

## Ready, in order

| # | Repo | PR | Title | Checks | Reviews | Merge order | Deploy approval that follows |
|---|---|---|---|---|---|---|---|
| 1 | cyberjudah | [#109](https://github.com/DevSecObie/cyberjudah/pull/109) | ops: the Junior class archivist has standing scope over the archive paths | `validate` green | Reviewer: done, clean ([c83c0340](https://github.com/DevSecObie/cyberjudah/pull/109)) | standalone | none — ops/TEAM.md only, no vault path touched, `data.yml` publish should no-op |

## Not yet ready

| Repo | PR | Title | Why not | Who acts |
|---|---|---|---|---|
| telegram | [#192](https://github.com/DevSecObie/cyberjudah-telegram/pull/192) | Dependabot: proxy-addr 2.0.7→2.0.8 in /strong | `CLEAN`, all checks green (`stage`'s absence here is expected — Dependabot has no deploy secrets); no Reviewer verdict existed, created this sweep | Reviewer (new issue) |
| telegram | [#193](https://github.com/DevSecObie/cyberjudah-telegram/pull/193) | Show newest class day first; broadcasts in original order | `CLEAN`, all checks green; no Reviewer verdict existed, created this sweep | Reviewer (new issue) |
| telegram | [#191](https://github.com/DevSecObie/cyberjudah-telegram/pull/191) | Release pending search, privacy, accessibility and audio updates (catch-up bundle of #177/#179/#190/#192/#193) | `BLOCKED` — confirmed this is required status checks still running on a just-pushed commit (CodeQL, browser-tests ×3, bundles were `pending` at 00:53Z), not a failing check and not a missing required review (main's branch protection has no required-review rule, only `check`/`CodeQL`/`codeql`/`dependency-review`). No Reviewer verdict existed, created this sweep | Recheck CI next sweep; Reviewer |
| telegram | [#177](https://github.com/DevSecObie/cyberjudah-telegram/pull/177) | CI: run the Apocrypha proposal check when its sample or checker changes | `BEHIND` main; Reviewer already done, clean | Branch update (merge `main` in) — routed to the Codex Engineer/free seats per the shared-subscription standing order, not mine to push this run |
| telegram | [#179](https://github.com/DevSecObie/cyberjudah-telegram/pull/179) | Audio settings in Settings, and separate narration completeness for saved books | `DIRTY` (conflicts with `main`); QA done, Security done, both clean | Author/Engineer resolves the conflict (not content data, so mine to merge-in once clean, but I don't resolve conflicts) |
| telegram | [#190](https://github.com/DevSecObie/cyberjudah-telegram/pull/190) | Add a consent-gated provider for library search answers | Draft, `DIRTY`; one `browser-tests (chromium)`/`playwright` check failing; no Reviewer verdict existed, created this sweep | Author takes it out of draft and resolves conflicts/failing check; Reviewer |
| cyberjudah | [#102](https://github.com/DevSecObie/cyberjudah/pull/102) | Engine: scripture-evidence check for People batches (CYB-313) | `CLEAN`, `validate` green; Reviewer issue exists but still `todo` — not started as of 00:46Z | Reviewer |
| cyberjudah | [#119](https://github.com/DevSecObie/cyberjudah/pull/119) | Notes: Ezekiel 37:1-11 excerpt | `CLEAN`, `validate` green, mechanically ready; blocked on an owner editorial call (word-count floor, clip placement) already raised as [CYB-406](/CYB/issues/CYB-406), pending `ask_user_questions` | Owner (on CYB-406, not duplicated here) |
| cyberjudah | [#121](https://github.com/DevSecObie/cyberjudah/pull/121) | Notes: Escape Thankskilling — Oh God & My Lord | `CLEAN`, `validate` green, mechanically ready; blocked on the same owner call (reference-trim count for the over-ceiling length) on [CYB-406](/CYB/issues/CYB-406) | Owner (on CYB-406, not duplicated here) |
| cyberjudah | [#41](https://github.com/DevSecObie/cyberjudah/pull/41) | Copilot draft: class note for EBEwdiVcsTg "SPIRITUAL UPRISING" | `UNSTABLE`, draft, two `CHANGES_REQUESTED` reviews; Reviewer verdict already done | Owner, tracked on [CYB-96](/CYB/issues/CYB-96) |
| cyberjudah | [#10](https://github.com/DevSecObie/cyberjudah/pull/10) | notes: attach recordings of twelve classes with no video id | `DIRTY`; `claude/*` branch, not the team's — owner assigned the conflict resolution to the Notes Writer this run ([f7bb928c](/CYB/issues/f7bb928c-07df-4699-a6ca-497726bbe3f4)) | Notes Writer |

## Held (leave unless the owner asks)

cyberjudah [#25](https://github.com/DevSecObie/cyberjudah/pull/25) (draft, audio alignment continuation), [#4](https://github.com/DevSecObie/cyberjudah/pull/4) (Dependabot, base `v5` not `main`)

## Process notes

- Live open-PR count this sweep: 15 (telegram 6, cyberjudah 9) — matches the sweep read at ~00:50Z, down from 26 on CYB-387 after six owner merges plus #188.
- Four review issues created this sweep (none existed before): telegram #190, #191, #192, #193, as children of a new CEO-assigned tracking issue (these four PRs trace to no existing team Paperclip issue).
- `#102`'s Reviewer issue already existed but was unstarted (`todo`); not duplicated, just carried forward.
- `#119`/`#121` already have a full review on file (this seat, prior run) and a pending owner-decision interaction (CYB-406); not re-reviewed or re-escalated.
- Rule 1 unchanged: the Release Manager merges nothing here. The precept-pass standing-approval exception (`ops/STATE.md` §1) belongs to the Precepts Reviewer alone and does not appear in this file.
