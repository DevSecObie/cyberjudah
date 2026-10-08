# Ready to merge — 2026-10-08 02:05 UTC

Replaces #88 (2026-10-07 03:10 UTC), stale after six owner merges overnight: telegram [#169](https://github.com/DevSecObie/cyberjudah-telegram/pull/169), [#171](https://github.com/DevSecObie/cyberjudah-telegram/pull/171), [#183](https://github.com/DevSecObie/cyberjudah-telegram/pull/183), [#186](https://github.com/DevSecObie/cyberjudah-telegram/pull/186), [#188](https://github.com/DevSecObie/cyberjudah-telegram/pull/188); cyberjudah [#89](https://github.com/DevSecObie/cyberjudah/pull/89), [#101](https://github.com/DevSecObie/cyberjudah/pull/101). All seven leave this list.

**Mechanism change:** per the owner's instruction of 2026-10-07 22:21Z, the batch below is raised as a board approval (`request_board_approval`) rather than an `ask_user_questions`/`request_confirmation` card. This file remains the durable record. The lapsed production deploy of `d59cdb2ff` (#186) is a separate, already-raised board approval (`269b8312-0fd4-47d2-86a9-b9233fc9f822`) and is not repeated here.

**Correction from the 01:10 list (flagged by the Chief of Staff):** that version listed telegram #191 (the catch-up bundle) *and* its components #177/#179/#190/#192/#193 as if both were live, independent merge paths. They are not alternatives to choose between later — only one path is on this list. See "One path, not two" below for which, and why.

## One path, not two: telegram #191 is the release vehicle

#191 (`release/app-catchup-oct8`, 34 commits) is not a sixth, parallel PR alongside #177/#179/#190/#192/#193 — it is a combined tree that **already contains** all five (#186 is already merged into it and into `main`). Its own description states additional review fixes layered on top of the originals (an empty-narration-catalog display bug, a privacy keyed-hash collision on equal-length secrets, the evidence workflow trigger, updated privacy copy) and that this combined tree is what the owner asked to be tested and merged as one unit. Its one stated cross-repo dependency, cyberjudah #120 (class-ordering data), **merged at 00:31:22Z** — that gate is clear.

**The path:** #191 merges (once its own checks and Reviewer verdict are in); #177, #179, #192 and #193 then close as superseded — their diffs are already in `main` via #191, so merging them afterward would be a no-op at best and a conflict at worst. #190 (still draft, still `DIRTY`/`CONFLICTING` as a standalone branch) also closes as superseded, since #191's description describes its search-provider content as already carried and fixed in the combined tree — it does not continue as a separate open draft.

**The rejected alternative, named so it isn't tried later:** merging the four small, individually-green PRs (#177/#179/#192/#193) one at a time and then closing #191 as a redundant superset. This was considered and set aside — #191's extra review fixes are not present in the standalone PRs, so taking that path would ship the catalog/privacy bugs #191 already fixed, and would still leave #190 (the fifth component) stuck in draft with no vehicle. Only the owner can pick a different path than the one above; if they do, say so on the next sweep and this section will flip.

This resolves what #191's row described as a "catch-up bundle of #177/#179/#190/#192/#193" without also carrying those four as independent rows below — they appear once, under #191, with the closure each one gets.

## Ready, in order

