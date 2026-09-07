import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Page, ReadLink } from "@/components/site/chrome";
import { api, type Book, type CaseRef, type Verse } from "@/lib/api";

const VERDICT: Record<string, string> = { death: "Put to death", plague: "Plague", exile: "Exile", captivity: "Captivity", curse: "Cursed", restitution: "Restitution", spared: "Spared", reprieve: "Reprieve", temporal: "Temporal judgment", unrecorded: "Sentence not recorded", blessed: "Kept the law" };
const REMOTE = "https://devsecobie.github.io/cyberjudah";

function range(vv?: string): [number, number] | null {
  if (!vv) return null;
  const [a, b] = vv.split("-").map(Number);
  return [a, b || a];
}

export const Route = createFileRoute("/cases/$era/$slug")({
  loader: async ({ params }) => {
    const [c, books] = await Promise.all([api.case(params.slug).catch(() => null), api.books()]);
    if (!c) throw notFound();
    const quotes = await Promise.all(c.refs.map(async (r: CaseRef) => {
      const book = books.find((b: Book) => b.book === r.book);
      if (!book) return { ref: r, slug: "", verses: [] as Verse[] };
      const ch = await api.chapter(book.slug, r.chapter).catch(() => null);
      const rg = range(r.verses);
      const verses = ch ? ch.verses.filter((v) => !rg || (v.verse >= rg[0] && v.verse <= rg[1])) : [];
      return { ref: r, slug: book.slug, verses: verses.slice(0, 30) };
    }));
    return { c, quotes };
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `${loaderData.c.name} · Case Studies · CyberJudah` : "CyberJudah" }, { name: "description", content: loaderData?.c.charge ?? "" }] }),
  component: CasePage,
});

function CasePage() {
  const { c, quotes } = Route.useLoaderData();
  const blessing = c.kind === "blessing";
  return (
    <Page>
      <div className="note-head">
        <p className="cj-kicker">{c.era}</p>
        <h1 className="cj-h1">{c.name}</h1>
        <div className="case-meta">
          <span className={`verdict verdict--${c.verdict}`}>{VERDICT[c.verdict] ?? c.verdict}</span>
          <span style={{ color: "var(--color-muted)" }}>{c.charge}</span>
        </div>
      </div>
      <div className="note">
        <p>{c.summary}</p>
        <h2>{blessing ? "The obedience" : "The offense"}</h2>
        <p>{c.offense}</p>
        <h2>{blessing ? "The blessing" : "The judgment"}</h2>
        <p>{c.judgment}</p>
        <h2>Scripture</h2>
        {quotes.map((q, i) => (
          <div key={i}>
            <p style={{ marginBottom: "0.4rem" }}>
              {q.slug ? <Link to="/bible/$book/$chapter" params={{ book: q.slug, chapter: String(q.ref.chapter) }} hash={q.ref.verses ? `v${q.ref.verses.split("-")[0]}` : undefined}><strong>{q.ref.book} {q.ref.chapter}{q.ref.verses ? `:${q.ref.verses}` : ""}</strong></Link> : <strong>{q.ref.book} {q.ref.chapter}</strong>}
            </p>
            {q.verses.length ? (
              <blockquote>
                {q.verses.map((v) => <p key={v.verse}><sup>{v.verse}</sup>{v.text}</p>)}
              </blockquote>
            ) : null}
          </div>
        ))}
        <h2>{blessing ? "Laws kept" : "Laws broken"}</h2>
        <ul>{c.laws.map((l) => <li key={l}><a href={`${REMOTE}/law/${l.split(".")[0].toLowerCase()}`}>{l}</a></li>)}</ul>
        {c.topics.length ? (
          <>
            <h2>Precepts</h2>
            <ul>{c.topics.map((t) => <li key={t}><a href={`${REMOTE}/precepts/${t}`}>{t.replace(/-/g, " ")}</a></li>)}</ul>
          </>
        ) : null}
      </div>
      <p style={{ marginTop: "3rem" }}><ReadLink to="/cases">All cases</ReadLink></p>
    </Page>
  );
}
