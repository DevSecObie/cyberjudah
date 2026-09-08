import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, Kicker, ReadLink } from "@/components/site/chrome";
import { api, nf } from "@/lib/api";

export const Route = createFileRoute("/concordance/")({
  loader: async () => {
    const [rows, stats] = await Promise.all([api.concordanceIndex(), api.stats()]);
    return { rows, stats };
  },
  head: () => ({ meta: [{ title: "Concordance · CyberJudah" }, { name: "description", content: "Chapter by chapter, everything in the library that cites it: notes, classes, encyclopedia, cases, precepts and laws." }] }),
  component: ConcordanceIndex,
});

function ConcordanceIndex() {
  const { rows, stats } = Route.useLoaderData();
  const testaments = [...new Set(rows.map((r) => r.testament))];
  const citations = rows.reduce((a, r) => a + r.citations, 0);
  return (
    <Page>
      <Kicker>Who cites what</Kicker>
      <h1 className="cj-h1">Concordance.</h1>
      <p className="cj-lede">{nf.format(citations)} citations into {nf.format(stats.citedChapters)} of {nf.format(stats.chapters)} chapters. Every chapter lists the notes, classes, encyclopedia entries, cases, precepts and laws that cite it. <Link to="/classes/by-book">Classes by book</Link> reads the same graph the other way.</p>
      {testaments.map((t) => (
        <section key={t} className="book-block">
          <h2>{t}</h2>
          <ul className="list list--cols">
            {rows.filter((r) => r.testament === t).map((r) => (
              <li key={r.slug}>
                <Link to="/concordance/$book" params={{ book: r.slug }}>
                  <span>{r.book}</span>
                  <span className="cj-mono">{r.cited.length ? `${r.cited.length} of ${r.chapters}` : "none"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p style={{ marginTop: "2rem" }}><ReadLink to="/bible">Read the Bible</ReadLink></p>
    </Page>
  );
}
