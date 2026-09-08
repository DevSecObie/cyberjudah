/** Quoted phrases retain all words; only unquoted terms drop common stop words. */
const STOP = new Set(["and", "or", "not", "the", "a", "of"]);
const tokens = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, " ").split(/\s+/).map((t) => t.replace(/^'+|'+$/g, "")).filter(Boolean);
const quote = (t: string) => `"${t.replace(/"/g, '""')}"`;

export function parseQuery(q: string): { phrases: string[]; terms: string[] } {
  const phrases: string[] = [];
  const rest = q.replace(/"([^"]+)"/g, (_m, p: string) => {
    const words = tokens(p);
    if (words.length) phrases.push(words.join(" "));
    return " ";
  });
  return { phrases, terms: tokens(rest).filter((t) => !STOP.has(t)) };
}

export function ftsExpr(p: { phrases: string[]; terms: string[] }, join: "AND" | "OR"): string {
  // A loose pass may relax bare terms, but must never discard a requested phrase.
  const terms = p.terms.map(quote).join(` ${join} `);
  return [...p.phrases.map(quote), ...(terms ? [join === "OR" && p.terms.length > 1 ? `(${terms})` : terms] : [])].join(" AND ");
}
