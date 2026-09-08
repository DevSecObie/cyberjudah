import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, Kicker } from "@/components/site/chrome";
import { api } from "@/lib/api";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/topics/")({
  loader: () => api.topics(),
  head: ({ match }) => pageHead([{ title: "Topics · CyberJudah" }, { name: "description", content: "Every topic the classes, episodes and cases are tagged with." }], match),
  component: TopicsIndex,
});

function TopicsIndex() {
  const all = Route.useLoaderData();
  const notes = all.filter((t) => t.notes > 0 && !t.slug.startsWith("verdict-")).sort((a, b) => b.notes - a.notes || a.label.localeCompare(b.label));
  const cases = all.filter((t) => t.notes === 0 && t.cases > 0 && !t.slug.startsWith("verdict-"));
  const verdicts = all.filter((t) => t.slug.startsWith("verdict-"));
  return (
    <Page>
      <Kicker>Tags</Kicker>
      <h1 className="cj-h1">Topics.</h1>
      <p className="cj-lede">Every topic the classes, episodes and cases carry. Tags come from the text of each note against a controlled vocabulary; they are for finding classes, not for classifying doctrine.</p>
      <section className="book-block">
        <h2>Taught in the classes</h2>
        <p className="chips">{notes.map((t) => <Link key={t.slug} to="/topics/$slug" params={{ slug: t.slug }} className="chip">{t.label} <span className="chip__n">{t.notes}</span></Link>)}</p>
      </section>
      {cases.length ? <section className="book-block"><h2>Themes of the cases</h2><p className="chips">{cases.map((t) => <Link key={t.slug} to="/topics/$slug" params={{ slug: t.slug }} className="chip">{t.label} <span className="chip__n">{t.cases}</span></Link>)}</p></section> : null}
      {verdicts.length ? <section className="book-block"><h2>By verdict</h2><p className="chips">{verdicts.map((t) => <Link key={t.slug} to="/topics/$slug" params={{ slug: t.slug }} className="chip">{t.label.replace(/^Verdict: /, "")} <span className="chip__n">{t.cases}</span></Link>)}</p></section> : null}
    </Page>
  );
}
