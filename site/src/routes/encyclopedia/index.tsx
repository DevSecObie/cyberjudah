import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, Kicker } from "@/components/site/chrome";
import { api } from "@/lib/api";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/encyclopedia/")({
  loader: () => api.encyclopedia(),
  head: ({ match }) => pageHead([{ title: "Encyclopedia · CyberJudah" }, { name: "description", content: "Standing subjects gathered from across the notes, each one walked through book by book." }], match),
  component: EncyclopediaIndex,
});

function EncyclopediaIndex() {
  const entries = Route.useLoaderData();
  return (
    <Page>
      <Kicker>Standing subjects</Kicker>
      <h1 className="cj-h1">Encyclopedia.</h1>
      <p className="cj-lede">{entries.length} subjects gathered from across the notes, each walked through the scripture book by book with every passage quoted in place.</p>
      <ul className="enc-list">
        {entries.map((e) => (
          <li key={e.slug}>
            <Link to="/encyclopedia/$slug" params={{ slug: e.slug }}>
              <span className="enc-list__title">{e.title}</span>
              <span className="enc-list__summary">{e.summary}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
