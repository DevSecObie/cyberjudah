import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, Kicker } from "@/components/site/chrome";
import { api } from "@/lib/api";

export const Route = createFileRoute("/classes/by-book")({
  loader: async () => {
    const [rows, books] = await Promise.all([api.byBook(), api.books()]);
    return { rows, total: books.length };
  },
  head: () => ({ meta: [{ title: "Classes by Book · CyberJudah" }, { name: "description", content: "Which classes and episodes open which book, chapter by chapter." }] }),
  component: ByBook,
});

function ByBook() {
  const { rows, total } = Route.useLoaderData();
  const notes = new Set(rows.flatMap((r) => r.notes.map((n) => n.url))).size;
  const testaments = [...new Set(rows.map((r) => r.testament))];
  return (
    <Page>
      <Kicker>The concordance, read the other way</Kicker>
      <h1 className="cj-h1">Classes by Book.</h1>
      <p className="cj-lede">{notes} classes and episodes, {rows.length} of {total} books opened. Each row names the chapters a class read from; the <Link to="/concordance">concordance</Link> lists the same citations chapter by chapter.</p>
      <p className="alpha cj-mono">{rows.map((r) => <a key={r.slug} href={`#${r.slug}`}>{r.book}</a>)}</p>
      {testaments.map((t) => (
        <section key={t} className="book-block">
          <h2>{t}</h2>
          {rows.filter((r) => r.testament === t).map((r) => (
            <div key={r.slug} className="byb" id={r.slug}>
              <h3><Link to="/bible/$book" params={{ book: r.slug }}>{r.book}</Link> <span className="cj-mono byb__n">{r.notes.length}</span></h3>
              <ul className="cited-rows">
                {r.notes.map((n) => (
                  <li key={n.url}>
                    <Link to={n.url as never}>{n.label}</Link>
                    {n.kind === "captains" ? <span className="byb__kind cj-mono">15 min</span> : null}
                    <span className="cj-mono byb__chapters">{n.chapters.map((c, i) => <span key={c}>{i ? " · " : " "}<Link to="/bible/$book/$chapter" params={{ book: r.slug, chapter: String(c) }}>{c}</Link></span>)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </Page>
  );
}
