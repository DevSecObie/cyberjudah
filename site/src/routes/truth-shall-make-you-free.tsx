import { createFileRoute } from "@tanstack/react-router";
import { Page, Kicker } from "@/components/site/chrome";
import { NoteBrowser, validateBrowse } from "@/components/site/note-browser";
import { api } from "@/lib/api";
import { pageHead } from "@/lib/head";

const COLLECTION = "The Truth Shall Make You Free";

export const Route = createFileRoute("/truth-shall-make-you-free")({
  validateSearch: validateBrowse,
  loader: async () => {
    const [allRows, topics] = await Promise.all([api.classes(), api.topicLabels()]);
    return { rows: allRows.filter((row) => row.collection === COLLECTION), topics };
  },
  head: ({ match }) => pageHead([
    { title: "The Truth Shall Make You Free · CyberJudah" },
    { name: "description", content: "The Truth Shall Make You Free teaching series, converted into clear notes with every scripture cited inline." },
  ], match),
  component: TruthShallMakeYouFree,
});

function TruthShallMakeYouFree() {
  const { rows, topics } = Route.useLoaderData();
  const search = Route.useSearch();
  return (
    <Page>
      <Kicker>Teaching series</Kicker>
      <h1 className="cj-h1">The Truth Shall Make You Free.</h1>
      <p className="cj-lede">Every available class in the series, converted from the original recording into clear notes in the teacher's own words, with scriptures quoted and linked inline.</p>
      <NoteBrowser rows={rows} topics={topics} search={search} route="/truth-shall-make-you-free" />
    </Page>
  );
}
