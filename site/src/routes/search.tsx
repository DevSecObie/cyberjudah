import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Page } from "@/components/site/chrome";
import { dataOrigin } from "@/lib/api";
import { searchLibrary, type SearchHit, type SearchResult } from "@/lib/search";
import { pageHead } from "@/lib/head";

/**
 * Search runs on the server against the FTS5 index in D1 and renders with the page, so a
 * result is one round trip: a quoted phrase matches exactly, bare words must all appear,
 * and a loose pass fills in when that finds little. If D1 is not there (local dev, an
 * outage) the page falls back to the data set's Pagefind index in the browser.
 */
export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === "string" ? s.q : "", only: typeof s.only === "string" && s.only ? s.only : undefined }),
  loaderDeps: ({ search }) => ({ q: search.q, only: search.only }),
  loader: async ({ deps }) => {
    if (!deps.q.trim()) return { result: null as SearchResult | null };
    const result: SearchResult = await searchLibrary({ data: { q: deps.q, only: deps.only, limit: deps.only ? 300 : 8 } }).catch((e: unknown) => ({ ok: false as const, reason: String(e) }));
    return { result };
  },
  head: ({ match }) => pageHead([{ title: match.search.q ? `“${match.search.q}” · Search · CyberJudah` : "Search · CyberJudah" }], match),
  component: SearchPage,
});

const KINDS: [string, string][] = [["verse", "Scripture"], ["law", "Laws"], ["precept", "Precepts"], ["case", "Cases"], ["study", "Study notes"], ["class", "Classes"], ["captains", "15 Min w/Captains"], ["history", "Our Hidden History"], ["encyclopedia", "Encyclopedia"]];
type Hit = SearchHit;
type PfData = { url: string; excerpt: string; meta: { title?: string; kind?: string; sub?: string }; sub_results?: { title: string; url: string; excerpt: string; anchor?: { id: string } }[] };
type Pf = { options: (o: Record<string, unknown>) => Promise<void>; search: (q: string, o?: Record<string, unknown>) => Promise<{ results: { data: () => Promise<PfData> }[] }> };

const strip = (u: string) => u.replace(/^https?:\/\/[^/]+/, "").replace(/^\/cyberjudah/, "").replace(/\.html$/, "");

