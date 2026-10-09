# eng/people-evidence-check

Scripture-evidence check for People batches (CYB-313), with a follow-up (CYB-444)
after the Reviewer's post-merge verdict on CYB-337 found the merged checker failing
every People batch that patches an existing person, and its tests dropped from CI.

## What
- `engine/people-evidence.mjs`: ports the whole-word name-form matching from the Apocrypha proposal's `check.py` into the content repo's engine. Every person a batch adds or edits must cite only verses that resolve in `data/bible/` and whose KJV text contains one of the person's name forms — now matched hyphen/space-insensitively and with an optional trailing `s`/`'s` (so `Esar-haddon` meets `2-kings/19/37`'s `Esarhaddon`, and `Israelite` meets `exodus/9/7`'s `Israelites`) — as a whole word, unless `engine/people-evidence-exceptions.json` records the reference with a written reason.
- A changed person's verses that a batch keeps unchanged from before it (`person.verses ∩ before.verses`, via the new `beforeDoc` option) are not re-proven; only the verses a batch actually adds or edits need evidence, matching `check.py`'s `set(p['verses']) == set(old['verses']) | (matched - excludedMatches)`. On #68+#69 (106 changed ids) this removes 111 of 124 problems; on #98's Tobit batch (35 changed ids) it removes 18 of 101. Remaining problems are true positives on genuinely new citations (spelling variants the Apocrypha text uses, like "Neemias" for Nehemiah), for the batch authors to fix.
- New `engine/people-evidence-exceptions.json`: the exceptions file (empty; mirrors the `people-reciprocity-exceptions.json` pattern).
- `engine/people-evidence.test.mjs`: synthetic-person tests (unnamed verse fails, reasoned exception passes, reason-less exception fails, unresolvable verse fails, non-KJV source skipped, a legacy verse on a patched person is not re-proven, a newly added verse still needs evidence, hyphen/space and trailing-s normalisation pass, and `Aaro` still fails `Aaron`).
- `engine/check.mjs`: runs the evidence check on the `PEOPLE_BASE` changed ids, passing `beforeDoc`, next to the reciprocity check. It is a gate, not report-only: a problem calls `process.exit(1)` and fails CI.
- `.github/workflows/quality.yml`: runs the new test file (CYB-444: this was dropped from the `node --test` line in the CYB-313 merge and never ran in CI). Workflow change: one line, `node --test` only — no `permissions`, `secrets` or trigger change (needs security review per rule 7).

## Notes
- CYB-313 proposed scoping to `source.name === 'King James Version with Apocrypha'`, but the real catalog carries no `source` field at all (verified 0 of 3,234 on the Judith batch branch), so that filter would check nobody. The check covers every person a batch adds or edits, mirroring `people-reciprocity.mjs`; a future batch carrying the proposal's source field is still honored (non-KJV sources skip).
- No existing corpus allow-list was needed: with `PEOPLE_BASE` scoping, untouched people are never checked.
