import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Page, Kicker, ReadLink } from "@/components/site/chrome";
import { api } from "@/lib/api";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/study/$book/")({
  loader: async ({ params }) => {
    const [notes, books] = await Promise.all([api.notes(), api.books()]);
    const book = books.find((b) => b.slug === params.book);
    if (!book) throw notFound();
    const list = notes.filter((n) => n.kind === "study" && n.book === book.book && n.chapters).sort((a, b) => a.chapters![0] - b.chapters![0]);
    return { book, list };
  },
  head: ({ loaderData, match }) => pageHead([{ title: loaderData ? `${loaderData.book.book} · 4 Chapters a Day · CyberJudah` : "4 Chapters a Day · CyberJudah" }], match),
  component: StudyBook,
});

function StudyBook() {
  const { book, list } = Route.useLoaderData();
  const covered = new Set(list.flatMap((n) => { const [a, b] = n.chapters!; return Array.from({ length: b - a + 1 }, (_, i) => a + i); }));
  return (
    <Page>
      <Kicker>4 Chapters a Day · {book.testament}</Kicker>
      <h1 className="cj-h1">{book.book}</h1>
      <p className="cj-lede">{covered.size} of {book.chapters} chapters taught so far.</p>
      <div className="chapters" style={{ marginBottom: "2rem" }}>
        {book.chapterIds.map((c) => covered.has(c)
          ? <Link key={c} to={`/study/${book.slug}/${c}` as never}>{c}</Link>
          : <Link key={c} to="/bible/$book/$chapter" params={{ book: book.slug, chapter: String(c) }} style={{ opacity: 0.4 }} title="Not taught yet; opens the chapter">{c}</Link>)}
      </div>
      <ul className="list">
        {list.map((n) => <li key={n.url}><Link to={n.url as never}><span>{n.title}</span><span className="cj-mono">{n.range}</span></Link></li>)}
      </ul>
      <p style={{ marginTop: "2rem" }}><ReadLink to="/study">All books</ReadLink></p>
    </Page>
  );
}