| # | Repo | PR | Title | Checks | Reviews | Merge order | Deploy approval that follows |
|---|---|---|---|---|---|---|---|
| 1 | cyberjudah | [#109](https://github.com/DevSecObie/cyberjudah/pull/109) | ops: the Junior class archivist has standing scope over the archive paths | `validate` green | Reviewer: done, clean ([c83c0340](https://github.com/DevSecObie/cyberjudah/pull/109)) | standalone | none — ops/TEAM.md only, no vault path touched, `data.yml` publish should no-op |

## Not yet ready

| Repo | PR | Title | Why not | Who acts |
|---|---|---|---|---|
| telegram | [#191](https://github.com/DevSecObie/cyberjudah-telegram/pull/191) | Release pending search, privacy, accessibility and audio updates — **the release vehicle; see "One path, not two" above** | `UNSTABLE` — `browser-tests` (chromium/firefox/webkit) and `stage` still `pending` on the current push; `check`, CodeQL, `changelog`, `bundles`, `cms-content`, `dependency-review` all pass. Cross-repo gate (cyberjudah #120) is merged | Reviewer verdict `in_progress` (not yet posted); recheck CI next sweep |
| telegram | [#177](https://github.com/DevSecObie/cyberjudah-telegram/pull/177) | CI: run the Apocrypha proposal check when its sample or checker changes — **closes on #191 merge, not merged separately** | `BEHIND` main again (main moved further since 01:30Z); Reviewer already done, clean | No action needed if #191 lands — do not route this for a branch update, it is being closed, not merged |
| telegram | [#179](https://github.com/DevSecObie/cyberjudah-telegram/pull/179) | Audio settings in Settings, and separate narration completeness for saved books — **closes on #191 merge, not merged separately** | `UNSTABLE` (conflict resolved by the author since 01:10Z; one `browser-tests (chromium)` check still pending); QA done, Security done, both clean | No action needed if #191 lands — do not route this for conflict work, it is being closed, not merged |
| telegram | [#192](https://github.com/DevSecObie/cyberjudah-telegram/pull/192) | Dependabot: proxy-addr 2.0.7→2.0.8 in /strong — **closes on #191 merge, not merged separately** | `CLEAN`, all checks green; Reviewer verdict still `todo` | No action needed if #191 lands — the Reviewer verdict in progress is not required to close this as superseded |
| telegram | [#193](https://github.com/DevSecObie/cyberjudah-telegram/pull/193) | Show newest class day first; broadcasts in original order — **closes on #191 merge, not merged separately** | `CLEAN`, all checks green; Reviewer verdict still `todo` | No action needed if #191 lands — the Reviewer verdict in progress is not required to close this as superseded |
| telegram | [#190](https://github.com/DevSecObie/cyberjudah-telegram/pull/190) | Add a consent-gated provider for library search answers — **closes on #191 merge, not merged separately** | Draft, `DIRTY`/`CONFLICTING` as a standalone branch; superseded content lives in #191 instead | No action needed if #191 lands — this draft does not get taken out of draft or fixed up, it closes |
| cyberjudah | [#102](https://github.com/DevSecObie/cyberjudah/pull/102) | Engine: scripture-evidence check for People batches (CYB-313) | `CLEAN`, `validate` green; Reviewer issue exists but still `todo` — not started as of 00:46Z | Reviewer |
| cyberjudah | [#119](https://github.com/DevSecObie/cyberjudah/pull/119) | Notes: Ezekiel 37:1-11 excerpt | `CLEAN`, `validate` green, mechanically ready; blocked on an owner editorial call (word-count floor, clip placement) already raised as [CYB-406](/CYB/issues/CYB-406), pending `ask_user_questions` | Owner (on CYB-406, not duplicated here) |
| cyberjudah | [#121](https://github.com/DevSecObie/cyberjudah/pull/121) | Notes: Escape Thankskilling — Oh God & My Lord | `CLEAN`, `validate` green, mechanically ready; blocked on the same owner call (reference-trim count for the over-ceiling length) on [CYB-406](/CYB/issues/CYB-406) | Owner (on CYB-406, not duplicated here) |
| cyberjudah | [#41](https://github.com/DevSecObie/cyberjudah/pull/41) | Copilot draft: class note for EBEwdiVcsTg "SPIRITUAL UPRISING" | `UNSTABLE`, draft, two `CHANGES_REQUESTED` reviews; Reviewer verdict already done | Owner, tracked on [CYB-96](/CYB/issues/CYB-96) |
| cyberjudah | [#10](https://github.com/DevSecObie/cyberjudah/pull/10) | notes: attach recordings of twelve classes with no video id | Now `CLEAN` — the Notes Writer resolved the conflict this run ([f7bb928c](/CYB/issues/f7bb928c-07df-4699-a6ca-497726bbe3f4)); Reviewer verdict not reconfirmed this sweep, carried forward as unconfirmed rather than asserted | Reviewer (confirm or post verdict) |

## Held (leave unless the owner asks)

cyberjudah [#25](https://github.com/DevSecObie/cyberjudah/pull/25) (draft, audio alignment continuation), [#4](https://github.com/DevSecObie/cyberjudah/pull/4) (Dependabot, base `v5` not `main`)

## Process notes

- Live open-PR count: 15 (telegram 6, cyberjudah 9), unchanged since the 01:10Z sweep.
- **Fix this run:** the 01:10Z list named #191 a "catch-up bundle of #177/#179/#190/#192/#193" and then listed those five as independent ready-or-not rows with their own "who acts" — two live paths on one list. Flagged by the Chief of Staff at 01:24Z. Resolved above under "One path, not two": #191 is the one release vehicle; #177/#179/#190/#192/#193 appear once, as closures that follow its merge, not as separate merge candidates.
- Re-read at ~01:50Z: #177 is `BEHIND` again (main moved further since 01:30Z) and #179 is `UNSTABLE` (conflict the author already resolved; one browser-tests check still running) — both irrelevant to action now that neither is being merged standalone.
- #10 moved from `DIRTY` to `CLEAN` this run — the Notes Writer resolved the conflict ([f7bb928c](/CYB/issues/f7bb928c-07df-4699-a6ca-497726bbe3f4)). Its Reviewer verdict was not found under a dedicated issue this sweep; carried as unconfirmed rather than asserted done.
- `#102`'s Reviewer issue already existed but was unstarted (`todo`); not duplicated, just carried forward.
- `#119`/`#121` already have a full review on file (this seat, prior run) and a pending owner-decision interaction (CYB-406); not re-reviewed or re-escalated.
- Rule 1 unchanged: the Release Manager merges nothing here. The precept-pass standing-approval exception (`ops/STATE.md` §1) belongs to the Precepts Reviewer alone and does not appear in this file.
