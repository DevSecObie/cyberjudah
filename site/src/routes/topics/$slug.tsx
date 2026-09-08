import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Page, Kicker, ReadLink } from "@/components/site/chrome";
import { api, fmtDate } from "@/lib/api";

export const Route = createFileRoute("/topics/$slug")({
  loader: async ({ params }) => {
    const t = await api.topic(params.slug).catch(() => null);
    if (!t) throw notFound();
    return t;
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `${loaderData.label} · Topics · CyberJudah` : "Topics · CyberJudah" }] }),
  component: TopicPage,
});

const VERDICT: Record<string, string> = { death: "Put to death", plague: "Plague", exile: "Exile", captivity: "Captivity", curse: "Cursed", restitution: "Restitution", spared: "Spared", reprieve: "Reprieve", temporal: "Temporal judgment", unrecorded: "Sentence not recorded", blessed: "Kept the law" };

function TopicPage() {
  const t = Route.useLoaderData();
  const classes = t.items.filter((i) => i.kind === "class");
  const captains = t.items.filter((i) => i.kind === "captains");
  const cases = t.items.filter((i) => i.kind === "case");
  return (
    <Page>
      <Kicker>Topic</Kicker>
      <h1 className="cj-h1">{t.label}</h1>
      <p className="cj-lede">{t.items.length} {t.items.length === 1 ? "entry" : "entries"}: {[classes.length && `${classes.length} classes`, captains.length && `${captains.length} episodes`, cases.length && `${cases.length} cases`].filter(Boolean).join(", ")}.</p>
      {[["Sabbath classes", classes], ["The Captains", captains]].map(([label, list]) => (list as typeof classes).length ? (
        <section key={label as string} className="book-block">
          <h2>{label as string}</h2>
          <ul className="list">
            {(list as typeof classes).map((i) => <li key={i.url}><Link to={i.url as never}><span>{i.title}</span><span className="cj-mono">{i.date ? fmtDate(i.date) : ""}{i.teacher ? ` · ${i.teacher}` : ""}</span></Link></li>)}
          </ul>
        </section>
      ) : null)}
      {cases.length ? (
        <section className="book-block">
          <h2>Cases</h2>
          <ul className="list">
            {cases.map((i) => <li key={i.url}><Link to={i.url as never}><span><span style={{ display: "block" }}>{i.title}</span><span style={{ display: "block", fontSize: "0.92rem", color: "var(--color-muted)" }}>{i.charge}</span></span><span className={`verdict verdict--${i.verdict}`}>{VERDICT[i.verdict ?? ""] ?? i.verdict}</span></Link></li>)}
          </ul>
        </section>
      ) : null}
      <p style={{ marginTop: "2rem", display: "flex", gap: "2rem", flexWrap: "wrap" }}>
        {classes.length ? <Link to="/classes" search={{ topic: t.slug } as never} className="read-link"><span>Browse classes on {t.label.toLowerCase()}</span><span aria-hidden="true">→</span></Link> : null}
        <ReadLink to="/topics">All topics</ReadLink>
      </p>
    </Page>
  );
}
