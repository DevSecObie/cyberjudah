import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Page, ReadLink } from "@/components/site/chrome";
import { RefCards } from "@/components/site/ref-card";
import { RefQuote } from "@/components/site/ref-quote";
import { CiteLanding } from "@/components/site/return-bar";
import { api, type StudyChapter, type TeachingExcerpt } from "@/lib/api";
import { Breadcrumbs, eraAnchor } from "@/components/site/browse-tools";
import { pageHead } from "@/lib/head";
import { TaughtSection } from "@/components/site/taught-list";
import { passagesFromRefs } from "@/lib/teaching-refs";

const VERDICT: Record<string, string> = { death: "Put to death", plague: "Plague", exile: "Exile", captivity: "Captivity", curse: "Cursed", restitution: "Restitution", spared: "Spared", reprieve: "Reprieve", temporal: "Temporal judgment", unrecorded: "Sentence not recorded", deferred: "Sentence deferred", blessed: "Kept the law" };

export const Route = createFileRoute("/cases/$era/$slug")({
  loader: async ({ params }) => {
    const [c, idx] = await Promise.all([api.case(params.slug).catch(() => null), api.cases()]);
    if (!c) throw notFound();
    const eraList = idx.cases.filter((x) => x.era === c.era);
    const pos = eraList.findIndex((x) => x.slug === c.slug);
    return { c, prev: pos > 0 ? eraList[pos - 1] : null, next: pos < eraList.length - 1 ? eraList[pos + 1] : null };
  },
  head: ({ loaderData, match }) => pageHead([{ title: loaderData ? `${loaderData.c.name} · Case Studies · CyberJudah` : "CyberJudah" }, { name: "description", content: loaderData?.c.charge ?? "" }], match),
  component: CasePage,
});

