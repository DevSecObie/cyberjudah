import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Page, ReadLink } from "@/components/site/chrome";
import { RefCards } from "@/components/site/ref-card";
import { RefQuote } from "@/components/site/ref-quote";
import { api } from "@/lib/api";

const VERDICT: Record<string, string> = { death: "Put to death", plague: "Plague", exile: "Exile", captivity: "Captivity", curse: "Cursed", restitution: "Restitution", spared: "Spared", reprieve: "Reprieve", temporal: "Temporal judgment", unrecorded: "Sentence not recorded", blessed: "Kept the law" };

export const Route = createFileRoute("/cases/$era/$slug")({
  loader: async ({ params }) => {
    const c = await api.case(params.slug).catch(() => null);
    if (!c) throw notFound();
    return { c };
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `${loaderData.c.name} · Case Studies · CyberJudah` : "CyberJudah" }, { name: "description", content: loaderData?.c.charge ?? "" }] }),
  component: CasePage,
});

function CasePage() {
  const { c } = Route.useLoaderData();
  const blessing = c.kind === "blessing";
  const refs = c.refsResolved ?? [];
  const laws = c.lawsResolved ?? c.laws.map((id) => ({ id, text: "", url: null }));
  const precepts = c.preceptsResolved ?? c.topics.map((slug) => ({ slug, title: slug.replace(/-/g, " "), url: `/precepts/${slug}` }));
  return (
    <Page>
      <div className="note-head">
        <p className="cj-kicker">{c.era}</p>
        <h1 className="cj-h1">{c.name}</h1>
        <div className="case-meta">
          <span className={`verdict verdict--${c.verdict}`}>{c.verdictLabel ?? VERDICT[c.verdict] ?? c.verdict}</span>
          <span style={{ color: "var(--color-muted)" }}>{c.charge}</span>
        </div>
      </div>
      <RefCards>
        <div className="note">
          <p>{c.summary}</p>
          <h2>{blessing ? "The obedience" : "The offense"}</h2>
          <p>{c.offense}</p>
          <h2>{blessing ? "The blessing" : "The judgment"}</h2>
          <p>{c.judgment}</p>
          <h2>Scripture</h2>
          <div className="refqs">{refs.map((r, i) => <RefQuote key={i} r={r} />)}</div>
          <h2>{blessing ? "Laws kept" : "Laws broken"}</h2>
          <ul className="law-refs">
            {laws.map((l) => <li key={l.id}>{l.url ? <Link to={l.url as never}><span className="cj-mono">{l.id}</span></Link> : <span className="cj-mono">{l.id}</span>}{l.text ? <span> {l.text}</span> : null}</li>)}
          </ul>
          {precepts.length ? (
            <>
              <h2>Precepts</h2>
              <p className="chips">{precepts.map((p) => p.url ? <Link key={p.slug} to={p.url as never} className="chip">{p.title}</Link> : <span key={p.slug} className="chip">{p.title}</span>)}</p>
            </>
          ) : null}
          {c.related?.length ? (
            <>
              <h2>Related cases</h2>
              <ul>{c.related.map((o) => <li key={o.slug}><Link to={o.url as never}>{o.name}</Link>: {o.charge}</li>)}</ul>
            </>
          ) : null}
          {c.taught?.length ? (
            <>
              <h2>Taught in</h2>
              <ul>{c.taught.map((t) => <li key={t.url}><Link to={t.url as never}>{t.range} · {t.title}</Link></li>)}</ul>
            </>
          ) : null}
          {c.see?.length ? (
            <>
              <h2>See also</h2>
              <ul>{c.see.map((t) => <li key={t.url}><Link to={t.url as never}>{t.title}</Link> (Encyclopedia)</li>)}</ul>
            </>
          ) : null}
          {c.themes?.length ? <p className="chips" style={{ marginTop: "2rem" }}>{c.themes.map((t) => <Link key={t} to="/topics/$slug" params={{ slug: t }} className="chip">{t.replace(/-/g, " ")}</Link>)}</p> : null}
        </div>
      </RefCards>
      <p style={{ marginTop: "3rem" }}><ReadLink to="/cases">All cases</ReadLink></p>
    </Page>
  );
}
