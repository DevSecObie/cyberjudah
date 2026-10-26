import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { DoctrinePageViewer } from "@/components/site/doctrine-page-viewer";
import { RefCards } from "@/components/site/ref-card";
import { RefQuote } from "@/components/site/ref-quote";
import type { DoctrineBookPage, DoctrineEntry } from "@/lib/api";
import { watchAt } from "@/lib/teaching-refs";
import "./-doctrine.css";

export async function loadDoctrine<T>(read: () => Promise<T>): Promise<{ data: T; error: null } | { data: null; error: "unpublished" | "unavailable" }> {
  try { return { data: await read(), error: null }; }
  catch (e) { return { data: null, error: e instanceof Error && e.message.startsWith("404 ") ? "unpublished" : "unavailable" }; }
}

export function DoctrineEmpty({ error }: { error: "unpublished" | "unavailable" }) {
  const router = useRouter();
  return <div className="study__empty" role="status">
    <p>{error === "unpublished" ? "The false doctrines section is not published yet" : "The false doctrines section did not load"}</p>
    <button type="button" className="lamp-btn" onClick={() => void router.invalidate()}>Retry</button>
  </div>;
}

function DoctrineWatch({ moment, label }: { moment: Pick<DoctrineEntry["answers"][number]["sense"][number], "video" | "note" | "t" | "ts">; label?: string }) {
  const content = <>{label ? <>{label}<span aria-hidden="true"> · </span></> : null}<span className="doctrine-time">Watch at {moment.ts}</span></>;
  if (moment.note) {
    const note = new URL(moment.note, "https://cyberjudah.io");
    note.searchParams.set("t", String(moment.t));
    return <a className="doctrine-watch" href={moment.note.startsWith("/") ? `${note.pathname}${note.search}${note.hash}` : note.href}>{content}</a>;
  }
  return <a className="doctrine-watch" href={watchAt(moment.video, moment.t)} target="_blank" rel="noreferrer">{content}</a>;
}

function DoctrineBookQuotes({ page, title }: { page: DoctrineBookPage; title: string }) {
  const [open, setOpen] = useState(false);
  return <>
    {page.quotes?.map((quote, i) => <div key={i} className="doctrine-ocr">
      <blockquote style={{ whiteSpace: "pre-wrap" }}>{quote.text}</blockquote>
      <button type="button" className="doctrine-scan" onClick={() => setOpen(true)}>See it on the page</button>
    </div>)}
    {open ? <DoctrinePageViewer page={page} title={title} onClose={() => setOpen(false)} /> : null}
  </>;
}

export function DoctrineAnswers({ entry }: { entry: DoctrineEntry }) {
  return <div className="doctrine-content">
    <section className="book-block"><h2>False claim</h2><p className="doctrine-claim">{entry.claim}</p></section>
    <nav className="doctrine-jump" aria-label="On this page">
      {entry.answers.length ? <a href="#doctrine-study">Scripture &amp; teaching</a> : null}
      {entry.scriptures?.length ? <a href="#doctrine-scriptures">Scriptures <span>{entry.scriptures.length}</span></a> : null}
      {entry.books?.length ? <a href="#doctrine-books">Books <span>{entry.books.length}</span></a> : null}
    </nav>
    {entry.answers.length ? <section id="doctrine-study" className="book-block"><h2>Scripture &amp; teaching</h2>
      {entry.answers.map((answer, i) => <article key={i} className="doctrine-evidence">
        <RefCards><div className="refqs">{answer.refs.map((r, n) => <RefQuote key={n} r={r} />)}</div></RefCards>
        {answer.sense.map((s, n) => <figure key={n} className="doctrine-teaching">
          <blockquote style={{ whiteSpace: "pre-wrap" }}>{s.text}</blockquote>
          <figcaption><DoctrineWatch moment={s} label={s.teacher} /></figcaption>
        </figure>)}
      </article>)}
    </section> : null}
    {entry.scriptures?.length ? <section id="doctrine-scriptures" className="book-block"><h2>Scriptures against it</h2>
      <RefCards><div className="refqs">{entry.scriptures.map((r, i) => <div key={i}>
        <RefQuote r={r} />
        {r.points.length ? <ul className="doctrine-points">{r.points.map((p, n) => <li key={n}>
          {p.read ? <DoctrineWatch moment={p} label={`Read in ${p.title}`} /> : <>
            <p className="doctrine-explanation">{p.text}</p>
            <DoctrineWatch moment={p} label={[p.teacher, p.title].filter(Boolean).join(" · ")} />
          </>}
        </li>)}</ul> : null}
      </div>)}</div></RefCards>
    </section> : null}
    {entry.books?.length ? <section id="doctrine-books" className="book-block"><h2>Books against it</h2>{entry.books.map((book, i) => <div key={i} className="doctrine-book">
      <h3>{book.url ? <Link to={book.url as never}>{book.title}</Link> : book.title}</h3>
      {book.author || book.year !== null ? <p className="cj-mono">{book.author}{book.author && book.year !== null ? " · " : null}{book.year}</p> : null}
      {book.pages ? book.pages.map((page, n) => <div key={n} className="doctrine-book-page">
        <Link to={page.url as never}>{page.vol === 1 ? `p. ${page.page}` : `vol. ${page.vol}, p. ${page.page}`}</Link>
        <span className="cj-mono"> · read in {page.classes} {page.classes === 1 ? "class" : "classes"}</span>
        <DoctrineBookQuotes page={page} title={book.title} />
        {page.reads.length ? <ul className="doctrine-points">{page.reads.slice(0, 3).map((read, k) => <li key={k}>
          <DoctrineWatch moment={read} label={[read.teacher, read.title].filter(Boolean).join(" · ")} />
        </li>)}</ul> : null}
      </div>) : <figure className="doctrine-teaching">
        <p className="refrow">{book.said.ref.url ? <Link to={book.said.ref.url as never}>{book.said.ref.label}</Link> : book.said.ref.label}</p>
        <blockquote style={{ whiteSpace: "pre-wrap" }}>{book.said.text}</blockquote>
        <figcaption><DoctrineWatch moment={book.said} label={[book.said.teacher, book.said.title].filter(Boolean).join(" · ")} /></figcaption>
      </figure>}
    </div>)}</section> : null}
    {([['precepts', 'Related precepts'], ['cases', 'Related cases'], ['topics', 'Related topics']] as const).map(([kind, title]) => entry.related[kind].length ? <section key={kind} className="book-block"><h2>{title}</h2><div className="doctrine-related">{entry.related[kind].map((r) => <Link key={r.slug} to={r.url as never}>{r.title ?? r.name ?? r.label ?? r.slug}</Link>)}</div></section> : null)}
  </div>;
}