function StudyCommentary({ chapters }: { chapters: StudyChapter[] }) {
  return (
    <div className="study-commentary">
      {chapters.map((ch) => (
        <details key={ch.chapter} className="study-chapter">
          <summary>
            <Link to={ch.url as never}>{ch.chapter}</Link>
            <span className="cj-mono" style={{ color: "var(--color-muted)", marginLeft: "0.5rem" }}>{ch.entries.length} {ch.entries.length === 1 ? "verse" : "verses"}</span>
          </summary>
          <div className="study-entries">
            {ch.entries.map((e, i) => (
              <div key={i} className="study-entry">
                <p className="study-entry__ref cj-mono">{e.ref}</p>
                {e.commentary ? <p>{e.commentary}</p> : null}
                {e.precepts?.length ? (
                  <ul className="study-entry__precepts">
                    {e.precepts.map((p, j) => <li key={j}><span className="cj-mono">{p.ref}</span>{p.text ? ` — ${p.text}` : null}</li>)}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

function TeachingExcerpts({ excerpts }: { excerpts: TeachingExcerpt[] }) {
  return (
    <div className="teaching-excerpts">
      {excerpts.map((t) => (
        <details key={t.videoId} className="teaching-excerpt">
          <summary>
            <a href={`https://www.youtube.com/watch?v=${t.videoId}`} target="_blank" rel="noopener noreferrer">{t.title}</a>
            {t.date ? <span className="cj-mono" style={{ color: "var(--color-muted)", marginLeft: "0.5rem" }}>{t.date}</span> : null}
          </summary>
          <ul>
            {t.excerpts.map((e, i) => (
              <li key={i}>
                <a href={`https://www.youtube.com/watch?v=${t.videoId}&t=${Math.floor(e.timestamp)}s`} target="_blank" rel="noopener noreferrer" className="cj-mono">{e.time}</a>
                <span style={{ marginLeft: "0.5rem" }}>{e.text}</span>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

function CasePage() {
  const { c, prev, next } = Route.useLoaderData();
  const blessing = c.kind === "blessing";
  const refs = c.refsResolved ?? [];
  const laws = c.lawsResolved ?? c.laws.map((id) => ({ id, text: "", url: null }));
  const precepts = c.preceptsResolved ?? c.topics.map((slug) => ({ slug, title: slug.replace(/-/g, " "), url: `/precepts/${slug}` }));
  const offenseParas = c.offenseFull ?? [c.offense];
  const judgmentParas = c.judgmentFull ?? [c.judgment];
  return (
    <Page>
      <Breadcrumbs items={[{ label: "Cases", to: "/cases" }, { label: c.era, to: "/cases", hash: eraAnchor(c.era) }, { label: c.name }]} />
      <div className="note-head">
        <p className="cj-kicker">
          {c.code ? <span className="cj-mono" style={{ marginRight: "0.5rem" }}>{c.code}</span> : null}
          {c.era}
        </p>
        <h1 className="cj-h1">{c.name}</h1>
        <div className="case-meta">
          <span className={`verdict verdict--${c.verdict}`}>{c.verdictLabel ?? VERDICT[c.verdict] ?? c.verdict}</span>
          <span style={{ color: "var(--color-muted)" }}>{c.charge}</span>
        </div>
      </div>
      <CiteLanding>
      <RefCards>
        <div className="note">
          <p>{c.summary}</p>

          <h2>{blessing ? "The obedience" : "The offense"}</h2>
          {offenseParas.map((p, i) => <p key={i}>{p}</p>)}

          <h2>{blessing ? "The blessing" : "The judgment"}</h2>
          {judgmentParas.map((p, i) => <p key={i}>{p}</p>)}

          <h2>Scripture</h2>
          <div className="refqs">{refs.map((r, i) => <RefQuote key={i} r={r} />)}</div>

          {c.studyContent?.length ? (
            <>
              <h2>Study commentary</h2>
              <p style={{ color: "var(--color-muted)", marginBottom: "1rem" }}>Verse-by-verse teaching from the daily reading notes.</p>
              <StudyCommentary chapters={c.studyContent} />
            </>
          ) : null}

          {c.teachingExcerpts?.length ? (
            <>
              <h2>Teaching excerpts</h2>
              <p style={{ color: "var(--color-muted)", marginBottom: "1rem" }}>Timestamped references from class recordings.</p>
              <TeachingExcerpts excerpts={c.teachingExcerpts} />
            </>
          ) : null}

          <h2>{blessing ? "Laws kept" : "Laws broken"}</h2>
          <ul className="law-refs">
            {laws.map((l) => <li key={l.id}>{l.url ? <Link to={l.url as never}><span className="cj-mono">{l.id}</span></Link> : <span className="cj-mono">{l.id}</span>}{l.text ? <span> {l.text}</span> : null}</li>)}
          </ul>

          {precepts.length ? (
            <>
              <h2>Precepts</h2>
              <p className="chips">{precepts.map((p) => p.url ? <Link key={p.slug} to={p.url as never} className="chip">{p.title}</Link> : <span key={p.slug} className="chip">{p.title}</span>)}</p>
            </>
          ) : null}

          {c.related?.length ? (
            <>
              <h2>Related cases</h2>
              <ul>{c.related.map((o) => <li key={o.slug}>{o.url ? <Link to={o.url as never}>{o.name}</Link> : o.name}: {o.charge}</li>)}</ul>
            </>
          ) : null}

          {c.taught?.length ? (
            <>
              <h2>Taught in</h2>
              <ul>{c.taught.map((t) => <li key={t.url}><Link to={t.url as never}>{t.title}</Link><span className="cj-mono" style={{ marginLeft: "0.5rem", color: "var(--color-muted)" }}>{t.range}</span></li>)}</ul>
            </>
          ) : null}

          {c.see?.length ? (
            <>
              <h2>See also</h2>
              <ul>{c.see.map((t) => <li key={t.url}><Link to={t.url as never}>{t.title}</Link> (Encyclopedia)</li>)}</ul>
            </>
          ) : null}

          {c.themes?.length ? <p className="chips" style={{ marginTop: "2rem" }}>{c.themes.map((t) => <Link key={t} to="/topics/$slug" params={{ slug: t }} className="chip">{t.replace(/-/g, " ")}</Link>)}</p> : null}
        </div>
      </RefCards>
      </CiteLanding>

      <TaughtSection passages={passagesFromRefs(refs)} subject="this case" />
      <div className="pager">
        {prev ? <Link to={prev.url as never} className="read-link"><span>{prev.name}</span><span aria-hidden="true">→</span></Link> : <ReadLink to="/cases">All cases</ReadLink>}
        {next ? <Link to={next.url as never} className="read-link"><span>{next.name}</span><span aria-hidden="true">→</span></Link> : <ReadLink to="/cases">All cases</ReadLink>}
      </div>
    </Page>
  );
}
