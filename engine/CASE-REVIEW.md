# Case review — 2026-09-07

## Scope and limits

Structural review of the full case collection: scripture chapter/range validity,
law IDs, required narrative fields, verdicts, eras, and globally unique case slugs.
This checks that references exist, not that every interpretation follows from them.

Targeted narrative review against the repository's KJV text: the Sabbath breaker,
Ham, the Bethel mockers, Jephthah, Ahaziah of Israel, Solomon at Gibeon, and the man
of God from Judah. This is not a completed verse-by-verse editorial audit of every
case, nor a claim that the Bible's possible cases are now exhaustively catalogued.

## Corrections made

- **The Sabbath breaker:** Numbers 15:34 concerns what should be done to this man.
  Exodus 31:14–15 and 35:2 already state a death penalty for Sabbath work. Removed
  the claim that no penalty had been specified and the unsupported fuel motive.
- **Ham:** Genesis 9:21 describes Noah already uncovered; 9:22 says Ham saw and told
  his brothers. Removed the assertion that Ham himself uncovered Noah and labelled
  the comparison to later laws as interpretation.
- **The Bethel mockers:** 2 Kings 2:23–25 reports forty-two torn by bears, without an
  explicit death count. Changed the category from death to temporal judgment.
  Removed certainty about exact ages and the intended reference of “Go up.”
- **Case presentation:** “Laws broken” is retained on judgment pages, as requested.
  Verify individual law associations rather than renaming this section. Blessing
  pages retain “Laws kept.”

No existing slugs, eras, or verse anchors changed.

## Missing standalone entries added

- **The man who refused the prophetic command — 1 Kings 20:35–43.** Distinct from
  the prophet killed by a lion in 1 Kings 13. The refusal and the announced death
  are explicit; no motive for refusal is invented.
- **The two women before Solomon — 1 Kings 3:16–28.** The existing Gibeon entry
  covers the request for wisdom, not this adjudication. The new entry distinguishes
  the first woman's testimony, the mother's identification, the custody order,
  and the absence of a recorded punishment for the false claimant.

Ahaziah's entry already describes the two captains consumed by fire in 2 Kings 1.
That episode was not added again. A separate treatment of the third captain's plea
would be an optional expansion, not proof the broader incident was missing.

## Follow-up editorial work

- Continue narrative review era by era, distinguishing quotation, summary, and
  inference. Especially review “death” verdicts where only injury is stated.
- Review judicial cases whose punishment is unrecorded separately from cases with
  no judicial decision; the current verdict vocabulary groups them together.
- Do not infer completeness from counts or automated validation. Parables,
  prophetic oracles, court disputes and historical judgments have different scope.
- Jephthah's entry already acknowledges competing readings. Further changes to its
  conclusions should be an explicit editorial decision, not an automated correction.

## Verification

`node engine/check.mjs` now includes case-specific structural validation.
`npm test --prefix site` checks the complete corpus and failure fixtures including
reversed verse ranges, invalid law IDs and duplicate case API keys.
