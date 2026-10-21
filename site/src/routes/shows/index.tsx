import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, Kicker } from "@/components/site/chrome";
import { api, nf, type ShowRow } from "@/lib/api";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/shows/")({
  loader: () => api.shows(),
  head: ({ match }) => pageHead([{ title: "Shows & Series · CyberJudah" }, { name: "description", content: "The assembly's radio shows, TV shows, podcasts and series besides the Sabbath classes, each with its own notes." }], match),
  component: ShowsIndex,
});

/** "Radio show · 12 notes", or how many of its recordings are transcribed while it has none. */
export const showLine = (s: ShowRow) => [
  s.kind,
  s.notes ? `${nf.format(s.notes)} ${s.notes === 1 ? "note" : "notes"}` : "No notes yet",
  s.recordings ? `${nf.format(s.recordings)} ${s.recordings === 1 ? "recording" : "recordings"} transcribed` : "",
].filter(Boolean).join(" · ");

function ShowsIndex() {
  const shows = Route.useLoaderData();
  const noted = shows.filter((s) => s.notes).length;
  return (
    <Page>
      <Kicker>Besides the Sabbath classes</Kicker>
      <h1 className="cj-h1">Shows &amp; Series.</h1>
      <p className="cj-lede">{shows.length} shows and series: the radio shows, TV shows, podcasts and runs of classes the assembly puts out besides the Sabbath classes. {noted} of them have notes so far; the rest are added as their notes are written.</p>
      <ul className="enc-list">
        {shows.map((s) => (
          <li key={s.slug}>
            <Link to={s.url as never}>
              <span className="enc-list__title">{s.name}</span>
              <span className="enc-list__summary">{showLine(s)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
