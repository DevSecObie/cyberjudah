import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Page, ReadLink } from "@/components/site/chrome";
import { api, nf } from "@/lib/api";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/bible/$book/")({
  loader: async ({ params }) => {
    const books = await api.books();
    const book = books.find((b) => b.slug === params.book);
    if (!book) throw notFound();
    return { book };
  },
  head: ({ loaderData, match }) => pageHead([{ title: `${loaderData?.book.book ?? "Book"} · CyberJudah` }], match),
  component: BookPage,
});

function BookPage() {
  const { book } = Route.useLoaderData();
  return (
    <Page>
      <p className="cj-kicker">{book.testament}</p>
      <h1 className="cj-h1">{book.book}</h1>
      <p className="cj-lede">{book.chapters} chapters, {nf.format(book.verses)} verses.</p>
      <div className="chapters" style={{ marginBottom: "2rem" }}>
        {book.chapterIds.map((c) => (
          <Link key={c} to="/bible/$book/$chapter" params={{ book: book.slug, chapter: String(c) }}>{c}</Link>
        ))}
      </div>
      <ReadLink to="/bible">All books</ReadLink>
    </Page>
  );
}
