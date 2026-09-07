import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, ReadLink } from "@/components/site/chrome";
import { api, nf } from "@/lib/api";

export const Route = createFileRoute("/bible/")({
  loader: () => api.books(),
  head: () => ({ meta: [{ title: "The Bible · CyberJudah" }, { name: "description", content: "The King James text with the Apocrypha, 81 books, every chapter on its own page." }] }),
  component: BibleIndex,
});

function BibleIndex() {
  const books = Route.useLoaderData();
  const groups = ["Old Testament", "New Testament", "Apocrypha"].map((t) => ({ t, list: books.filter((b) => b.testament === t) })).filter((g) => g.list.length);
  return (
    <Page>
      <h1 className="cj-h1">The Bible.</h1>
      <p className="cj-lede">The King James text with the Apocrypha: {books.length} books, {nf.format(books.reduce((a, b) => a + b.verses, 0))} verses. Choose a book, then a chapter.</p>
      <p style={{ marginBottom: "2rem" }}><ReadLink to="/bible/genesis/1">Begin at Genesis 1</ReadLink></p>
      {groups.map((g) => (
        <section key={g.t} className="book-block">
          <h2>{g.t}</h2>
          <div className="books">
            {g.list.map((b) => (
              <Link key={b.slug} to="/bible/$book" params={{ book: b.slug }}>
                <span>{b.book}</span>
                <span className="cj-mono">{b.chapters}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </Page>
  );
}
