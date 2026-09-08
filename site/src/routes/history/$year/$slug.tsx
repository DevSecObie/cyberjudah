import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Page, ReadLink } from "@/components/site/chrome";
import { NoteBody } from "@/components/site/note-body";
import { NoteWithContents } from "@/components/site/contents-rail";
import { CiteLanding } from "@/components/site/return-bar";
import { api, fmtDate } from "@/lib/api";
import { renderNote, plainLede } from "@/lib/markdown";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/history/$year/$slug")({
  loader: async ({ params }) => {
    const [note, all] = await Promise.all([api.note(`/history/${params.year}/${params.slug}`).catch(() => null), api.history()]);
    if (!note) throw notFound();
    const i = all.findIndex((r) => r.url === note.url);
    const row = i >= 0 ? all[i] : null;
    return { note, row, html: renderNote(note.body), lede: plainLede(note.body), prev: i >= 0 ? (all[i + 1] ?? null) : null, next: i >= 0 ? (all[i - 1] ?? null) : null };
  },
  head: ({ loaderData, match }) => pageHead([{ title: loaderData ? `${loaderData.row?.episode ? `EP ${loaderData.row.episode}: ` : ""}${loaderData.note.title} · Our Hidden History · CyberJudah` : "Our Hidden History · CyberJudah" }, { name: "description", content: loaderData?.lede ?? "" }], match, { type: "article" }),
  component: EpisodePage,
});

function EpisodePage() {
  const { note, row, html, prev, next } = Route.useLoaderData();
  const meta = [row?.episode ? `EP ${row.episode}` : "", note.date ? fmtDate(note.date) : "", note.teacher].filter(Boolean).join(" · ");
  return (
    <Page>
      <div className="note-head">
        <p className="cj-kicker">Our Hidden History{meta ? ` · ${meta}` : ""}</p>
        <h1 className="cj-h1">{note.title}</h1>
        <ReadLink to="/history">All episodes</ReadLink>
      </div>
      <CiteLanding>
        <NoteWithContents>
          <NoteBody html={html} />
        </NoteWithContents>
      </CiteLanding>
      <div className="pager">
        {prev ? <Link to={prev.url as never} className="read-link"><span>{prev.episode ? `EP ${prev.episode} · ` : ""}{prev.title}</span><span aria-hidden="true">→</span></Link> : <ReadLink to="/history">All episodes</ReadLink>}
        {next ? <Link to={next.url as never} className="read-link"><span>{next.episode ? `EP ${next.episode} · ` : ""}{next.title}</span><span aria-hidden="true">→</span></Link> : <ReadLink to="/history">All episodes</ReadLink>}
      </div>
    </Page>
  );
}
