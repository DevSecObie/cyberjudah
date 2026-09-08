import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, Kicker } from "@/components/site/chrome";
import { api } from "@/lib/api";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/law/")({
  loader: async () => {
    const [parts, stats] = await Promise.all([api.laws(), api.stats()]);
    return { parts, stats };
  },
  head: ({ match }) => pageHead([{ title: "The Law · CyberJudah" }, { name: "description", content: "The handbook of Bible law: every commandment, statute and judgment, in parts and sections, each with the scripture it rests on." }], match),
  component: LawIndex,
});

function LawIndex() {
  const { parts, stats } = Route.useLoaderData();
  return (
    <Page>
      <Kicker>The handbook</Kicker>
      <h1 className="cj-h1">The Law.</h1>
      <p className="cj-lede">{stats.laws} laws in {stats.sections} sections across {parts.length} parts, each one quoted from the scripture it rests on. Open a section to read every law in it with its verses in place.</p>
      <div className="law-parts">
        {parts.map((p) => (
          <section key={p.n} className="law-part" id={`part-${p.n}`}>
            <h2><Link to="/law/$part" params={{ part: p.url.split("/")[2] }}><span className="cj-mono law-part__n">Part {p.n}</span>{p.title}</Link></h2>
            <ul className="law-sections">
              {p.sections.map((s) => (
                <li key={s.id}>
                  <Link to={s.url as never}>
                    <span className="cj-mono law-sections__id">{s.id}</span>
                    <span className="law-sections__title">{s.title}</span>
                    <span className="cj-mono law-sections__n">{s.laws}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Page>
  );
}