function SearchPage() {
  const { q, only } = Route.useSearch();
  const { result } = Route.useLoaderData();
  const navigate = useNavigate();
  const [input, setInput] = useState(q);
  const [fallback, setFallback] = useState<{ hits: Hit[]; counts: Record<string, number> } | null>(null);
  const [busy, setBusy] = useState(false);
  const pf = useRef<Pf | null>(null);
  useEffect(() => { setInput(q); }, [q]);

  // The browser fallback, only when the server could not search.
  const needFallback = !!q.trim() && (!result || !result.ok);
  useEffect(() => {
    if (!needFallback) { setFallback(null); return; }
    let live = true; setBusy(true);
    const LIMIT = only ? 300 : 8;
    (async () => {
      try {
        if (!pf.current) {
          const origin = await dataOrigin();
          const mod: Pf = await import(/* @vite-ignore */ `${origin}/pagefind/pagefind.js`);
          await mod.options({ baseUrl: "/" });
          pf.current = mod;
        }
        const kinds = only ? KINDS.filter(([k]) => k === only) : KINDS;
        const res = await Promise.all(kinds.map(([kind]) => pf.current!.search(q.trim(), { filters: { kind } })));
        if (!live) return;
        const counts: Record<string, number> = {}; const hits: Hit[] = [];
        for (let i = 0; i < kinds.length; i++) {
          const [kind] = kinds[i]; const r = res[i];
          if (!r.results.length) continue;
          counts[kind] = r.results.length;
          let rows = 0;
          for (const item of r.results) {
            if (rows >= LIMIT) break;
            const d = await item.data();
            const anchored = (d.sub_results ?? []).filter((s) => s.anchor?.id);
            if (anchored.length) { for (const s of anchored) { if (rows >= LIMIT) break; rows++; hits.push({ kind, title: s.title, url: strip(s.url), sub: "", snippet: s.excerpt }); } }
            else { rows++; hits.push({ kind, title: d.meta.title ?? d.url, url: strip(d.url), sub: d.meta.sub ?? "", snippet: d.excerpt }); }
          }
        }
        if (live) { setFallback({ hits, counts }); setBusy(false); }
      } catch { if (live) { setFallback({ hits: [], counts: {} }); setBusy(false); } }
    })();
    return () => { live = false; };
  }, [q, only, needFallback]);

  const go = (e: FormEvent) => { e.preventDefault(); navigate({ to: "/search", search: { q: input.trim(), only } }); };
  const serverOk = !!result && result.ok;
  const hits: Hit[] | null = serverOk ? result.hits : fallback?.hits ?? null;
  const counts: Record<string, number> = serverOk ? result.counts : fallback?.counts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const mode = serverOk ? result.mode : "strict";
  const excerptIsHtml = !serverOk; // Pagefind excerpts carry <mark> markup; D1 snippets are plain text

  return (
    <Page>
      <h1 className="cj-h1">Search.</h1>
      <form className="search-form" role="search" onSubmit={go} style={{ maxWidth: "48rem" }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder='A word, several words, or a "quoted phrase"' aria-label="Search the library" spellCheck={false} autoComplete="off" autoFocus />
        <button type="submit" className="search-go" aria-label="Search"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4.2-4.2" strokeLinecap="round" /></svg></button>
      </form>
      {!q && (
        <p className="cj-lede" style={{ marginTop: "1.5rem" }}>Every verse of the King James text with the Apocrypha, plus the study notes, class notes, encyclopedia, handbook of law, precepts and case studies. Several words find pages with all of them; quotation marks find the exact phrase. Spelling follows the King James text.</p>
      )}
      {busy && <p className="cj-mono" style={{ marginTop: "1.5rem" }} role="status">Searching the library</p>}
      {hits && !busy && (
        <div style={{ marginTop: "1.5rem" }}>
          <p className="cj-mono" role="status">
            {total} results{serverOk && result.ms ? ` · ${result.ms} ms` : ""}
            {mode === "loose" ? " · nothing has every word; showing pages with any of them" : mode === "mixed" ? " · pages with any of the words follow the exact matches" : ""}
          </p>
          {total === 0 && <p className="cj-lede">Nothing matches “{q}”. Try fewer words, or quotation marks for an exact phrase.</p>}
          {KINDS.filter(([k]) => hits.some((h) => h.kind === k)).map(([k, label]) => (
            <section key={k} className="book-block" style={{ marginTop: "2rem" }}>
              <h2>{label} <span className="cj-mono">{counts[k]}</span></h2>
              <ul className="list">
                {hits.filter((h) => h.kind === k).map((h, i) => (
                  <li key={i} className={h.loose ? "hit--loose" : undefined}>
                    <Link to={h.url as never}>
                      <span>
                        <span style={{ display: "block" }}>{h.title}{h.sub ? <span className="cj-mono" style={{ marginLeft: "0.6rem", color: "var(--color-muted)" }}>{h.sub}</span> : null}</span>
                        {excerptIsHtml
                          ? <span style={{ display: "block", color: "var(--color-muted)", fontSize: "0.92rem" }} dangerouslySetInnerHTML={{ __html: h.snippet }} />
                          : <span style={{ display: "block", color: "var(--color-muted)", fontSize: "0.92rem" }}>{h.snippet}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {!only && counts[k] > 8 && <p style={{ marginTop: "0.6rem" }}><Link to="/search" search={{ q, only: k }} className="read-link"><span>All {counts[k]} in {label.toLowerCase()}</span><span aria-hidden="true">→</span></Link></p>}
              {only && <p style={{ marginTop: "0.6rem" }}><Link to="/search" search={{ q, only: undefined }} className="read-link"><span>Every kind</span><span aria-hidden="true">→</span></Link></p>}
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}
