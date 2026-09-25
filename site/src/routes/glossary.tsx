import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Page, Kicker } from "@/components/site/chrome";
import { api, type GlossaryEntry } from "@/lib/api";
import { clock } from "@/lib/teaching-refs";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/glossary")({
  loader: () => api.glossary(),
  head: ({ match }) => pageHead([{ title: "Glossary · CyberJudah" }, { name: "description", content: "The words the classes use, defined from the teachings and the King James text, with the moments they are taught." }], match),
  component: GlossaryPage,
});

const matches = (e: GlossaryEntry, q: string) =>
  e.term.toLowerCase().includes(q) || e.aliases.some((a) => a.toLowerCase().includes(q)) || e.definition.toLowerCase().includes(q);

function GlossaryPage() {
  const { about, entries } = Route.useLoaderData();
  const [q, setQ] = useState("");
  const hits = useMemo(() => { const lc = q.trim().toLowerCase(); return lc ? entries.filter((e) => matches(e, lc)) : entries; }, [entries, q]);
  const letters = useMemo(() => {
    const m = new Map<string, GlossaryEntry[]>();
    for (const e of hits) { const l = /[a-z]/i.test(e.term[0]) ? e.term[0].toUpperCase() : "#"; m.set(l, [...(m.get(l) ?? []), e]); }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [hits]);
  return (
    <Page>
      <Kicker>Words of the teaching</Kicker>
      <h1 className="cj-h1">Glossary.</h1>
      <p className="cj-lede">{about || "The words the classes use, defined from the teachings and the King James text, with the moments they are taught."}</p>
      {entries.length === 0 ? <p className="study__empty">The glossary is being written. <Link to="/dictionary">The dictionary</Link> defines the Bible's own words in the meantime.</p> : (
        <>
          <div className="filters">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a word" aria-label="Find a word" />
            <span className="cj-mono">{hits.length} of {entries.length}</span>
          </div>
          {!q ? <p className="alpha cj-mono">{letters.map(([l]) => <a key={l} href={`#letter-${l}`}>{l}</a>)}</p> : null}
          {letters.map(([l, list]) => (
            <section key={l} className="book-block" id={`letter-${l}`}>
              <h2>{l}</h2>
              <dl className="glossary">
                {list.map((e) => <Entry key={e.slug} e={e} />)}
              </dl>
            </section>
          ))}
        </>
      )}
    </Page>
  );
}

function Entry({ e }: { e: GlossaryEntry }) {
  return (
    <div className="glossary__entry" id={e.slug}>
      <dt>
        <a href={`#${e.slug}`} className="glossary__term">{e.term}</a>
        {e.aliases.length ? <span className="glossary__aliases">also {e.aliases.join(", ")}</span> : null}
      </dt>
      <dd>
        <p>{e.definition}</p>
        {e.scripture.length ? (
          <p className="glossary__refs"><span className="cj-mono">Scripture</span> {e.scripture.map((s, i) => <span key={s.label}>{i ? " · " : ""}<Link to={s.url as never}>{s.label}</Link></span>)}</p>
        ) : null}
        {e.see.length ? (
          <p className="glossary__refs"><span className="cj-mono">See</span> {e.see.map((s, i) => <span key={s.url}>{i ? " · " : ""}<Link to={s.url as never}>{s.title}</Link></span>)}</p>
        ) : null}
        {e.taught.length ? (
          <p className="taught__moments">
            <span className="cj-mono">Taught</span>
            {e.taught.map((t) => (
              <a key={`${t.video}@${t.seconds}`} className="chip" href={t.url} target="_blank" rel="noreferrer" title={t.title} aria-label={`${t.title} at ${clock(t.seconds)}`}>
                {t.title.length > 34 ? `${t.title.slice(0, 32)}…` : t.title} · {clock(t.seconds)}
              </a>
            ))}
          </p>
        ) : null}
      </dd>
    </div>
  );
}
