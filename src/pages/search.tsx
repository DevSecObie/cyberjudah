import React, { useEffect, useMemo, useState } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import { useLocation, useHistory } from "@docusaurus/router";

type Hit = { kind: string; title: string; snippet: string; url: string };
type Note = { kind: string; title: string; url: string; text: string };
const KINDS: [string, string][] = [["verse", "Scripture"], ["law", "Laws"], ["precept", "Precepts"], ["case", "Cases"], ["study", "Study notes"], ["class", "Classes"], ["encyclopedia", "Encyclopedia"]];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function snippet(text: string, q: string, width = 200) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text.slice(0, width) + (text.length > width ? "…" : "");
  const a = Math.max(0, i - Math.floor(width / 3)), b = Math.min(text.length, i + q.length + Math.floor((width * 2) / 3));
  return (a ? "…" : "") + text.slice(a, b) + (b < text.length ? "…" : "");
}
function Highlight({ text, q }: { text: string; q: string }) {
  const re = useMemo(() => new RegExp(`(${esc(q.trim())})`, "ig"), [q]);
  return <>{text.split(re).map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}</>;
}
const cache: Record<string, Promise<unknown>> = {};
const load = <T,>(url: string): Promise<T> => (cache[url] ??= fetch(url).then((r) => r.json())) as Promise<T>;

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
  useEffect(() => { setInput(q); }, [q]);
  useEffect(() => {
    if (!q.trim()) { setHits(null); return; }
    let live = true; setBusy(true);
    (async () => {
      const lc = q.trim().toLowerCase(); const re = new RegExp(`\\b${esc(lc)}`, "i");
      const out: Hit[] = []; const c: Record<string, number> = {};
      const limit = only ? 500 : 12;
      const push = (h: Hit) => { c[h.kind] = (c[h.kind] ?? 0) + 1; if (c[h.kind] <= limit) out.push(h); };
      const want = (k: string) => !only || only === k;
      if (want("law")) for (const l of await load<{ id: string; text: string; url: string }[]>(u("/search/laws.json"))) if (re.test(l.text)) push({ kind: "law", title: l.id, snippet: l.text, url: l.url });
      if (want("precept")) for (const t of await load<{ title: string; url: string; n: number }[]>(u("/search/precepts.json"))) if (t.title.toLowerCase().includes(lc)) push({ kind: "precept", title: t.title, snippet: `${t.n} verses`, url: t.url });
      if (want("case")) for (const x of await load<{ name: string; url: string; text: string }[]>(u("/search/cases.json"))) if (re.test(`${x.name} ${x.text}`)) push({ kind: "case", title: x.name, snippet: snippet(x.text, q), url: x.url });
      if (want("verse") && lc.length >= 3) {
        const books = await load<{ book: string; slug: string }[]>(u("/search/books.json"));
        for (const [b, ch, v, t] of await load<[number, number, number, string][]>(u("/search/verses.json"))) if (re.test(t)) push({ kind: "verse", title: `${books[b - 1].book} ${ch}:${v}`, snippet: snippet(t, q, 240), url: `/bible/${books[b - 1].slug}/${ch}#v${v}` });
      }
      if ((want("study") || want("class") || want("encyclopedia")) && lc.length >= 3)
        for (const n of await load<Note[]>(u("/search/notes.json"))) if (want(n.kind) && (n.title.toLowerCase().includes(lc) || re.test(n.text))) push({ kind: n.kind, title: n.title, snippet: snippet(n.text, q), url: n.url });
      if (live) { setHits(out); setCounts(c); setBusy(false); }
    })();
    return () => { live = false; };
  }, [q, only]);
  const go = (nq: string, nonly = "") => history.push(`${u("/search")}?q=${encodeURIComponent(nq)}${nonly ? "&only=" + nonly : ""}`);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <Layout title={q ? `“${q}”` : "Search"}>
      <main className="container margin-vert--lg">
        <form onSubmit={(e) => { e.preventDefault(); go(input); }} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="a word, a phrase, or a reference" style={{ flex: 1, fontSize: 18, padding: "8px 12px" }} autoFocus />
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
                <ul className="hits">{hits.filter((h) => h.kind === k).map((h, i) => <li key={i}><Link to={h.url}>{h.title}</Link> <span><Highlight text={h.snippet} q={q} /></span></li>)}</ul>
                {!only && counts[k] > 12 && <p><a href="#" onClick={(e) => { e.preventDefault(); go(q, k); }}>all {counts[k]} in {l.toLowerCase()}</a></p>}
              </section>
            ))}
          </>
        )}
      </main>
    </Layout>
  );
}
