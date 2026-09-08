import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Page, Kicker, ReadLink } from "@/components/site/chrome";
import { api } from "@/lib/api";

export const Route = createFileRoute("/law/$part/")({
  loader: async ({ params }) => {
    const parts = await api.laws();
    const i = parts.findIndex((p) => p.url === `/law/${params.part}`);
    if (i < 0) throw notFound();
    return { part: parts[i], prev: parts[i - 1] ?? null, next: parts[i + 1] ?? null };
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `Part ${loaderData.part.n}: ${loaderData.part.title} · The Law · CyberJudah` : "The Law · CyberJudah" }] }),
  component: PartPage,
});

function PartPage() {
  const { part, prev, next } = Route.useLoaderData();
  const laws = part.sections.reduce((a, s) => a + s.laws, 0);
  return (
    <Page>
      <Kicker>The Law · Part {part.n}</Kicker>
      <h1 className="cj-h1">{part.title}</h1>
      <p className="cj-lede">{part.sections.length} sections, {laws} laws.</p>
      <ul className="law-sections law-sections--page">
        {part.sections.map((s) => (
          <li key={s.id}>
            <Link to={s.url as never}>
              <span className="cj-mono law-sections__id">{s.id}</span>
              <span className="law-sections__title">{s.title}</span>
              <span className="cj-mono law-sections__n">{s.laws} {s.laws === 1 ? "law" : "laws"}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="pager">
        {prev ? <Link to={prev.url as never} className="read-link"><span>Part {prev.n}: {prev.title}</span><span aria-hidden="true">→</span></Link> : <ReadLink to="/law">All parts</ReadLink>}
        {next ? <Link to={next.url as never} className="read-link"><span>Part {next.n}: {next.title}</span><span aria-hidden="true">→</span></Link> : <ReadLink to="/law">All parts</ReadLink>}
      </div>
    </Page>
  );
}
