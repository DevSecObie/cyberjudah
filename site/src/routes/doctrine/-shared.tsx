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
    <p>{error === "unpublished" ? "The doctrine section is not published yet" : "The doctrine section did not load"}</p>
    <button type="button" className="lamp-btn" onClick={() => void router.invalidate()}>Retry</button>
  </div>;
}

export function DoctrineAnswers({ entry }: { entry: DoctrineEntry }) {
  return <>
    <section className="book-block"><h2>False claim</h2><p className="cj-lede" style={{ whiteSpace: "pre-wrap" }}>{entry.claim}</p></section>
    {entry.answers.map((answer, i) => <section key={i} className="book-block">
      <h2>Answer {i + 1}</h2>
      <RefCards><div className="refqs">{answer.refs.map((r, n) => <RefQuote key={n} r={r} />)}</div></RefCards>
      {answer.sense.map((s, n) => <figure key={n} className="note" style={{ marginInline: 0 }}>
        <blockquote style={{ whiteSpace: "pre-wrap" }}>{s.text}</blockquote>
        <figcaption>{s.teacher} · {s.note ? <a href={`${s.note}?t=${s.t}`}>Watch at {Math.floor(s.t / 60)}:{String(Math.floor(s.t % 60)).padStart(2, "0")}</a> : <a href={watchAt(s.video, s.t)} target="_blank" rel="noreferrer">Watch at {Math.floor(s.t / 60)}:{String(Math.floor(s.t % 60)).padStart(2, "0")}</a>}</figcaption>
      </figure>)}
    </section>)}
    {([['precepts', 'Related precepts'], ['cases', 'Related cases'], ['topics', 'Related topics']] as const).map(([kind, title]) => entry.related[kind].length ? <section key={kind} className="book-block"><h2>{title}</h2><div className="chips">{entry.related[kind].map((r) => <Link key={r.slug} className="chip" to={r.url as never}>{r.title ?? r.name ?? r.label ?? r.slug}</Link>)}</div></section> : null)}
  </>;
}
