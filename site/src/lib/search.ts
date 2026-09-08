import { createServerFn } from "@tanstack/react-start";
import { parseQuery, ftsExpr } from "./search-query";

/**
 * Library search, server-side against the FTS5 table in D1 (search_docs, loaded from the
 * engine's search.sql on every publish). Phrases in quotes match exactly; bare words must
 * all appear; when that finds little, a looser "any of these words" pass fills in, marked so
 * the page can say so. Results come back per kind, ranked by bm25 with the title weighted.
 */
export type SearchHit = { kind: string; title: string; url: string; sub: string; snippet: string; loose?: boolean };
export type SearchResult =
  | { ok: true; q: string; mode: "strict" | "loose" | "mixed"; counts: Record<string, number>; hits: SearchHit[]; ms: number }
  | { ok: false; reason: string };

export const KINDS = ["verse", "law", "precept", "case", "study", "class", "captains", "history", "encyclopedia"] as const;

type Row = { kind: string; title: string; url: string; sub: string; snippet: string };

async function runSearch(q: string, only: string | undefined, limit: number): Promise<SearchResult> {
  const t0 = Date.now();
  let db: D1Database | undefined;
  try {
    const cf = await import("cloudflare:workers");
    db = cf.env.DB;
  } catch { /* not running on Workers */ }
  if (!db) return { ok: false, reason: "no-db" };
  const parsed = parseQuery(q);
  if (!parsed.phrases.length && !parsed.terms.length) return { ok: true, q, mode: "strict", counts: {}, hits: [], ms: 0 };
  const strict = ftsExpr(parsed, "AND");
  const loose = parsed.terms.length + parsed.phrases.length > 1 ? ftsExpr(parsed, "OR") : null;
  const kinds = only && (KINDS as readonly string[]).includes(only) ? [only] : [...KINDS];
  // Columns: kind, title, url, sub, text, book, chapter. Title matches count four times a body match.
  const rank = "bm25(search_docs, 0, 4.0, 0, 0, 1.0, 0, 0)";
  const select = `SELECT kind, title, url, sub, snippet(search_docs, 4, '', '', '…', 18) AS snippet FROM search_docs WHERE search_docs MATCH ?1 AND kind = ?2 ORDER BY ${rank} LIMIT ?3`;
  const countSql = "SELECT kind, count(*) AS n FROM search_docs WHERE search_docs MATCH ?1 GROUP BY kind";
  try {
    // One round trip: the per-kind counts and the top rows of every kind, together.
    const pass = async (expr: string) => {
      const res = await db!.batch<Row & { n?: number }>([db!.prepare(countSql).bind(expr), ...kinds.map((k) => db!.prepare(select).bind(expr, k, limit))]);
      const counts: Record<string, number> = {};
      for (const r of res[0].results as unknown as { kind: string; n: number }[]) if (kinds.includes(r.kind)) counts[r.kind] = r.n;
      return { counts, hits: dedupe(res.slice(1).flatMap((r) => r.results)) };
    };
    const strictPass = await pass(strict);
    const counts = strictPass.counts;
    let hits = strictPass.hits;
    let mode: "strict" | "loose" | "mixed" = "strict";
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (loose && total < 8) {
      const loosePass = await pass(loose);
      const seen = new Set(hits.map((h) => `${h.kind}|${h.url}`));
      const extra = loosePass.hits.filter((h) => !seen.has(`${h.kind}|${h.url}`)).map((h) => ({ ...h, loose: true }));
      for (const [k, n] of Object.entries(loosePass.counts)) counts[k] = Math.max(counts[k] ?? 0, n);
      hits = [...hits, ...extra];
      mode = total ? "mixed" : "loose";
    }
    return { ok: true, q, mode, counts, hits, ms: Date.now() - t0 };
  } catch {
    // Do not log queries, SQL, or raw database errors: those can contain visitor input.
    console.error(JSON.stringify({ event: "search_failed", elapsedMs: Date.now() - t0 }));
    return { ok: false, reason: "search-unavailable" };
  }
}

function dedupe(rows: Row[]): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const r of rows) { const k = `${r.kind}|${r.url}`; if (seen.has(k)) continue; seen.add(k); out.push(r); }
  return out;
}

export const searchLibrary = createServerFn({ method: "GET" })
  .inputValidator((input: { q: string; only?: string; limit?: number }) => ({
    q: String(input.q ?? "").slice(0, 200),
    only: typeof input.only === "string" && input.only ? input.only : undefined,
    limit: Math.min(Math.max(Number(input.limit) || 8, 1), 300),
  }))
  .handler(async ({ data }) => runSearch(data.q, data.only, data.limit));
