import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Page } from "@/components/site/chrome";
import { dataOrigin } from "@/lib/api";

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === "string" ? s.q : "", only: typeof s.only === "string" && s.only ? s.only : undefined }),
  head: ({ match }) => ({ meta: [{ title: match.search.q ? `“${match.search.q}” · Search · CyberJudah` : "Search · CyberJudah" }] }),
  component: SearchPage,
});

// The data set's Pagefind index is queried in the browser. Eight rows per kind on the
// overview; `only=<kind>` lists every hit of one kind.
const KINDS: [string, string][] = [["verse", "Scripture"], ["law", "Laws"], ["precept", "Precepts"], ["case", "Cases"], ["study", "Study notes"], ["class", "Classes"], ["captains", "The Captains"], ["encyclopedia", "Encyclopedia"]];
type Hit = { kind: string; title: string; url: string; excerpt: string };
type PfData = { url: string; excerpt: string; meta: { title?: string; kind?: string; sub?: string }; sub_results?: { title: string; url: string; excerpt: string; anchor?: { id: string } }[] };
type Pf = { options: (o: Record<string, unknown>) => Promise<void>; search: (q: string, o?: Record<string, unknown>) => Promise<{ results: { data: () => Promise<PfData> }[] }> };

const strip = (u: string) => u.replace(/^https?:\/\/[^/]+/, "").replace(/^\/cyberjudah/, "").replace(/\.html$/, "");

function SearchPage() {
  const { q, only } = Route.useSearch();
  const LIMIT = only ? 500 : 8;
  const navigate = useNavigate();
  const [input, setInput] = useState(q);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const pf = useRef<Pf | null>(null);
  useEffect(() => { setInput(q); }, [q]);
  useEffect(() => {
    if (!q.trim()) { setHits(null); return; }
    let live = true; setBusy(true);
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
        const c: Record<string, number> = {}; const out: Hit[] = [];
        for (let i = 0; i < kinds.length; i++) {
          const [kind] = kinds[i]; const r = res[i];
          if (!r.results.length) continue;
          c[kind] = r.results.length;
          let rows = 0;
          for (const item of r.results) {
            if (rows >= LIMIT) break;
            const d = await item.data();
            const anchored = (d.sub_results ?? []).filter((s) => s.anchor?.id);
            if (anchored.length) { for (const s of anchored) { if (rows >= LIMIT) break; rows++; out.push({ kind, title: s.title, url: s.url, excerpt: s.excerpt }); } }
            else { rows++; out.push({ kind, title: d.meta.title ?? d.url, url: d.url, excerpt: d.meta.sub ?? d.excerpt }); }
          }
        }
        if (live) { setHits(out); setCounts(c); setBusy(false); }
      } catch { if (live) { setHits([]); setCounts({}); setBusy(false); } }
    })();
    return () => { live = false; };
  }, [q, only]);
  const go = (e: FormEvent) => { e.preventDefault(); navigate({ to: "/search", search: { q: input.trim(), only } }); };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <Page>
      <h1 className="cj-h1">Search.</h1>
      <form className="search-form" role="search" onSubmit={go} style={{ maxWidth: "48rem" }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="A word, a quoted phrase, or a reference like John 3:16" aria-label="Search the library" spellCheck={false} autoComplete="off" autoFocus />
        <button type="submit" className="search-go" aria-label="Search"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4.2-4.2" strokeLinecap="round" /></svg></button>
      </form>
      {!q && (
        <p className="cj-lede" style={{ marginTop: "1.5rem" }}>Every verse of the King James text with the Apocrypha, plus the study notes, class notes, encyclopedia, handbook of law, precepts and case studies. Spelling follows the King James text.</p>
      )}
      {busy && <p className="cj-mono" style={{ marginTop: "1.5rem" }} role="status">Searching the library</p>}
      {hits && !busy && (
        <div style={{ marginTop: "1.5rem" }}>
          <p className="cj-mono" role="status">{total} results</p>
          {total === 0 && <p className="cj-lede">Nothing matches “{q}”. Quotation marks match an exact phrase; without them every word is matched separately.</p>}
          {KINDS.filter(([k]) => hits.some((h) => h.kind === k)).map(([k, label]) => (
            <section key={k} className="book-block" style={{ marginTop: "2rem" }}>
              <h2>{label} <span className="cj-mono">{counts[k]}</span></h2>
              <ul className="list">
                {hits.filter((h) => h.kind === k).map((h, i) => {
                  const path = strip(h.url);
                  return (
                    <li key={i}>
                      <Link to={path as never}><span><span style={{ display: "block" }}>{h.title}</span><span style={{ display: "block", color: "var(--color-muted)", fontSize: "0.92rem" }} dangerouslySetInnerHTML={{ __html: h.excerpt }} /></span></Link>
                    </li>
                  );
                })}
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
