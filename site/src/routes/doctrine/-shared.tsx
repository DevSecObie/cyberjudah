import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { DoctrinePageViewer } from "@/components/site/doctrine-page-viewer";
import { RefCards } from "@/components/site/ref-card";
import { RefQuote } from "@/components/site/ref-quote";
import type { DoctrineBookPage, DoctrineEntry } from "@/lib/api";
import { watchAt } from "@/lib/teaching-refs";

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

function DoctrineWatch({ moment }: { moment: Pick<DoctrineEntry["answers"][number]["sense"][number], "video" | "note" | "t" | "ts"> }) {
  if (moment.note) {
    const note = new URL(moment.note, "https://cyberjudah.io");
    note.searchParams.set("t", String(moment.t));
    return <a href={moment.note.startsWith("/") ? `${note.pathname}${note.search}${note.hash}` : note.href}>Watch at {moment.ts}</a>;
  }
  return <a href={watchAt(moment.video, moment.t)} target="_blank" rel="noreferrer">Watch at {moment.ts}</a>;
}

function DoctrineBookQuotes({ page, title }: { page: DoctrineBookPage; title: string }) {
  const [open, setOpen] = useState(false);
  return <>
    {page.quotes?.map((quote, i) => <div key={i}>
      <blockquote style={{ whiteSpace: "pre-wrap" }}>{quote.text}</blockquote>
      <button type="button" className="lamp-btn" onClick={() => setOpen(true)}>See it on the page</button>
    </div>)}
    {open ? <DoctrinePageViewer page={page} title={title} onClose={() => setOpen(false)} /> : null}
  </>;
}

export function DoctrineAnswers({ entry }: { entry: DoctrineEntry }) {
  return <>
    <section className="book-block"><h2>False claim</h2><p className="cj-lede" style={{ whiteSpace: "pre-wrap" }}>{entry.claim}</p></section>
    {entry.answers.map((answer, i) => <section key={i} className="book-block">
      <h2>Answer {i + 1}</h2>
      <RefCards><div className="refqs">{answer.refs.map((r, n) => <RefQuote key={n} r={r} />)}</div></RefCards>
      {answer.sense.map((s, n) => <figure key={n} className="note" style={{ marginInline: 0 }}>
        <blockquote style={{ whiteSpace: "pre-wrap" }}>{s.text}</blockquote>
        <figcaption>{s.teacher ? `${s.teacher} · ` : null}<DoctrineWatch moment={s} /></figcaption>
      </figure>)}
    </section>)}
    {entry.scriptures?.length ? <section className="book-block"><h2>Scriptures against it</h2>
      <RefCards><div className="refqs">{entry.scriptures.map((r, i) => <div key={i}>
        <RefQuote r={r} />
        {r.points.length ? <ul style={{ listStyleType: "disc", margin: "8px 0 0", paddingInlineStart: 20 }}>{r.points.map((p, n) => <li key={n} style={{ marginBlock: 8 }}>
          {p.read ? <>Read in {p.title}{" · "}<DoctrineWatch moment={p} /></> : <>
            <p style={{ whiteSpace: "pre-wrap", margin: "0 0 4px" }}>{p.text}</p>
            <div className="cj-mono">{p.teacher ? `${p.teacher} · ` : null}{p.title}{" · "}<DoctrineWatch moment={p} /></div>
          </>}
        </li>)}</ul> : null}
      </div>)}</div></RefCards>
    </section> : null}
    {entry.books?.length ? <section className="book-block"><h2>Books against it</h2>{entry.books.map((book, i) => <div key={i} style={{ marginBlock: 16 }}>
      <h3>{book.url ? <Link to={book.url as never}>{book.title}</Link> : book.title}</h3>
      {book.author || book.year !== null ? <p className="cj-mono">{book.author}{book.author && book.year !== null ? " · " : null}{book.year}</p> : null}
      {book.pages ? book.pages.map((page, n) => <div key={n} style={{ marginBlock: 8 }}>
        <Link to={page.url as never}>{page.vol === 1 ? `p. ${page.page}` : `vol. ${page.vol}, p. ${page.page}`}</Link>
        <span className="cj-mono"> · read in {page.classes} {page.classes === 1 ? "class" : "classes"}</span>
        <DoctrineBookQuotes page={page} title={book.title} />
        {page.reads.length ? <ul style={{ listStyleType: "disc", margin: "8px 0 0", paddingInlineStart: 20 }}>{page.reads.slice(0, 3).map((read, k) => <li key={k} style={{ marginBlock: 8 }}>
          <span className="cj-mono">{read.teacher ? `${read.teacher} · ` : null}{read.title}</span>{" · "}<DoctrineWatch moment={read} />
        </li>)}</ul> : null}
      </div>) : <figure className="note" style={{ marginInline: 0 }}>
        <p className="refrow">{book.said.ref.url ? <Link to={book.said.ref.url as never}>{book.said.ref.label}</Link> : book.said.ref.label}</p>
        <blockquote style={{ whiteSpace: "pre-wrap" }}>{book.said.text}</blockquote>
        <figcaption>{book.said.teacher ? `${book.said.teacher} · ` : null}{book.said.title}{" · "}<DoctrineWatch moment={book.said} /></figcaption>
      </figure>}
    </div>)}</section> : null}
    {([['precepts', 'Related precepts'], ['cases', 'Related cases'], ['topics', 'Related topics']] as const).map(([kind, title]) => entry.related[kind].length ? <section key={kind} className="book-block"><h2>{title}</h2><div className="chips">{entry.related[kind].map((r) => <Link key={r.slug} className="chip" to={r.url as never}>{r.title ?? r.name ?? r.label ?? r.slug}</Link>)}</div></section> : null)}
  </>;
}
