/**
 * The Timeline's dates. The case studies are in narrative order (their codes run era by
 * era), but they carry dates only where a class gave one, in the case's own words: "the
 * teaching dates it about 814 to 798 BC". Only a sentence that attributes the date to the
 * teaching counts; a year mentioned in passing (the siege of 70 AD in a later case) is not
 * the event's date and is left out. Nothing is estimated.
 */

const YEAR = String.raw`(?:about |from about |in |c\. )?\d{2,4}(?: to \d{2,4})?\s*(?:BC|AD)`;
const SENTENCES = /[^.!?]+[.!?]?/g;
const TAUGHT = /\bteach(?:es|ing|ings|ers)?\b|\bclass(?:es)? teach/i;

/** The date the teaching gives a case, as written ("about 814 to 798 BC"), with the sentence it comes from; null when none. */
export function teachingDate(c) {
  const texts = [c.summary ?? "", ...(c.offenseFull ?? []), ...(c.judgmentFull ?? []), c.offense ?? "", c.judgment ?? ""];
  for (const text of texts) {
    for (const s of text.match(SENTENCES) ?? []) {
      if (!TAUGHT.test(s)) continue;
      const m = new RegExp(YEAR).exec(s);
      if (!m) continue;
      const label = m[0].replace(/^(from |in |c\. )/, (w) => (w === "from " ? "from " : "")).replace(/\s+/g, " ").trim();
      return { label, text: s.trim() };
    }
  }
  return null;
}
