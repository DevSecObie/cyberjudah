import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Page, Kicker, ReadLink } from "@/components/site/chrome";
import { RefCards } from "@/components/site/ref-card";
import { RefQuote } from "@/components/site/ref-quote";
import { CiteLanding } from "@/components/site/return-bar";
import { api } from "@/lib/api";

export const Route = createFileRoute("/precepts/$slug")({
  loader: async ({ params }) => {
    const [p, all] = await Promise.all([api.precept(params.slug).catch(() => null), api.precepts()]);
    if (!p) throw notFound();
    const i = all.findIndex((x) => x.slug === p.slug);
    return { p, prev: all[i - 1] ?? null, next: all[i + 1] ?? null };
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `${loaderData.p.title} · Precepts · CyberJudah` : "Precepts · CyberJudah" }, { name: "description", content: loaderData ? `${loaderData.p.refs.length} passages on ${loaderData.p.title.toLowerCase()}, quoted in full.` : "" }] }),
  component: PreceptPage,
});

function PreceptPage() {
  const { p, prev, next } = Route.useLoaderData();
  const key = p.refs.filter((r) => r.key);
  const books = [...new Set(p.refs.map((r) => r.book))];
  return (
    <Page>
      <div className="note-head">
        <Kicker>Precept</Kicker>
        <h1 className="cj-h1">{p.title}</h1>
        <p className="cj-lede" style={{ marginBottom: 0 }}>{p.refs.length} {p.refs.length === 1 ? "passage" : "passages"} across {books.length} {books.length === 1 ? "book" : "books"}{key.length ? `, ${key.length} key` : ""}.</p>
        {books.length > 1 ? <p className="cj-mono" style={{ marginTop: "0.9rem" }}>{books.join(" · ")}</p> : null}
      </div>
      <CiteLanding>
        <RefCards>
          <div className="refqs">
            {p.refs.map((r, i) => <RefQuote key={i} r={r} />)}
          </div>
        </RefCards>
      </CiteLanding>
      <div className="pager">
        {prev ? <Link to="/precepts/$slug" params={{ slug: prev.slug }} className="read-link"><span>{prev.title}</span><span aria-hidden="true">→</span></Link> : <ReadLink to="/precepts">All precepts</ReadLink>}
        {next ? <Link to="/precepts/$slug" params={{ slug: next.slug }} className="read-link"><span>{next.title}</span><span aria-hidden="true">→</span></Link> : <ReadLink to="/precepts">All precepts</ReadLink>}
      </div>
    </Page>
  );
}
