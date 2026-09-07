import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Page, ReadLink } from "@/components/site/chrome";

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === "string" ? s.q : "" }),
  head: ({ match }) => ({ meta: [{ title: match.search.q ? `“${match.search.q}” · Search · CyberJudah` : "Search · CyberJudah" }] }),
  component: SearchPage,
});

// The publication's Pagefind index is queried in the browser; kinds this site hosts link here,
// the rest link to the publication.
const REMOTE = "https://devsecobie.github.io/cyberjudah";
const KINDS: [string, string][] = [["verse", "Scripture"], ["law", "Laws"], ["precept", "Precepts"], ["case", "Cases"], ["study", "Study notes"], ["class", "Classes"], ["captains", "The Captains"], ["encyclopedia", "Encyclopedia"]];
const LOCAL = ["/bible/", "/study/", "/classes/", "/captains/", "/cases/"];
type Hit = { kind: string; title: string; url: string; excerpt: string };
type PfData = { url: string; excerpt: string; meta: { title?: string; kind?: string; sub?: string }; sub_results?: { title: string; url: string; excerpt: string; anchor?: { id: string } }[] };
type Pf = { options: (o: Record<string, unknown>) => Promise<void>; search: (q: string, o?: Record<string, unknown>) => Promise<{ results: { data: () => Promise<PfData> }[] }> };

const strip = (u: string) => u.replace(/^https?:\/\/[^/]+/, "").replace(/^\/cyberjudah/, "").replace(/\.html$/, "");

function SearchPage() {
  const { q } = Route.useSearch();
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
          const mod: Pf = await import(/* @vite-ignore */ `${REMOTE}/pagefind/pagefind.js`);
          await mod.options({ baseUrl: `${REMOTE}/` });
          pf.current = mod;
        }
        const res = await Promise.all(KINDS.map(([kind]) => pf.current!.search(q.trim(), { filters: { kind } })));
        if (!live) return;
        const c: Record<string, number> = {}; const out: Hit[] = [];
        for (let i = 0; i < KINDS.length; i++) {
          const [kind] = KINDS[i]; const r = res[i];
          if (!r.results.length) continue;
          c[kind] = r.results.length;
          let rows = 0;
          for (const item of r.results) {
            if (rows >= 8) break;
            const d = await item.data();
            const anchored = (d.sub_results ?? []).filter((s) => s.anchor?.id);
            if (anchored.length) { for (const s of anchored) { if (rows >= 8) break; rows++; out.push({ kind, title: s.title, url: s.url, excerpt: s.excerpt }); } }
            else { rows++; out.push({ kind, title: d.meta.title ?? d.url, url: d.url, excerpt: d.meta.sub ?? d.excerpt }); }
          }
        }
        if (live) { setHits(out); setCounts(c); setBusy(false); }
      } catch { if (live) { setHits([]); setCounts({}); setBusy(false); } }
    })();
    return () => { live = false; };
  }, [q]);
  const go = (e: FormEvent) => { e.preventDefault(); navigate({ to: "/search", search: { q: input.trim() } }); };
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
                  const local = LOCAL.some((p) => path.startsWith(p));
                  return (
                    <li key={i}>
                      {local ? <Link to={path as never}><span><span style={{ display: "block" }}>{h.title}</span><span style={{ display: "block", color: "var(--color-muted)", fontSize: "0.92rem" }} dangerouslySetInnerHTML={{ __html: h.excerpt }} /></span></Link>
                        : <a href={`${REMOTE}${path}`} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: "0.75rem 0", textDecoration: "none" }}><span><span style={{ display: "block" }}>{h.title}</span><span style={{ display: "block", color: "var(--color-muted)", fontSize: "0.92rem" }} dangerouslySetInnerHTML={{ __html: h.excerpt }} /></span></a>}
                    </li>
                  );
                })}
              </ul>
              {counts[k] > 8 && <p style={{ marginTop: "0.6rem" }}><ReadLink href={`${REMOTE}/search?q=${encodeURIComponent(q)}&only=${k}`}>All {counts[k]} in {label.toLowerCase()}</ReadLink></p>}
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}
