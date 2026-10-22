import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { Page, Kicker, ReadLink } from "@/components/site/chrome";
import { NoteBrowser, validateBrowse } from "@/components/site/note-browser";
import { api, nf, OWN_SECTION } from "@/lib/api";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/shows/$slug")({
  validateSearch: validateBrowse,
  loader: async ({ params }) => {
    const shows = await api.shows();
    const show = shows.find((s) => s.slug === params.slug);
    if (!show) throw notFound();
    // The shows that had their own section before this one keep it.
    if (show.page) throw redirect({ to: show.page as never });
    if (OWN_SECTION[show.slug]) throw redirect({ to: OWN_SECTION[show.slug] as never });
    const [all, topics] = await Promise.all([show.feed === "captains" ? api.captains() : api.classes(), api.topicLabels()]);
    // A show's episodes on another station carry its name and the station ("… · Kente FM Radio").
    const rows = all.filter((r) => r.collection === show.name || r.collection?.startsWith(`${show.name} · `));
    return { show, rows, topics };
  },
  head: ({ loaderData, match }) => pageHead([
    { title: loaderData ? `${loaderData.show.name} · CyberJudah` : "Shows · CyberJudah" },
    { name: "description", content: loaderData ? `${loaderData.show.name} (${loaderData.show.kind.toLowerCase()}), written up in the teachers' own words with every scripture cited inline.` : "" },
  ], match),
  component: ShowPage,
});

function ShowPage() {
  const { show, rows, topics } = Route.useLoaderData();
  const search = Route.useSearch();
  const { slug } = Route.useParams();
  const transcribed = show.recordings ? `${nf.format(show.recordings)} ${show.recordings === 1 ? "recording is" : "recordings are"} transcribed` : "";
  return (
    <Page>
      <Kicker>{show.kind}</Kicker>
      <h1 className="cj-h1">{show.name}.</h1>
      {rows.length ? (
        <>
          <p className="cj-lede">{nf.format(rows.length)} {rows.length === 1 ? "recording" : "recordings"} written up so far, in the teachers' own words with the scriptures quoted and linked inline.{transcribed ? ` ${transcribed}; more notes are added as they are written.` : ""}</p>
          <NoteBrowser rows={rows} topics={topics} search={search} route={`/shows/${slug}`} only={show.feed === "captains" ? "captains" : "class"} />
        </>
      ) : (
        <>
          <p className="cj-lede">No notes have been written for {show.name} yet.{transcribed ? ` ${transcribed}, and` : ""} its notes will be listed here as they are written.</p>
          <p><ReadLink to="/shows">Every show and series</ReadLink></p>
        </>
      )}
    </Page>
  );
}
