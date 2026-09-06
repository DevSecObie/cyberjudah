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
// Every kind build-search-index.mjs writes a `kind` filter for has to be listed here: the
// page searches once per entry and nothing else is ever queried, so an indexed kind that is
// missing from this list is silently unreachable. That is what happened to the captains
// episodes, which were indexed from the day they were added and never returned a result.
const KINDS: [string, string][] = [["verse", "Scripture"], ["law", "Laws"], ["precept", "Precepts"], ["case", "Cases"], ["study", "Study notes"], ["class", "Classes"], ["captains", "15 Minutes w/ The Captains"], ["encyclopedia", "Encyclopedia"]];
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
      // The eight kind searches are independent, so issue them together; they share the
      // same shard downloads and finish in roughly the time of the slowest one.
      const searches = await Promise.all(KINDS.map(([kind]) => pf.search(q.trim(), { filters: { kind } })));
      if (!live) return;
      for (let i = 0; i < KINDS.length; i++) {
        const [kind] = KINDS[i];
        const res = searches[i];
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
    <Layout title={q ? `\u201c${q}\u201d` : "Search"} description="Search the scripture, the notes, the law, the precepts and the cases">
      <main className="cj-search">
        <div className="cj-search-inner">
          <h1 className="cj-search-head">Search</h1>
          <form className="cj-search-form" onSubmit={(e) => { e.preventDefault(); go(input, only); }} role="search">
            <input
              className="cj-search-q"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={'a word, a "quoted phrase", or a reference like John 3:16'}
              aria-label="Search the site"
              spellCheck={false}
              autoComplete="off"
              autoFocus
            />
            <button className="button button--primary" type="submit">Search</button>
          </form>

          {/* Before the first query there is nothing to show and no reason to leave the page
              blank: these are the things people come here to look up. */}
          {!q && (
            <div className="cj-search-empty">
              <p>Every verse of the King James text with the Apocrypha, plus the study notes,
                 class notes, encyclopedia, handbook of law, precepts and case studies.</p>
              <p className="cj-search-egs">
                Try{" "}
                {["Passover", "\"a broken and a contrite heart\"", "usury", "Ezekiel 37"].map((eg, i) => (
                  <React.Fragment key={eg}>
                    {i > 0 && " \u00b7 "}
                    <button type="button" className="cj-eg" onClick={() => { setInput(eg); go(eg); }}>{eg}</button>
                  </React.Fragment>
                ))}
              </p>
            </div>
          )}

          {busy && <p className="cj-search-status" role="status">{"Searching\u2026"}</p>}

          {hits && !busy && (
            <>
              {/* Buttons, not anchors to "#". These change what is displayed; a screen reader
                  announcing them as links to nowhere was wrong, and they were unreachable by
                  keyboard in the way a control should be. */}
              <p className="cj-search-facets" role="status">
                <button type="button" className="cj-eg" data-on={!only || undefined} onClick={() => go(q)}>
                  all <i>{total}</i>
                </button>
                {KINDS.filter(([k]) => counts[k]).map(([k, l]) => (
                  <span key={k}>
                    {" \u00b7 "}
                    <button type="button" className="cj-eg" data-on={only === k || undefined} onClick={() => go(q, k)}>
                      {l} <i>{counts[k]}</i>
                    </button>
                  </span>
                ))}
              </p>

              {total === 0 && (
                <div className="cj-search-empty">
                  <p>{"Nothing matches \u201c"}{q}{"\u201d."}</p>
                  <p className="cj-search-egs">
                    Quotation marks match an exact phrase; without them every word is matched
                    separately. Spelling follows the King James text, so try
                    {" "}<button type="button" className="cj-eg" onClick={() => { setInput("shew"); go("shew"); }}>shew</button>
                    {" "}rather than "show".
                  </p>
                </div>
              )}

              {KINDS.filter(([k]) => hits.some((h) => h.kind === k)).map(([k, l]) => (
                <section key={k} className="cj-search-group">
                  <h2>{l} <small>{counts[k]}</small></h2>
                  <ul className="hits">{hits.filter((h) => h.kind === k).map((h, i) => (
                    <li key={i}>
                      <Link to={h.url}>{h.title}</Link>{" "}
                      <span dangerouslySetInnerHTML={{ __html: h.sub ?? h.excerpt }} />
                    </li>
                  ))}</ul>
                  {!only && counts[k] > PER_KIND && (
                    <p><button type="button" className="cj-eg" onClick={() => go(q, k)}>all {counts[k]} in {l.toLowerCase()}</button></p>
                  )}
                </section>
              ))}
            </>
          )}
        </div>
      </main>
    </Layout>
  );
}
