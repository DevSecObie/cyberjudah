import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { SiteNav, SiteFooter } from "@/components/site/chrome";
import { api, type Citation } from "@/lib/api";

export const Route = createFileRoute("/bible/$book/$chapter")({
  loader: async ({ params }) => {
    const ch = Number(params.chapter);
    if (!Number.isInteger(ch) || ch < 1) throw notFound();
    const books = await api.books();
    const book = books.find((b) => b.slug === params.book);
    if (!book || !book.chapterIds.includes(ch)) throw notFound();
    const [chapter, concordance] = await Promise.all([
      api.chapter(book.slug, ch),
      api.concordance(book.slug, ch).catch(() => ({ cited_by: [] as Citation[] })),
    ]);
    return { books, book, chapter, cited: concordance.cited_by };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.book.book} ${loaderData.chapter.chapter} · CyberJudah` : "CyberJudah" },
      { name: "description", content: loaderData ? `${loaderData.book.book} ${loaderData.chapter.chapter}, King James Version, with everything taught from it.` : "" },
    ],
  }),
  component: ChapterPage,
});

const KIND_LABEL: Record<string, string> = { note: "Note", law: "Law", precept: "Precept", case: "Case", encyclopedia: "Encyclopedia", class: "Class", study: "Study", captains: "Episode" };
const REMOTE = "https://devsecobie.github.io/cyberjudah";
const localKinds = ["/study/", "/classes/", "/captains/", "/cases/", "/bible/"];

function citeHref(url: string) {
  return localKinds.some((k) => url.startsWith(k)) ? url : `${REMOTE}${url}`;
}

function ChapterPage() {
  const { books, book, chapter, cited } = Route.useLoaderData();
  const navigate = useNavigate();
  const ch = chapter.chapter;
  const prev = ch > 1 ? ch - 1 : null;
  const next = ch < book.chapters ? ch + 1 : null;
  const bookIdx = books.findIndex((b) => b.slug === book.slug);
  const prevBook = !prev && bookIdx > 0 ? books[bookIdx - 1] : null;
  const nextBook = !next && bookIdx < books.length - 1 ? books[bookIdx + 1] : null;
  // The concordance lists a note once per citing passage; fold those into one entry per note
  // and keep the verse ranges together.
  const merged = cited.reduce<Citation[]>((acc, c) => {
    const hit = acc.find((x) => x.url === c.url);
    if (!hit) acc.push({ ...c });
    else if (c.verses && !(hit.verses ?? "").split(", ").includes(c.verses)) hit.verses = hit.verses ? `${hit.verses}, ${c.verses}` : c.verses;
    return acc;
  }, []);
  const grouped = merged.reduce<Record<string, Citation[]>>((acc, c) => { (acc[c.kind] ??= []).push(c); return acc; }, {});
  return (
    <div className="cj-shell">
      <SiteNav />
      <main className="cj-wrap cj-page">
        <div className="reader">
          <nav className="reader__rail" aria-label="Books">
            {books.map((b) => (
              <Link key={b.slug} to="/bible/$book/$chapter" params={{ book: b.slug, chapter: "1" }} aria-current={b.slug === book.slug ? "page" : undefined}>{b.book}</Link>
            ))}
          </nav>
          <article>
            <div className="reader__bar">
              {prev ? <Link className="reader__step" to="/bible/$book/$chapter" params={{ book: book.slug, chapter: String(prev) }} aria-label="Previous chapter">←</Link>
                : prevBook ? <Link className="reader__step" to="/bible/$book/$chapter" params={{ book: prevBook.slug, chapter: String(prevBook.chapters) }} aria-label={`Back to ${prevBook.book}`}>←</Link>
                : <span className="reader__step" aria-disabled="true">←</span>}
              <select value={book.slug} aria-label="Book" onChange={(e) => navigate({ to: "/bible/$book/$chapter", params: { book: e.target.value, chapter: "1" } })}>
                {books.map((b) => <option key={b.slug} value={b.slug}>{b.book}</option>)}
              </select>
              <select value={String(ch)} aria-label="Chapter" onChange={(e) => navigate({ to: "/bible/$book/$chapter", params: { book: book.slug, chapter: e.target.value } })}>
                {book.chapterIds.map((c) => <option key={c} value={String(c)}>Chapter {c}</option>)}
              </select>
              {next ? <Link className="reader__step" to="/bible/$book/$chapter" params={{ book: book.slug, chapter: String(next) }} aria-label="Next chapter">→</Link>
                : nextBook ? <Link className="reader__step" to="/bible/$book/$chapter" params={{ book: nextBook.slug, chapter: "1" }} aria-label={`On to ${nextBook.book}`}>→</Link>
                : <span className="reader__step" aria-disabled="true">→</span>}
            </div>
            <h1 className="cj-h1">{book.book} {ch}</h1>
            <div className="verses">
              {chapter.verses.map((v) => (
                <p key={v.verse} className="verse" id={`v${v.verse}`}>
                  <a className="verse__n" href={`#v${v.verse}`}>{v.verse}</a>
                  {v.text}
                </p>
              ))}
            </div>
          </article>
          <aside className="reader__side">
            {cited.length ? (
              <>
                <h2>Cited by</h2>
                {Object.entries(grouped).map(([kind, list]) => (
                  <ul className="cited" key={kind}>
                    {list.slice(0, 40).map((c, i) => (
                      <li key={i}>
                        <small>{KIND_LABEL[kind] ?? kind}{c.verses ? ` · vv. ${c.verses}` : ""}</small>
                        {citeHref(c.url).startsWith("/") ? <Link to={c.url as never}>{c.label}</Link> : <a href={citeHref(c.url)}>{c.label}</a>}
                      </li>
                    ))}
                  </ul>
                ))}
              </>
            ) : (
              <>
                <h2>Cited by</h2>
                <p className="cj-mono">Nothing in the library cites this chapter yet.</p>
              </>
            )}
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
