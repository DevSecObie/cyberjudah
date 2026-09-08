import { createFileRoute } from "@tanstack/react-router";
import { Page, Kicker } from "@/components/site/chrome";
import { NoteBrowser, validateBrowse } from "@/components/site/note-browser";
import { api } from "@/lib/api";

export const Route = createFileRoute("/classes/")({
  validateSearch: validateBrowse,
  loader: async () => { const [rows, topics] = await Promise.all([api.classes(), api.topicLabels()]); return { rows, topics }; },
  head: () => ({ meta: [{ title: "Sabbath Classes · CyberJudah" }, { name: "description", content: "Every Sabbath class written up in full, scriptures cited inline. Browse by topic, book, teacher or year." }] }),
  component: Classes,
});

function Classes() {
  const { rows, topics } = Route.useLoaderData();
  const search = Route.useSearch();
  return (
    <Page>
      <Kicker>Sabbath classes</Kicker>
      <h1 className="cj-h1">Sabbath Classes.</h1>
      <p className="cj-lede">Every class written up in full, in the teacher's own words, with the scriptures cited inline. Pick a topic, or narrow by the book it opens, who taught it, or the year.</p>
      <NoteBrowser rows={rows} topics={topics} search={search} route="/classes" />
    </Page>
  );
}
