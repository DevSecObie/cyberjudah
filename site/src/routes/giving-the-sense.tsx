import { createFileRoute } from "@tanstack/react-router";
import { Page, Kicker } from "@/components/site/chrome";
import { NoteBrowser, validateBrowse } from "@/components/site/note-browser";
import { api, nf } from "@/lib/api";
import { pageHead } from "@/lib/head";

const COLLECTION = "Giving The Sense From A to Z";

export const Route = createFileRoute("/giving-the-sense")({
  validateSearch: validateBrowse,
  loader: async () => {
    const [allRows, topics, shows] = await Promise.all([api.captains(), api.topicLabels(), api.shows().catch(() => [])]);
    const recordings = shows.find((s) => s.name === COLLECTION)?.recordings ?? null;
    return { rows: allRows.filter((row) => row.collection === COLLECTION), topics, recordings };
  },
  head: ({ match }) => pageHead([
    { title: "Giving The Sense From A to Z · CyberJudah" },
    { name: "description", content: "Giving The Sense From A to Z, the captains' study of the scriptures verse by verse, written up in the teachers' own words with every scripture cited inline." },
  ], match),
  component: GivingTheSense,
});

function GivingTheSense() {
  const { rows, topics, recordings } = Route.useLoaderData();
  const search = Route.useSearch();
  const transcribed = recordings ? ` ${nf.format(recordings)} ${recordings === 1 ? "recording is" : "recordings are"} transcribed; more notes are added as they are written.` : "";
  return (
    <Page>
      <Kicker>Series</Kicker>
      <h1 className="cj-h1">Giving The Sense From A to Z.</h1>
      <p className="cj-lede">The captains read through the scriptures and give the sense of them, verse by verse. {nf.format(rows.length)} {rows.length === 1 ? "study" : "studies"} written up so far, in the teachers' own words with the scriptures quoted and linked inline.{transcribed}</p>
      <NoteBrowser rows={rows} topics={topics} search={search} route="/giving-the-sense" only="captains" />
    </Page>
  );
}
