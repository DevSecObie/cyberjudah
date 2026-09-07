import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Page, ReadLink } from "@/components/site/chrome";
import { NoteBody } from "@/components/site/note-body";
import { api, fmtDate } from "@/lib/api";
import { renderNote, plainLede } from "@/lib/markdown";

export const Route = createFileRoute("/captains/$year/$slug")({
  loader: async ({ params }) => {
    const note = await api.note(`/captains/${params.year}/${params.slug}`).catch(() => null);
    if (!note) throw notFound();
    return { note, html: renderNote(note.body), lede: plainLede(note.body) };
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `${loaderData.note.title} · CyberJudah` : "CyberJudah" }, { name: "description", content: loaderData?.lede ?? "" }] }),
  component: NotePage,
});

function NotePage() {
  const { note, html } = Route.useLoaderData();
  return (
    <Page>
      <div className="note-head">
        <p className="cj-kicker">The Captains{note.date ? ` · ${fmtDate(note.date)}` : ""}{note.teacher ? ` · ${note.teacher}` : ""}</p>
        <h1 className="cj-h1">{note.title}</h1>
        <ReadLink to="/captains">All episodes</ReadLink>
      </div>
      <NoteBody html={html} />
      <p style={{ marginTop: "3rem" }}><Link to="/captains" className="read-link"><span>Back to the episodes</span><span aria-hidden="true">→</span></Link></p>
    </Page>
  );
}
