# eng/people-evidence-check

Scripture-evidence check for People batches (CYB-313).

## What
- New `engine/people-evidence.mjs`: ports the whole-word name-form matching from the Apocrypha proposal's `check.py` into the content repo's engine. Every person a batch adds or edits must cite only verses that resolve in `data/bible/` and whose KJV text contains one of the person's name forms as a whole word, unless `engine/people-evidence-exceptions.json` records the reference with a written reason.
- New `engine/people-evidence-exceptions.json`: the exceptions file (empty; mirrors the `people-reciprocity-exceptions.json` pattern).
- New `engine/people-evidence.test.mjs`: synthetic-person tests (unnamed verse fails, reasoned exception passes, reason-less exception fails, unresolvable verse fails, non-KJV source skipped).
- `engine/check.mjs`: runs the evidence check on the `PEOPLE_BASE` changed ids, next to the reciprocity check. Report-only, fails CI on a new violation.
- `.github/workflows/quality.yml`: runs the new test file. (Workflow change: needs security review per rule 7.)

## Notes
- CYB-313 proposed scoping to `source.name === 'King James Version with Apocrypha'`, but the real catalog carries no `source` field at all (verified 0 of 3,234 on the Judith batch branch), so that filter would check nobody. The check covers every person a batch adds or edits, mirroring `people-reciprocity.mjs`; a future batch carrying the proposal's source field is still honored (non-KJV sources skip).
- No existing corpus allow-list was needed: with `PEOPLE_BASE` scoping, untouched people are never checked.
