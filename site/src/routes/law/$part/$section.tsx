import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import { Page, Kicker, ReadLink } from "@/components/site/chrome";
import { RefCards } from "@/components/site/ref-card";
import { RefQuote, TaughtIn } from "@/components/site/ref-quote";
import { CiteLanding } from "@/components/site/return-bar";
import { api } from "@/lib/api";

export const Route = createFileRoute("/law/$part/$section")({
  loader: async ({ params }) => {
    const [section, parts] = await Promise.all([api.law(params.section).catch(() => null), api.laws()]);
    if (!section || section.url !== `/law/${params.part}/${params.section}`) throw notFound();
    const flat = parts.flatMap((p) => p.sections);
    const i = flat.findIndex((s) => s.id === section.id);
    return { section, prev: flat[i - 1] ?? null, next: flat[i + 1] ?? null };
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `${loaderData.section.id} ${loaderData.section.title} · The Law · CyberJudah` : "The Law · CyberJudah" }, { name: "description", content: loaderData ? `${loaderData.section.entries.length} laws on ${loaderData.section.title.toLowerCase()}, each with the scripture it rests on.` : "" }] }),
  component: SectionPage,
});

function SectionPage() {
  const { section, prev, next } = Route.useLoaderData();
  // A law id in the hash (#10A.1) scrolls to that law once the page is in.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const el = document.getElementById(id);
    if (el) { el.scrollIntoView({ block: "start" }); el.classList.add("law--target"); }
  }, [section.id]);
  return (
    <Page>
      <div className="note-head">
        <Kicker><Link to={section.part.url as never} style={{ color: "inherit" }}>Part {section.part.n}: {section.part.title}</Link></Kicker>
        <h1 className="cj-h1"><span className="cj-mono law-h1__id">{section.id}</span> {section.title}</h1>
        <p className="cj-lede" style={{ marginBottom: 0 }}>{section.entries.length} {section.entries.length === 1 ? "law" : "laws"}. Rest on any reference to read it, or open it for the full passage.</p>
        {section.seeAlso.length ? (
          <p className="cj-mono" style={{ marginTop: "0.9rem" }}>See also {section.seeAlso.map((s, i) => <span key={s.id}>{i ? ", " : ""}{s.url ? <Link to={s.url as never}>{s.id} {s.title}</Link> : s.id}</span>)}</p>
        ) : null}
      </div>
      <CiteLanding>
      <RefCards>
        <ol className="laws">
          {section.entries.map((e) => (
            <li key={e.id} className="law" id={e.id}>
              <a className="law__id cj-mono" href={`#${e.id}`}>{e.id}</a>
              <div className="law__body">
                <p className="law__text">{e.text}</p>
                {e.refs.map((r, i) => <RefQuote key={i} r={r} open={false} />)}
              </div>
            </li>
          ))}
        </ol>
      </RefCards>
      <TaughtIn refs={section.entries.flatMap((e) => e.refs)} />
      </CiteLanding>
      <div className="pager">
        {prev ? <Link to={prev.url as never} className="read-link"><span>{prev.id} {prev.title}</span><span aria-hidden="true">→</span></Link> : <ReadLink to="/law">The handbook</ReadLink>}
        {next ? <Link to={next.url as never} className="read-link"><span>{next.id} {next.title}</span><span aria-hidden="true">→</span></Link> : <ReadLink to="/law">The handbook</ReadLink>}
      </div>
    </Page>
  );
}
