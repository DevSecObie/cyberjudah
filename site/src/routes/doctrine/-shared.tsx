import { Link, useRouter } from "@tanstack/react-router";
import { RefCards } from "@/components/site/ref-card";
import { RefQuote } from "@/components/site/ref-quote";
import type { DoctrineEntry } from "@/lib/api";
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
    {([['precepts', 'Related precepts'], ['cases', 'Related cases'], ['topics', 'Related topics']] as const).map(([kind, title]) => entry.related[kind].length ? <section key={kind} className="book-block"><h2>{title}</h2><div className="chips">{entry.related[kind].map((r) => <Link key={r.slug} className="chip" to={r.url as never}>{r.title ?? r.name ?? r.label ?? r.slug}</Link>)}</div></section> : null)}
  </>;
}
