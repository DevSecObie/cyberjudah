import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Page, Kicker } from "@/components/site/chrome";
import { api } from "@/lib/api";
import { pageHead } from "@/lib/head";
import { DoctrineEmpty, loadDoctrine } from "./-shared";

export const Route = createFileRoute("/doctrine/")({
  loader: () => loadDoctrine(api.doctrine),
  head: ({ match }) => pageHead([{ title: "Doctrine · CyberJudah" }, { name: "description", content: "False doctrines answered from scripture and the classes." }], match),
  component: DoctrineIndex,
});

function DoctrineIndex() {
  const result = Route.useLoaderData();
  const [q, setQ] = useState("");
  const all = result.data;
  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...(all ?? [])].filter((p) => p.name.toLowerCase().includes(needle)).sort((a, b) => a.name.localeCompare(b.name));
  }, [all, q]);
  const letters = useMemo(() => {
    const grouped = new Map<string, typeof hits>();
    for (const p of hits) { const letter = p.name[0].toUpperCase(); grouped.set(letter, [...(grouped.get(letter) ?? []), p]); }
    return [...grouped.entries()];
  }, [hits]);
  return <Page>
    <Kicker>Doctrine</Kicker>
    <h1 className="cj-h1">Doctrine.</h1>
    <p className="cj-lede">False doctrines answered from scripture and the classes.</p>
    {result.error ? <DoctrineEmpty error={result.error} /> : <>
      <div className="filters"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a doctrine" aria-label="Find a doctrine" /><span className="cj-mono">{hits.length} of {all?.length ?? 0}</span></div>
      {!q ? <p className="alpha cj-mono">{letters.map(([letter]) => <a key={letter} href={`#${letter}`}>{letter}</a>)}</p> : null}
      {!hits.length ? <p className="study__empty">No doctrine found.</p> : null}
      {letters.map(([letter, list]) => <section key={letter} className="book-block" id={letter}>
        <h2>{letter}</h2>
        <ul className="list list--cols">{list.map((p) => <li key={p.slug}><Link to="/doctrine/$slug" params={{ slug: p.slug }}><span>{p.name}</span><span className="cj-mono">{p.refs}</span></Link></li>)}</ul>
      </section>)}
    </>}
  </Page>;
}
