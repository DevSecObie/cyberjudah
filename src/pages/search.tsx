import React, { useEffect, useRef, useState } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import { useLocation, useHistory } from "@docusaurus/router";

// Search over the sharded Pagefind index built by scripts/build-search-index.mjs.
// The browser downloads only the shards a query touches (a few hundred KB), not the
// whole corpus; the previous flat-JSON scan pulled 20 MB on the first unfiltered query.
// Scripture and law records are chapter/section fragments whose verse-level anchors come
// back as sub-results, so hits still land on the exact verse.

type Hit = { kind: string; title: string; url: string; excerpt: string; sub?: string };
const KINDS: [string, string][] = [["verse", "Scripture"], ["law", "Laws"], ["precept", "Precepts"], ["case", "Cases"], ["study", "Study notes"], ["class", "Classes"], ["encyclopedia", "Encyclopedia"]];
const PER_KIND = 12;      // rows shown per kind on the "all" view
const ONLY_LIMIT = 200;   // rows shown when a single kind is selected

type PfSub = { title: string; url: string; excerpt: string; anchor?: { id: string } };
type PfData = { url: string; excerpt: string; meta: { title?: string; kind?: string; sub?: string }; sub_results?: PfSub[] };
type PfResult = { id: string; data: () => Promise<PfData> };
type PfResponse = { results: PfResult[]; filters?: { kind?: Record<string, number> }; totalFilters?: { kind?: Record<string, number> } };
type Pf = {
  options: (o: Record<string, unknown>) => Promise<void>;
  search: (q: string, o?: Record<string, unknown>) => Promise<PfResponse>;
};
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default function Search() {
  const loc = useLocation(); const history = useHistory();
  const params = new URLSearchParams(loc.search);
  const q = params.get("q") ?? ""; const only = params.get("only") ?? "";
  const [input, setInput] = useState(q);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const base = useBaseUrl("/");
  const u = (p: string) => base.replace(/\/$/, "") + p;
  const pfRef = useRef<Pf | null>(null);

  useEffect(() => { setInput(q); }, [q]);
  useEffect(() => {
    if (!q.trim()) { setHits(null); return; }
    let live = true; setBusy(true);
    (async () => {
      if (!pfRef.current) {
        // Served from static/pagefind; imported at runtime, invisible to the bundler.
        const pf: Pf = await import(/* webpackIgnore: true */ `${base}pagefind/pagefind.js`);
        await pf.options({ baseUrl: base });
        pfRef.current = pf;
      }
      const pf = pfRef.current;
      // One filtered search per kind: result counts come from results.length with no
      // fragment fetched, and a section stops fetching fragments the moment it has its
      // rows. A chapter fragment carries all of its matching verses as sub-results, so
      // one fetch often fills several rows.
      const cap = only ? ONLY_LIMIT : PER_KIND;
      const c: Record<string, number> = {};
      const out: Hit[] = [];
      for (const [kind] of KINDS) {
        const res = await pf.search(q.trim(), { filters: { kind } });
        if (!live) return;
        if (!res.results.length) continue;
        c[kind] = res.results.length;
        if (only && kind !== only) continue;
        let rows = 0;
        for (const r of res.results) {
          if (!live) return;
          if (rows >= cap) break;
          const d = await r.data();
          const anchored = (d.sub_results ?? []).filter((s) => s.anchor?.id);
          if (anchored.length) {
            for (const s of anchored) {
              if (rows >= cap) break;
              rows++;
              // The anchor heading repeats the row title; keep the excerpt to the text.
              out.push({ kind, title: s.title, url: s.url, excerpt: s.excerpt.replace(new RegExp(`^\\s*(<mark>)?${escRe(s.title)}(</mark>)?\\.?\\s*`), "") });
            }
          } else {
            rows++;
            out.push({ kind, title: d.meta.title ?? d.url, url: d.url, excerpt: d.excerpt, sub: d.meta.sub });
          }
        }
      }
      if (live) { setHits(out); setCounts(c); setBusy(false); }
    })().catch(() => { if (live) { setHits([]); setCounts({}); setBusy(false); } });
    return () => { live = false; };
  }, [q, only, base]);

  const go = (nq: string, nonly = "") => history.push(`${u("/search")}?q=${encodeURIComponent(nq)}${nonly ? "&only=" + nonly : ""}`);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <Layout title={q ? `“${q}”` : "Search"}>
      <main className="container margin-vert--lg">
        <form onSubmit={(e) => { e.preventDefault(); go(input, only); }} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={'a word, a "quoted phrase", or a reference'} style={{ flex: 1, fontSize: 18, padding: "8px 12px" }} autoFocus />
          <button className="button button--primary" type="submit">Search</button>
        </form>
        {busy && <p>Searching…</p>}
        {hits && !busy && (
          <>
            <p>
              <a href="#" onClick={(e) => { e.preventDefault(); go(q); }} style={{ fontWeight: !only ? 700 : 400 }}>all {total}</a>
              {KINDS.filter(([k]) => counts[k]).map(([k, l]) => <span key={k}> · <a href="#" onClick={(e) => { e.preventDefault(); go(q, k); }} style={{ fontWeight: only === k ? 700 : 400 }}>{l} {counts[k]}</a></span>)}
            </p>
            {total === 0 && <p>Nothing matches.</p>}
            {KINDS.filter(([k]) => hits.some((h) => h.kind === k)).map(([k, l]) => (
              <section key={k}>
                <h2>{l} <small>{counts[k]}</small></h2>
                <ul className="hits">{hits.filter((h) => h.kind === k).map((h, i) => (
                  <li key={i}>
                    <Link to={h.url}>{h.title}</Link>{" "}
                    <span dangerouslySetInnerHTML={{ __html: h.sub ?? h.excerpt }} />
                  </li>
                ))}</ul>
                {!only && counts[k] > PER_KIND && <p><a href="#" onClick={(e) => { e.preventDefault(); go(q, k); }}>all {counts[k]} in {l.toLowerCase()}</a></p>}
              </section>
            ))}
          </>
        )}
      </main>
    </Layout>
  );
}
