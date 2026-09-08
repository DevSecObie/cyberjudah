import { createFileRoute } from "@tanstack/react-router";
import { Page, Kicker } from "@/components/site/chrome";
import { NoteBrowser, validateBrowse } from "@/components/site/note-browser";
import { api } from "@/lib/api";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/captains/")({
  validateSearch: validateBrowse,
  loader: async () => { const [rows, topics] = await Promise.all([api.captains(), api.topicLabels()]); return { rows, topics }; },
  head: ({ match }) => pageHead([{ title: "15 Min w/Captains · CyberJudah" }, { name: "description", content: "15 Minutes w/ The Captains: short teachings, one subject at a time. Browse by topic, book, teacher or year." }], match),
  component: Captains,
});

function Captains() {
  const { rows, topics } = Route.useLoaderData();
  const search = Route.useSearch();
  return (
    <Page>
      <Kicker>15 Minutes w/ The Captains</Kicker>
      <h1 className="cj-h1">15 Min w/Captains.</h1>
      <p className="cj-lede">Short teachings from the captains, one subject at a time, every scripture quoted where it was read. Pick a topic, or narrow by book, teacher or year.</p>
      <NoteBrowser rows={rows} topics={topics} search={search} route="/captains" />
    </Page>
  );
}
