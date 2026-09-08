import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Page, Kicker } from "@/components/site/chrome";
import { api } from "@/lib/api";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/precepts/")({
  loader: () => api.precepts(),
  head: ({ match }) => pageHead([{ title: "Precepts · CyberJudah" }, { name: "description", content: "The precept index: every subject scripture speaks to, A to Z, with the passages that teach it." }], match),
  component: PreceptsIndex,
});

function PreceptsIndex() {
  const all = Route.useLoaderData();
  const [q, setQ] = useState("");
  const hits = useMemo(() => { const lc = q.trim().toLowerCase(); return lc ? all.filter((p) => p.title.toLowerCase().includes(lc)) : all; }, [all, q]);
  const letters = useMemo(() => {
    const m = new Map<string, typeof all>();
    for (const p of hits) { const l = p.title[0].toUpperCase(); m.set(l, [...(m.get(l) ?? []), p]); }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [hits]);
  const refs = all.reduce((a, p) => a + p.refs, 0);
  return (
    <Page>
      <Kicker>Precept upon precept</Kicker>
      <h1 className="cj-h1">Precepts.</h1>
      <p className="cj-lede">{all.length} subjects, {refs} passages. Line upon line: each precept gathers every place scripture speaks to it, quoted in full.</p>
      <div className="filters">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a precept" aria-label="Find a precept" />
        <span className="cj-mono">{hits.length} of {all.length}</span>
      </div>
      {!q ? <p className="alpha cj-mono">{letters.map(([l]) => <a key={l} href={`#${l}`}>{l}</a>)}</p> : null}
      {letters.map(([l, list]) => (
        <section key={l} className="book-block" id={l}>
          <h2>{l}</h2>
          <ul className="list list--cols">
            {list.map((p) => <li key={p.slug}><Link to="/precepts/$slug" params={{ slug: p.slug }}><span>{p.title}</span><span className="cj-mono">{p.refs}</span></Link></li>)}
          </ul>
        </section>
      ))}
    </Page>
  );
}
